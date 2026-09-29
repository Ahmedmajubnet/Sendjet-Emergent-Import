"""Read-only booking audit. No server import, dotenv loading, or repair operations."""
import argparse
from collections import Counter
from datetime import datetime, timedelta, timezone
import json
import os

ACTIVE = ["pending", "accepted", "payment_pending", "paid", "in_progress", "completed"]


def audit_bookings(db):
    totals = Counter()
    findings = []
    inspected = 0
    for match in db.matches.find({"status": {"$in": ACTIVE}}, {
        "_id": 0, "id": 1, "status": 1, "payment_status": 1,
        "shipment_id": 1, "trip_id": 1, "sender_id": 1, "traveler_id": 1,
    }):
        inspected += 1
        reasons = set()
        mid, sid = match.get("id"), match.get("shipment_id")
        state = match.get("status")
        shipment = db.shipments.find_one({"id": sid}, {
            "_id": 0, "status": 1, "assigned_match_id": 1, "sender_id": 1,
        }) if sid else None
        traveler = match.get("traveler_id")
        sender = match.get("sender_id")
        if not sender or not db.users.find_one({"id": sender}, {"_id": 1}):
            reasons.add("missing_sender")
        if not traveler or not db.users.find_one({"id": traveler}, {"_id": 1}):
            reasons.add("missing_traveler")
        if not shipment:
            reasons.add("missing_shipment")
        elif state != "pending":
            if shipment.get("assigned_match_id") != mid:
                reasons.add("missing_or_conflicting_assignment")
            if shipment.get("sender_id") != match.get("sender_id"):
                reasons.add("sender_mismatch")
        if match.get("trip_id"):
            trip = db.trips.find_one({"id": match["trip_id"]}, {"_id": 0, "traveler_id": 1})
            if not trip or trip.get("traveler_id") != traveler:
                reasons.add("missing_or_conflicting_trip")
        if state != "pending" and not db.shipment_private_details.find_one({
            "shipment_id": sid, "recipient_name": {"$exists": True, "$nin": [None, ""]},
            "recipient_email": {"$exists": True, "$nin": [None, ""]},
        }, {"_id": 1}):
            reasons.add("missing_private_recipient")
        transactions = list(db.payment_transactions.find({"match_id": mid}, {
            "_id": 0, "session_id": 1, "payment_status": 1,
        }))
        attempt = db.checkout_attempts.find_one({"_id": mid}, {"session_id": 1, "created_at": 1})
        if attempt and not attempt.get("session_id"):
            created = attempt.get("created_at")
            if isinstance(created, datetime):
                created = created if created.tzinfo else created.replace(tzinfo=timezone.utc)
            if not isinstance(created, datetime) or datetime.now(timezone.utc) - created > timedelta(hours=23):
                reasons.add("unresolved_checkout_outcome")
        paid = [t for t in transactions if t.get("payment_status") == "paid"]
        if len(transactions) > 1:
            reasons.add("multiple_payment_attempts_review_stripe")
        if (state in {"paid", "in_progress", "completed"} and
                (not paid or match.get("payment_status") not in {"escrowed", "released"})):
            reasons.add("paid_state_without_payment_evidence")
        if state in {"pending", "accepted", "payment_pending"} and (paid or match.get("payment_status") in {"escrowed", "released"}):
            reasons.add("payment_not_reconciled")
        allowed = {"accepted": {"matched"}, "payment_pending": {"matched"}, "paid": {"matched"},
                   "in_progress": {"picked_up", "in_transit", "arrived"}, "completed": {"delivered"}}
        if shipment and state in allowed and shipment.get("status") not in allowed[state]:
            reasons.add("shipment_match_state_mismatch")
        if state in {"paid", "in_progress", "completed"} or paid:
            confirmation = db.shipment_confirmations.find_one({"shipment_id": sid, "match_id": mid}, {
                "_id": 0, "sender_id": 1, "traveler_id": 1, "pickup_confirmed_at": 1, "delivery_confirmed_at": 1,
            })
            if not confirmation:
                reasons.add("missing_confirmation_record")
            else:
                if confirmation.get("traveler_id") != traveler or confirmation.get("sender_id") != match.get("sender_id"):
                    reasons.add("confirmation_assignment_mismatch")
                if state in {"in_progress", "completed"} and not confirmation.get("pickup_confirmed_at"):
                    reasons.add("handover_without_pickup_confirmation")
                if state == "completed" and not confirmation.get("delivery_confirmed_at"):
                    reasons.add("delivery_without_confirmation")
        if reasons:
            totals.update(reasons)
            findings.append({"match_id": mid, "shipment_id": sid, "status": state,
                             "shipment_status": shipment.get("status") if shipment else None,
                             "reasons": sorted(reasons)})
    return {"inspected_matches": inspected, "affected_matches": len(findings),
            "totals_by_category": dict(sorted(totals.items())), "findings": findings}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database", required=True)
    parser.add_argument("--uri-env", default="SENDJET_AUDIT_MONGO_URL",
                        help="Environment variable holding a read-only Mongo URI; never printed")
    args = parser.parse_args()
    uri = os.environ.get(args.uri_env)
    if not uri:
        parser.error("The audit URI environment variable is missing")
    # Use a Mongo principal with only the read role as an additional safeguard.
    from pymongo import MongoClient
    try:
        with MongoClient(uri, serverSelectionTimeoutMS=10000, tz_aware=True) as client:
            report = audit_bookings(client[args.database])
        print(json.dumps(report, indent=2))
    except Exception:
        parser.exit(2, "Audit failed; check connectivity and read permissions. No credentials or provider details are printed.\n")


if __name__ == "__main__":
    main()
