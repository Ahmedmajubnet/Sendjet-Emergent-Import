"""Display-only sample templates; ownership is never inferred from these emails."""
traveler_personas = [
    {"name": "Sarah Johnson",     "email": "sarah.j@demo.sendjet.com",     "phone": "+1-212-555-0101",   "rating": 4.9, "reviews": 18},
    {"name": "Omar Hassan",       "email": "omar.h@demo.sendjet.com",      "phone": "+20-100-555-0102",  "rating": 4.8, "reviews": 12},
    {"name": "Yuki Tanaka",       "email": "yuki.t@demo.sendjet.com",      "phone": "+81-90-5551-0103",  "rating": 5.0, "reviews": 9},
    {"name": "James Mitchell",    "email": "james.m@demo.sendjet.com",     "phone": "+44-7700-900104",   "rating": 4.7, "reviews": 22},
    {"name": "Ahmed Al-Rashid",   "email": "ahmed.ar@demo.sendjet.com",    "phone": "+966-50-555-0105",  "rating": 4.6, "reviews": 7},
    {"name": "Lars Schmidt",      "email": "lars.s@demo.sendjet.com",      "phone": "+49-171-5550106",   "rating": 4.8, "reviews": 14},
    {"name": "Wei Tan",           "email": "wei.t@demo.sendjet.com",       "phone": "+65-8555-0107",     "rating": 4.9, "reviews": 11},
    {"name": "Fatima Saleh",      "email": "fatima.s@demo.sendjet.com",    "phone": "+961-3-555108",     "rating": 4.5, "reviews": 5},
    {"name": "Dmitri Volkov",     "email": "dmitri.v@demo.sendjet.com",    "phone": "+7-903-555-0109",   "rating": 4.7, "reviews": 16},
    {"name": "Emma Wilson",       "email": "emma.w@demo.sendjet.com",      "phone": "+61-400-555-110",   "rating": 4.9, "reviews": 20},
    {"name": "Carlos Mendez",     "email": "carlos.m@demo.sendjet.com",    "phone": "+34-600-555-111",   "rating": 4.8, "reviews": 8},
    {"name": "Priya Sharma",      "email": "priya.s@demo.sendjet.com",     "phone": "+91-98765-55112",   "rating": 4.6, "reviews": 13},
]
sender_personas = [
    {"name": "Leila Mansour",     "email": "leila.m@demo.sendjet.com",     "phone": "+971-50-555-0201",  "rating": 4.7, "reviews": 6},
    {"name": "Pierre Dubois",     "email": "pierre.d@demo.sendjet.com",    "phone": "+33-6-5555-0202",   "rating": 4.9, "reviews": 15},
    {"name": "Aylin Demir",       "email": "aylin.d@demo.sendjet.com",     "phone": "+90-532-555-0203",  "rating": 4.8, "reviews": 10},
    {"name": "Khalid Al-Amri",    "email": "khalid.a@demo.sendjet.com",    "phone": "+966-55-555-0204",  "rating": 4.6, "reviews": 4},
    {"name": "David Martinez",    "email": "david.m@demo.sendjet.com",     "phone": "+1-415-555-0205",   "rating": 5.0, "reviews": 21},
    {"name": "Noha Ibrahim",      "email": "noha.i@demo.sendjet.com",      "phone": "+20-122-555-0206",  "rating": 4.7, "reviews": 9},
    {"name": "Min-jun Kim",       "email": "minjun.k@demo.sendjet.com",    "phone": "+82-10-5555-0207",  "rating": 4.8, "reviews": 12},
    {"name": "Aisyah Binti",      "email": "aisyah.b@demo.sendjet.com",    "phone": "+60-12-555-0208",   "rating": 4.5, "reviews": 3},
    {"name": "Oliver Thompson",   "email": "oliver.t@demo.sendjet.com",    "phone": "+44-7700-900209",   "rating": 4.9, "reviews": 17},
    {"name": "Anna Kuznetsova",   "email": "anna.k@demo.sendjet.com",      "phone": "+7-916-555-0210",   "rating": 4.6, "reviews": 8},
    {"name": "Hiroshi Sato",      "email": "hiroshi.s@demo.sendjet.com",   "phone": "+81-80-5555-0211",  "rating": 4.8, "reviews": 11},
    {"name": "Sofia Rossi",       "email": "sofia.r@demo.sendjet.com",     "phone": "+39-333-555-0212",  "rating": 4.7, "reviews": 6},
]

