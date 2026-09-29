"""Journey capacity, using existing kg/litre totals and durable per-match claims.

Claims live on the journey so one Mongo compare-and-set serializes acceptance
across workers without requiring replica-set transactions. Marketplace reads do
not write/migrate legacy data. Unknown legacy usage fails closed.
"""
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation

from fastapi import HTTPException


OCCUPIED = {"accepted", "payment_pending", "paid", "in_progress", "completed"}
TERMINAL_UNPAID = {"cancelled", "rejected", "expired"}
PAID = {"paid", "escrowed", "released", "refunded"}


def number(value):
    try:
        result = Decimal(str(value))
        if not result.is_finite() or result < 0:
            raise ValueError()
        return result
    except (InvalidOperation, TypeError, ValueError):
        raise HTTPException(409, "Journey or shipment capacity requires reconciliation") from None


def demand(shipment):
    weight = number(shipment.get("weight"))
    dimensions = shipment.get("dimensions") or {}
    space = Decimal(1)
    for side in ("length", "width", "height"):
        side_value = number(dimensions.get(side))
        if not side_value:
            raise HTTPException(409, "Shipment dimensions must be greater than zero")
        space *= side_value
    if not weight:
        raise HTTPException(409, "Shipment weight must be greater than zero")
    return {"weight": float(weight), "space": float(space / 1000)}  # cm3 -> litres


def future_active(trip):
    departure = trip.get("departure_date")
    try:
        if isinstance(departure, str):
            departure = datetime.fromisoformat(departure.replace("Z", "+00:00"))
        if departure.tzinfo is None:
            departure = departure.replace(tzinfo=timezone.utc)
        return trip.get("status") == "active" and departure > datetime.now(timezone.utc)
    except (AttributeError, TypeError, ValueError):
        return False


async def allocations(db, trip):
    # Snapshots retain completed usage even if its shipment is later deleted.
    claims = {c["match_id"]: dict(c) for c in trip.get("capacity_claims", [])}
    matches = await db.matches.find({"trip_id": trip["id"]}).to_list(None)
    for match in matches:
        mid = match["id"]
        shipment = None
        handed_over = False
        if match.get("status") in TERMINAL_UNPAID and match.get("payment_status") not in PAID:
            shipment = await db.shipments.find_one({"id": match["shipment_id"]})
            handed_over = bool(shipment and shipment.get("status") in {"picked_up", "in_transit", "arrived", "delivered"})
            if not handed_over:
                claims.pop(mid, None)
                continue
        if not handed_over and match.get("status") not in OCCUPIED and match.get("payment_status") not in PAID:
            continue
        if mid not in claims:
            shipment = shipment or await db.shipments.find_one({"id": match["shipment_id"]})
            if not shipment:
                raise HTTPException(409, "Legacy journey capacity requires reconciliation")
            claims[mid] = {"match_id": mid, **demand(shipment)}
    return claims


def remaining(trip, claims):
    weight = number(trip.get("available_weight"))
    # Old journeys may have no usable numeric volume. Such journeys are weight
    # limited only; do not invent a volume allowance from a descriptive size label.
    space = number(trip.get("available_space") or 0)
    used_weight = sum((number(c["weight"]) for c in claims.values()), Decimal(0))
    used_space = sum((number(c["space"]) for c in claims.values()), Decimal(0))
    return weight - used_weight, space - used_space if space else None


async def available_trips(db, trips):
    result = []
    for trip in trips:
        if not future_active(trip):
            continue
        try:
            weight, space = remaining(trip, await allocations(db, trip))
        except HTTPException:
            continue  # Do not advertise unknown/invalid legacy capacity.
        if weight <= 0 or (space is not None and space <= 0):
            continue
        public = {k: v for k, v in trip.items() if k not in {"capacity_claims", "capacity_revision"}}
        # These existing API fields now mean what their names promise. Stored
        # values remain the offered totals; no second capacity counter is kept.
        public["available_weight"] = float(weight)
        public["available_space"] = float(space) if space is not None else 0
        result.append(public)
    return result


