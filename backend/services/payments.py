"""Stripe boundary and durable Checkout attempts; no provider payloads in logs."""
import asyncio
import re
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation

import httpx
import stripe
from fastapi import HTTPException
from pymongo.errors import DuplicateKeyError
from services.capacity import reserve_capacity, cancel_unpaid_match


def cents(amount):
    try:
        value = Decimal(str(amount)) * 100
        if not value.is_finite() or value <= 0 or value != value.to_integral_value():
            raise ValueError()
        return int(value)
    except (InvalidOperation, ValueError, TypeError):
        raise HTTPException(409, "Booking amount requires reconciliation") from None


class StripeGateway:
    def __init__(self, key, live):
        self.key, self.live = key, live

    def validate_mode(self, data):
        if data.get("livemode") is not self.live:
            raise HTTPException(409, "Stripe payment mode does not match this environment")
        return data

    async def _request(self, method, path, data=None, idempotency_key=None):
        headers = {"Authorization": f"Bearer {self.key}", "Stripe-Version": "2024-06-20"}
        if idempotency_key:
            headers["Idempotency-Key"] = idempotency_key
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                for attempt in range(5):
                    response = await client.request(method, f"https://api.stripe.com/v1/{path}", headers=headers, data=data)
                    # Stripe serializes simultaneous requests with the same key.
                    if response.status_code == 409 and idempotency_key and attempt < 4:
                        await asyncio.sleep(0.2 * (attempt + 1))
                        continue
                    response.raise_for_status()
                    result = response.json()
                    if not isinstance(result, dict):
                        raise ValueError()
                    return self.validate_mode(result)
        except (httpx.HTTPError, ValueError):
            raise HTTPException(502, "Stripe is temporarily unavailable; retry the same booking") from None

    async def retrieve(self, session_id):
        if not isinstance(session_id, str) or not re.fullmatch(r"cs_[A-Za-z0-9_]+", session_id):
            raise HTTPException(409, "Checkout reference requires reconciliation")
        session = await self._request("GET", f"checkout/sessions/{session_id}")
        if session.get("id") != session_id:
            raise HTTPException(502, "Stripe returned an invalid Checkout reference")
        return session

    async def create(self, attempt):
        data = {"mode": "payment", "payment_method_types[0]": "card",
                "success_url": attempt["site_url"] + "/payment-success?session_id={CHECKOUT_SESSION_ID}",
                "cancel_url": attempt["site_url"] + "/payment-cancelled",
                "line_items[0][price_data][currency]": "usd",
                "line_items[0][price_data][unit_amount]": str(attempt["amount_cents"]),
                "line_items[0][price_data][product_data][name]": "SendJet delivery",
                "line_items[0][quantity]": "1"}
        for key, value in attempt["metadata"].items():
            data[f"metadata[{key}]"] = value
        # Immutable parameters and key survive retries, workers, and restarts.
        return await self._request("POST", "checkout/sessions", data,
                                   f"sendjet-checkout:{attempt['_id']}:{attempt['attempt_id']}")


def validate_payment_session(session, transaction):
    if (session.get("mode") != "payment"
            or session.get("amount_total") != cents(transaction["amount"])
            or session.get("currency") != transaction.get("currency", "usd")
            or session.get("metadata", {}).get("match_id") != transaction["match_id"]
            or session.get("metadata", {}).get("sender_id") != transaction["sender_id"]):
        raise HTTPException(409, "Stripe payment does not match the recorded booking")