# Trip templates — only route/mode combinations that are physically plausible.
# Demo data should never suggest that a car, bus or train crosses an ocean or
# uses a route without a realistic overland/rail connection.
trip_templates = [
    # Plane
    {"origin": {"lat": 40.7128, "lng": -74.0060, "address": "New York, United States"}, "destination": {"lat": 51.5074, "lng": -0.1278, "address": "London, United Kingdom"}, "dep_days": 7, "arr_days": 8, "available_weight": 20, "available_space": 60, "price_per_kg": 15, "notes": "Direct flight. Extra baggage space available.", "transport_mode": "plane"},
    {"origin": {"lat": 30.0444, "lng": 31.2357, "address": "Cairo, Egypt"}, "destination": {"lat": 25.2048, "lng": 55.2708, "address": "Dubai, UAE"}, "dep_days": 5, "arr_days": 5, "available_weight": 15, "available_space": 50, "price_per_kg": 8, "notes": "Direct flight. Small and medium parcels welcome.", "transport_mode": "plane"},
    {"origin": {"lat": 52.5200, "lng": 13.4050, "address": "Berlin, Germany"}, "destination": {"lat": 41.0082, "lng": 28.9784, "address": "Istanbul, Turkey"}, "dep_days": 10, "arr_days": 10, "available_weight": 12, "available_space": 45, "price_per_kg": 9, "notes": "Flight to Istanbul. Medium parcel capacity.", "transport_mode": "plane"},

    # Train
    {"origin": {"lat": 51.5074, "lng": -0.1278, "address": "London, United Kingdom"}, "destination": {"lat": 48.8566, "lng": 2.3522, "address": "Paris, France"}, "dep_days": 3, "arr_days": 3, "available_weight": 10, "available_space": 40, "price_per_kg": 12, "notes": "Eurostar journey. Small parcels preferred.", "transport_mode": "train"},
    {"origin": {"lat": 52.5200, "lng": 13.4050, "address": "Berlin, Germany"}, "destination": {"lat": 53.5511, "lng": 9.9937, "address": "Hamburg, Germany"}, "dep_days": 4, "arr_days": 4, "available_weight": 8, "available_space": 30, "price_per_kg": 6, "notes": "Direct intercity train. Easy station handover.", "transport_mode": "train"},
    {"origin": {"lat": 41.9028, "lng": 12.4964, "address": "Rome, Italy"}, "destination": {"lat": 45.4642, "lng": 9.1900, "address": "Milan, Italy"}, "dep_days": 8, "arr_days": 8, "available_weight": 9, "available_space": 35, "price_per_kg": 7, "notes": "High-speed train. Documents and compact parcels welcome.", "transport_mode": "train"},

    # Car
    {"origin": {"lat": 52.5200, "lng": 13.4050, "address": "Berlin, Germany"}, "destination": {"lat": 52.2297, "lng": 21.0122, "address": "Warsaw, Poland"}, "dep_days": 6, "arr_days": 6, "available_weight": 25, "available_space": 80, "price_per_kg": 6, "notes": "Driving via the A12/A2 corridor. Can arrange pickup along the route.", "transport_mode": "car"},
    {"origin": {"lat": 48.1351, "lng": 11.5820, "address": "Munich, Germany"}, "destination": {"lat": 50.0755, "lng": 14.4378, "address": "Prague, Czechia"}, "dep_days": 9, "arr_days": 9, "available_weight": 20, "available_space": 70, "price_per_kg": 5, "notes": "Road trip to Prague. Flexible pickup for small parcels.", "transport_mode": "car"},
    {"origin": {"lat": 48.2082, "lng": 16.3738, "address": "Vienna, Austria"}, "destination": {"lat": 47.4979, "lng": 19.0402, "address": "Budapest, Hungary"}, "dep_days": 11, "arr_days": 11, "available_weight": 18, "available_space": 60, "price_per_kg": 5, "notes": "Direct road journey. Space for small and medium parcels.", "transport_mode": "car"},

    # Bus
    {"origin": {"lat": 1.3521, "lng": 103.8198, "address": "Singapore"}, "destination": {"lat": 3.1390, "lng": 101.6869, "address": "Kuala Lumpur, Malaysia"}, "dep_days": 2, "arr_days": 2, "available_weight": 5, "available_space": 20, "price_per_kg": 7, "notes": "Cross-border coach trip. Documents and compact parcels only.", "transport_mode": "bus"},
    {"origin": {"lat": 52.5200, "lng": 13.4050, "address": "Berlin, Germany"}, "destination": {"lat": 50.0755, "lng": 14.4378, "address": "Prague, Czechia"}, "dep_days": 7, "arr_days": 7, "available_weight": 7, "available_space": 25, "price_per_kg": 6, "notes": "Direct coach journey. Small parcel capacity.", "transport_mode": "bus"},
    {"origin": {"lat": 40.4168, "lng": -3.7038, "address": "Madrid, Spain"}, "destination": {"lat": 41.3874, "lng": 2.1686, "address": "Barcelona, Spain"}, "dep_days": 12, "arr_days": 12, "available_weight": 8, "available_space": 30, "price_per_kg": 6, "notes": "Intercity coach. Compact parcels preferred.", "transport_mode": "bus"},
]
shipment_templates = [
    {"description": "Birthday gift package for family",       "weight": 3,   "dimensions": {"length": 30, "width": 20, "height": 15}, "origin": {"lat": 25.2048, "lng": 55.2708, "address": "Dubai, UAE"},               "destination": {"lat": 30.0444, "lng": 31.2357, "address": "Cairo, Egypt"},               "pickup_days": 4, "deadline_days": 10, "declared_value": 150},
    {"description": "Important business documents",           "weight": 1,   "dimensions": {"length": 35, "width": 25, "height": 5},  "origin": {"lat": 48.8566, "lng": 2.3522,  "address": "Paris, France"},             "destination": {"lat": 51.5074, "lng": -0.1278, "address": "London, United Kingdom"},     "pickup_days": 2, "deadline_days": 5,  "declared_value": 50},
    {"description": "Handmade jewelry collection",            "weight": 0.5, "dimensions": {"length": 20, "width": 15, "height": 10}, "origin": {"lat": 41.0082, "lng": 28.9784, "address": "Istanbul, Turkey"},         "destination": {"lat": 52.5200, "lng": 13.4050, "address": "Berlin, Germany"},            "pickup_days": 6, "deadline_days": 12, "declared_value": 500},
    {"description": "Traditional spices and tea",             "weight": 5,   "dimensions": {"length": 40, "width": 30, "height": 20}, "origin": {"lat": 24.7136, "lng": 46.6753, "address": "Riyadh, Saudi Arabia"},     "destination": {"lat": 25.2048, "lng": 55.2708, "address": "Dubai, UAE"},                 "pickup_days": 3, "deadline_days": 7,  "declared_value": 80},
    {"description": "Laptop and accessories for remote work", "weight": 4,   "dimensions": {"length": 45, "width": 35, "height": 15}, "origin": {"lat": 40.7128, "lng": -74.0060,"address": "New York, United States"},   "destination": {"lat": 34.0522, "lng": -118.2437,"address": "Los Angeles, United States"},"pickup_days": 5, "deadline_days": 8,  "declared_value": 1200},
    {"description": "Baby clothes and toys",                  "weight": 2,   "dimensions": {"length": 50, "width": 40, "height": 30}, "origin": {"lat": 30.0444, "lng": 31.2357, "address": "Cairo, Egypt"},              "destination": {"lat": 31.2001, "lng": 29.9187, "address": "Alexandria, Egypt"},          "pickup_days": 1, "deadline_days": 3,  "declared_value": 120},
    {"description": "University textbooks",                   "weight": 6,   "dimensions": {"length": 35, "width": 25, "height": 20}, "origin": {"lat": 37.5665, "lng": 126.9780,"address": "Seoul, South Korea"},        "destination": {"lat": 35.6762, "lng": 139.6503,"address": "Tokyo, Japan"},               "pickup_days": 7, "deadline_days": 14, "declared_value": 200},
    {"description": "Organic skincare products",              "weight": 1.5, "dimensions": {"length": 25, "width": 20, "height": 15}, "origin": {"lat": 3.1390,  "lng": 101.6869,"address": "Kuala Lumpur, Malaysia"},     "destination": {"lat": 1.3521,  "lng": 103.8198,"address": "Singapore"},                  "pickup_days": 3, "deadline_days": 6,  "declared_value": 90},
    {"description": "Vintage vinyl records collection",       "weight": 8,   "dimensions": {"length": 35, "width": 35, "height": 25}, "origin": {"lat": 51.5074, "lng": -0.1278, "address": "London, United Kingdom"},     "destination": {"lat": 40.7128, "lng": -74.0060,"address": "New York, United States"},    "pickup_days": 9, "deadline_days": 15, "declared_value": 350},
    {"description": "Medical supplies and vitamins",          "weight": 2.5, "dimensions": {"length": 30, "width": 25, "height": 20}, "origin": {"lat": 55.7558, "lng": 37.6173, "address": "Moscow, Russia"},            "destination": {"lat": 50.4501, "lng": 30.5234, "address": "Kyiv, Ukraine"},              "pickup_days": 5, "deadline_days": 10, "declared_value": 180},
    {"description": "Home-cooked snacks for a relative",      "weight": 3.5, "dimensions": {"length": 30, "width": 25, "height": 20}, "origin": {"lat": 35.6762, "lng": 139.6503,"address": "Tokyo, Japan"},              "destination": {"lat": 34.6937, "lng": 135.5023,"address": "Osaka, Japan"},               "pickup_days": 2, "deadline_days": 5,  "declared_value": 60},
    {"description": "Leather handbag (designer)",             "weight": 1.2, "dimensions": {"length": 40, "width": 30, "height": 15}, "origin": {"lat": 41.9028, "lng": 12.4964, "address": "Rome, Italy"},               "destination": {"lat": 45.4642, "lng": 9.1900,  "address": "Milan, Italy"},               "pickup_days": 4, "deadline_days": 8,  "declared_value": 900},
]