async def reserve_capacity(db, match):
    if not match.get("trip_id"):
        raise HTTPException(409, "Booking needs a journey before reserving capacity")
    for _ in range(20):
        trip = await db.trips.find_one({"id": match["trip_id"]})
        if not trip or trip.get("traveler_id") != match["traveler_id"] or not future_active(trip):
            raise HTTPException(409, "Journey is no longer available")
        current = await db.matches.find_one({"id": match["id"]})
        if not current or current.get("status") not in {"pending", "accepted", "payment_pending"}:
            raise HTTPException(409, "Match is no longer available for reservation")
        claims = await allocations(db, trip)
        shipment = await db.shipments.find_one({"id": match["shipment_id"]})
        if not shipment:
            raise HTTPException(409, "Shipment is missing")
        claims.setdefault(match["id"], {"match_id": match["id"], **demand(shipment)})
        weight, space = remaining(trip, claims)
        if weight < 0 or (space is not None and space < 0):
            raise HTTPException(409, "Journey does not have enough remaining capacity")
        revision = trip.get("capacity_revision", 0)
        query = {"id": trip["id"], "status": "active", "departure_date": trip["departure_date"],
                 "available_weight": trip["available_weight"],
                 "available_space": trip.get("available_space"),
                 "capacity_revision": revision if "capacity_revision" in trip else {"$exists": False}}
        changed = await db.trips.update_one(query, {"$set": {
            "capacity_claims": list(claims.values()), "capacity_revision": revision + 1}})
        if changed.modified_count:
            return
    raise HTTPException(409, "Journey capacity changed; retry the request")


async def cancel_unpaid_match(db, match, *, expired_session=None):
    """Release via a terminal match state; never infer expiration from wall time.

    Checkout claims payment_pending atomically before provider I/O. Ordinary
    cancellation cannot race it. That state can only be released using a
    provider-confirmed expired/unpaid session, without rotating its attempt.
    """
    shipment = await db.shipments.find_one({"id": match["shipment_id"]})
    if not shipment or shipment.get("status") not in {"pending", "matched"}:
        if expired_session is not None:
            return False
        raise HTTPException(409, "Shipment state requires reconciliation before cancellation")
    query = {"id": match["id"], "status": {"$in": ["pending", "accepted"]},
             "payment_status": {"$nin": list(PAID)}}
    if expired_session is not None:
        if expired_session.get("status") != "expired" or expired_session.get("payment_status") != "unpaid":
            return False
        sid = expired_session.get("id")
        transactions = await db.payment_transactions.find({"match_id": match["id"]}).to_list(None)
        attempt = await db.checkout_attempts.find_one({"_id": match["id"]})
        if (not sid or len(transactions) != 1 or transactions[0].get("session_id") != sid
                or transactions[0].get("payment_status") == "paid"
                or (attempt and attempt.get("session_id") != sid)
                or match.get("payment_intent_id") != sid):
            return False  # Ambiguous legacy/unknown outcomes remain reserved.
        query.update(status="payment_pending", payment_intent_id=sid)
    else:
        # Historical accepted rows can already have an external payment attempt.
        if (match.get("payment_intent_id") or await db.checkout_attempts.find_one({"_id": match["id"]})
                or await db.payment_transactions.find_one({"match_id": match["id"]})):
            raise HTTPException(409, "Payment attempt must be resolved before cancellation")
    changed = await db.matches.update_one(query, {"$set": {"status": "cancelled"}})
    if not changed.modified_count:
        if expired_session is not None:
            return False
        raise HTTPException(409, "Only unpaid bookings without an active checkout may be cancelled")
    await db.shipments.update_one(
        {"id": match["shipment_id"], "status": "matched", "assigned_match_id": match["id"],
         "payment_recorded_match_id": {"$ne": match["id"]}},
        {"$set": {"status": "pending"}, "$unset": {"assigned_match_id": ""}})
    return True