async def checkout_for_match(db, match, gateway, site_url, reconcile):
    match_id = match["id"]
    for _ in range(5):
        current = await db.matches.find_one({"id": match_id})
        if (not current or current.get("status") not in {"accepted", "payment_pending"}
                or current.get("payment_status") in {"escrowed", "released", "paid"}):
            raise HTTPException(409, "Booking is already paid or no longer payable")
        if current.get("trip_id"):
            await reserve_capacity(db, current)
            # Win against cancellation before creating any external payment attempt.
            if current["status"] == "accepted":
                claimed = await db.matches.update_one(
                    {"id": match_id, "status": "accepted"}, {"$set": {"status": "payment_pending"}})
                if not claimed.modified_count:
                    continue
        attempt = await db.checkout_attempts.find_one({"_id": match_id})
        if not attempt:
            old = await db.payment_transactions.find({"match_id": match_id}).to_list(None)
            if len(old) > 1:
                raise HTTPException(409, "Multiple legacy payment attempts require reconciliation before checkout")
            if old and old[0].get("payment_status") == "paid":
                await reconcile(old[0])
                raise HTTPException(409, "Payment already completed; open shipment tracking")
            previous_session = old[0].get("session_id") if old else current.get("payment_intent_id")
            candidate = {"attempt_id": str(uuid.uuid4()), "created_at": datetime.now(timezone.utc),
                         "amount_cents": cents(current["price_agreed"]), "site_url": site_url,
                         "live": gateway.live, "session_id": previous_session,
                         "metadata": {"match_id": match_id, "sender_id": current["sender_id"],
                                      "traveler_id": current["traveler_id"], "shipment_id": current["shipment_id"]}}
            try:
                await db.checkout_attempts.update_one({"_id": match_id}, {"$setOnInsert": candidate}, upsert=True)
            except DuplicateKeyError:
                pass
            attempt = await db.checkout_attempts.find_one({"_id": match_id})
        if attempt["live"] != gateway.live or attempt["amount_cents"] != cents(current["price_agreed"]):
            raise HTTPException(409, "Existing payment attempt requires reconciliation")
        if attempt.get("session_id"):
            session = await gateway.retrieve(attempt["session_id"])
        else:
            created = attempt["created_at"]
            if created.tzinfo is None:
                created = created.replace(tzinfo=timezone.utc)
            # Stripe may discard idempotency keys after 24 hours. An unknown
            # outcome must be reconciled, never retried with a new key later.
            if datetime.now(timezone.utc) - created > timedelta(hours=23):
                raise HTTPException(409, "Unresolved payment attempt requires reconciliation")
            session = await gateway.create(attempt)
            if not re.fullmatch(r"cs_[A-Za-z0-9_]+", str(session.get("id", ""))):
                raise HTTPException(502, "Stripe returned an invalid Checkout reference")
            await db.checkout_attempts.update_one({"_id": match_id, "attempt_id": attempt["attempt_id"]},
                                                  {"$set": {"session_id": session["id"]}})
        transaction = {"id": f"checkout:{session['id']}", "session_id": session["id"],
                       **attempt["metadata"], "amount": attempt["amount_cents"] / 100,
                       "currency": "usd", "payment_status": "initiated",
                       "created_at": attempt["created_at"].isoformat(), "metadata": attempt["metadata"]}
        validate_payment_session(session, transaction)
        # Preserve existing transaction records; new ones have a unique Mongo _id.
        saved = await db.payment_transactions.find_one({"session_id": session["id"]})
        if not saved:
            try:
                await db.payment_transactions.update_one({"_id": transaction["id"]}, {"$setOnInsert": transaction}, upsert=True)
            except DuplicateKeyError:
                pass
        else:
            validate_payment_session(session, saved)
        if session.get("payment_status") == "paid":
            await db.payment_transactions.update_one({"session_id": session["id"]}, {"$set": {"payment_status": "paid"}})
            await reconcile(saved or transaction)
            raise HTTPException(409, "Payment already completed; open shipment tracking")
        if session.get("status") == "expired" and session.get("payment_status") == "unpaid":
            if current.get("trip_id"):
                # Do not rotate a payable session while another worker releases
                # its capacity. A fresh request must acquire a new reservation.
                latest = await db.matches.find_one({"id": match_id})
                released = await cancel_unpaid_match(db, latest, expired_session=session)
                if not released:
                    raise HTTPException(409, "Expired checkout requires reservation reconciliation")
                raise HTTPException(409, "Checkout expired; reopen requests and arrange a new reservation")
            # Only authoritative expiration permits a new logical attempt.
            await db.checkout_attempts.update_one({"_id": match_id, "attempt_id": attempt["attempt_id"]},
                {"$set": {"attempt_id": str(uuid.uuid4()), "created_at": datetime.now(timezone.utc), "session_id": None}})
            continue
        if session.get("status") != "open" or session.get("payment_status") != "unpaid" or not session.get("url"):
            raise HTTPException(409, "Payment is processing; check payment status before trying again")
        await db.matches.update_one({"id": match_id, "status": {"$in": ["accepted", "payment_pending"]},
                                    "payment_status": {"$nin": ["escrowed", "released", "paid"]}},
            {"$set": {"status": "payment_pending", "payment_intent_id": session["id"]}})
        return {"url": session["url"], "session_id": session["id"]}
    raise HTTPException(409, "Payment attempt changed; retry this booking")


def verify_webhook(body, signature, secret, live):
    if not secret:
        raise HTTPException(503, "Stripe webhook signing secret is not configured")
    if not signature:
        raise HTTPException(400, "Stripe signature is required")
    try:
        event = stripe.Webhook.construct_event(body, signature, secret, tolerance=300)
    except (ValueError, stripe.SignatureVerificationError):
        raise HTTPException(400, "Invalid Stripe webhook signature or payload") from None
    if event.get("livemode") is not live:
        raise HTTPException(400, "Stripe webhook mode does not match this environment")
    return event
