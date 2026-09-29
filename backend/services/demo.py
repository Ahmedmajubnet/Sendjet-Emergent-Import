"""Idempotent, explicitly marked demo data. Never adopt or remove legacy data."""
from datetime import datetime, timedelta, timezone
from pymongo.errors import DuplicateKeyError
from .demo_templates import traveler_personas, sender_personas, trip_templates, shipment_templates

SEED_VERSION = 3


async def _insert_demo(collection, record):
    # Mongo's unique _id serializes concurrent upserts; a non-demo collision is
    # protected by the predicate and must never be adopted or overwritten.
    try:
        await collection.update_one(
            {"_id": record["_id"], "is_demo": True},
            {"$setOnInsert": record}, upsert=True,
        )
    except DuplicateKeyError:
        pass
    saved = await collection.find_one({"_id": record["_id"], "is_demo": True})
    return saved


async def seed_demo_data(db):
    now = datetime.now(timezone.utc)
    for kind, personas, templates in (
        ("traveler", traveler_personas, trip_templates),
        ("sender", sender_personas, shipment_templates),
    ):
        for index, (persona, template) in enumerate(zip(personas, templates)):
            user_id = f"sendjet-demo:{kind}:{index}"
            # These addresses are display data, never an ownership predicate.
            email = f"demo-{kind}-{index}@demo.sendjet.com"
            conflict = await db.users.find_one({"email": email, "_id": {"$ne": user_id}})
            if conflict:
                continue
            user = await _insert_demo(db.users, {
                "_id": user_id, "id": user_id, "is_demo": True, "seed_version": SEED_VERSION,
                "email": email, "password_hash": "nologin", "full_name": persona["name"],
                "role": "user", "is_verified": True, "verification_status": "verified",
                "rating": persona["rating"], "total_reviews": persona["reviews"],
                "created_at": now,
            })
            if not user:
                continue
            listing_id = f"sendjet-demo:{'trip' if kind == 'traveler' else 'shipment'}:{index}"
            listing = {"_id": listing_id, "id": listing_id, "is_demo": True,
                       "seed_version": SEED_VERSION, "created_at": now,
                       "origin": template["origin"], "destination": template["destination"]}
            if kind == "traveler":
                listing.update({k: template[k] for k in ("transport_mode", "available_weight", "available_space", "price_per_kg", "notes")})
                listing.update(traveler_id=user_id, status="active",
                               departure_date=now + timedelta(days=template["dep_days"]),
                               arrival_date=now + timedelta(days=template["arr_days"]))
                await _insert_demo(db.trips, listing)
            else:
                listing.update({k: template[k] for k in ("description", "weight", "dimensions", "declared_value")})
                listing.update(sender_id=user_id, status="pending", photos=[],
                               pickup_date=now + timedelta(days=template["pickup_days"]),
                               delivery_deadline=now + timedelta(days=template["deadline_days"]))
                await _insert_demo(db.shipments, listing)


async def refresh_demo_listings(db):
    now = datetime.now(timezone.utc)
    for collection, date_field, end_field, available in (
        (db.trips, "departure_date", "arrival_date", "active"),
        (db.shipments, "pickup_date", "delivery_deadline", "pending"),
    ):
        query = {"is_demo": True, "status": {"$in": [available, "expired"]},
                 "assigned_match_id": {"$in": [None, ""]},
                 "$or": [{date_field: {"$lt": now}}, {"status": "expired"}]}
        async for record in collection.find(query):
            # Even a marked demo listing may have a real booking attached.
            reference = "trip_id" if date_field == "departure_date" else "shipment_id"
            if await db.matches.find_one({reference: record["id"]}):
                continue
            new_date = now + timedelta(days=7)
            # Repeat all predicates in the write so another worker's refresh or
            # an accepted match cannot be overwritten after this read.
            await collection.update_one({**query, "_id": record["_id"], date_field: record.get(date_field)},
                {"$set": {date_field: new_date, end_field: new_date + timedelta(days=1),
                          "status": available, "updated_at": now}})
