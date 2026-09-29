from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Request, Response, WebSocket, WebSocketDisconnect, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any, Set
from datetime import datetime, timedelta, timezone
from passlib.context import CryptContext
from jose import JWTError, jwt
import os
import uuid
import logging
import secrets
import hashlib
from pymongo.errors import DuplicateKeyError
from pathlib import Path
from dotenv import load_dotenv
import json
import base64
import re
from urllib.parse import urlsplit
from config import load_settings
from services.demo import seed_demo_data, refresh_demo_listings
from services.payments import StripeGateway, checkout_for_match, verify_webhook, validate_payment_session
import httpx

# Email subsystem (provider-agnostic, Resend by default; falls back to no-op
# when RESEND_API_KEY is unset so preview/dev never crashes on signup).
from services.email import get_email_service, EmailService
from services.email import tokens as email_tokens

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')
settings = load_settings()  # Validate before constructing any database client.

EMERGENT_AUTH_SESSION_URL = os.environ.get(
    "EMERGENT_AUTH_SESSION_URL",
    "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
)

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url, tz_aware=True)
db = client[os.environ['DB_NAME']]

# Security setup
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()
SECRET_KEY = settings.secret_key
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

def generate_confirmation_code() -> str:
    return f"{secrets.randbelow(900000) + 100000:06d}"


def hash_confirmation_code(code: str) -> str:
    return hashlib.sha256(
        f"{SECRET_KEY}:{code}".encode("utf-8")
    ).hexdigest()

# One validated configuration path for every Stripe operation.
stripe_api_key = settings.stripe_key
PAYMENTS_ENABLED = bool(stripe_api_key)
stripe_gateway = StripeGateway(stripe_api_key, settings.stripe_live)


def _ensure_payments_enabled():
    if not stripe_api_key:
        raise HTTPException(
            status_code=503,
            detail="Payments are unavailable: no Stripe key configured.",
        )

app = FastAPI(title="SendJet API", version="1.0.0")
api_router = APIRouter(prefix="/api")

# Shipment-based WebSocket Connection Manager
class ShipmentChatManager:
    def __init__(self):
        # shipment_id -> {user_id: websocket}
        self.shipment_connections: Dict[str, Dict[str, WebSocket]] = {}
        # user_id -> {shipment_id: websocket} for quick user lookups
        self.user_connections: Dict[str, Dict[str, WebSocket]] = {}
        
    async def connect_to_shipment(self, websocket: WebSocket, shipment_id: str, user_id: str):
        await websocket.accept()
        
        # Initialize shipment room if not exists
        if shipment_id not in self.shipment_connections:
            self.shipment_connections[shipment_id] = {}
            
        # Initialize user connections if not exists
        if user_id not in self.user_connections:
            self.user_connections[user_id] = {}
            
        # Add connection to both mappings
        self.shipment_connections[shipment_id][user_id] = websocket
        self.user_connections[user_id][shipment_id] = websocket
        
        # Notify others in the shipment that user joined
        await self.broadcast_to_shipment(shipment_id, {
            "type": "user_joined",
            "user_id": user_id,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }, exclude_user=user_id)
        
    def disconnect_from_shipment(self, shipment_id: str, user_id: str):
        # Remove from shipment connections
        if shipment_id in self.shipment_connections:
            if user_id in self.shipment_connections[shipment_id]:
                del self.shipment_connections[shipment_id][user_id]
                
            # Clean up empty shipment rooms
            if not self.shipment_connections[shipment_id]:
                del self.shipment_connections[shipment_id]
                
        # Remove from user connections
        if user_id in self.user_connections:
            if shipment_id in self.user_connections[user_id]:
                del self.user_connections[user_id][shipment_id]
                
            # Clean up empty user connections
            if not self.user_connections[user_id]:
                del self.user_connections[user_id]
                
    async def broadcast_to_shipment(self, shipment_id: str, message: dict, exclude_user: str = None):
        """Send message to all users connected to a shipment chat"""
        if shipment_id not in self.shipment_connections:
            return
            
        disconnected_users = []
        
        for user_id, websocket in self.shipment_connections[shipment_id].items():
            if exclude_user and user_id == exclude_user:
                continue
                
            try:
                await websocket.send_text(json.dumps(message))
            except Exception:
                disconnected_users.append(user_id)
                
        # Clean up disconnected users
        for user_id in disconnected_users:
            self.disconnect_from_shipment(shipment_id, user_id)
            
    async def send_to_user_in_shipment(self, shipment_id: str, user_id: str, message: dict):
        """Send message to specific user in a shipment chat"""
        if (shipment_id in self.shipment_connections and 
            user_id in self.shipment_connections[shipment_id]):
            try:
                websocket = self.shipment_connections[shipment_id][user_id]
                await websocket.send_text(json.dumps(message))
                return True
            except Exception:
                self.disconnect_from_shipment(shipment_id, user_id)
        return False
        
    def get_connected_users(self, shipment_id: str) -> List[str]:
        """Get list of users currently connected to a shipment chat"""
        if shipment_id in self.shipment_connections:
            return list(self.shipment_connections[shipment_id].keys())
        return []

chat_manager = ShipmentChatManager()

# Global notification manager for real-time notifications
class NotificationManager:
    def __init__(self):
        # user_id -> list of active sockets (supports multiple tabs/devices)
        self.user_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.user_connections.setdefault(user_id, []).append(websocket)
        print(f"User {user_id} connected to notifications")

    def disconnect(self, user_id: str, websocket: Optional[WebSocket] = None):
        sockets = self.user_connections.get(user_id, [])
        if websocket is None:
            sockets = []
        else:
            sockets = [ws for ws in sockets if ws is not websocket]
        if sockets:
            self.user_connections[user_id] = sockets
        else:
            self.user_connections.pop(user_id, None)
        print(f"User {user_id} disconnected from notifications")

    async def send_notification(self, user_id: str, notification: dict):
        """Persist and push a notification to every active tab/device for the user."""
        raw_created_at = notification.get("timestamp")
        if isinstance(raw_created_at, str):
            try:
                created_at = datetime.fromisoformat(raw_created_at.replace("Z", "+00:00"))
                if created_at.tzinfo is None:
                    created_at = created_at.replace(tzinfo=timezone.utc)
            except ValueError:
                created_at = datetime.now(timezone.utc)
        elif isinstance(raw_created_at, datetime):
            created_at = raw_created_at if raw_created_at.tzinfo else raw_created_at.replace(tzinfo=timezone.utc)
        else:
            created_at = datetime.now(timezone.utc)
        notif_doc = {
            "id": notification.get("id", str(uuid.uuid4())),
            "user_id": user_id,
            "type": notification.get("type", "general"),
            "title": notification.get("title", ""),
            "message": notification.get("message", ""),
            "link": notification.get("link", ""),
            "match_id": notification.get("match_id", ""),
            "read": False,
            "created_at": created_at,
        }
        await db.notifications.insert_one(notif_doc)

        sockets = list(self.user_connections.get(user_id, []))
        delivered = False
        stale = []
        for websocket in sockets:
            try:
                await websocket.send_text(json.dumps(notification))
                delivered = True
            except Exception as exc:
                print(f"Failed to send notification to {user_id}: {exc}")
                stale.append(websocket)
        for websocket in stale:
            self.disconnect(user_id, websocket)
        return delivered

    async def broadcast_to_users(self, user_ids: List[str], notification: dict):
        for user_id in user_ids:
            await self.send_notification(user_id, notification)

notification_manager = NotificationManager()


class DirectMessageManager:
    """Authenticated real-time channel for the unified 1:1 messaging system."""
    def __init__(self):
        self.user_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.user_connections.setdefault(user_id, []).append(websocket)

    def disconnect(self, user_id: str, websocket: Optional[WebSocket] = None):
        sockets = self.user_connections.get(user_id, [])
        if websocket is None:
            sockets = []
        else:
            sockets = [ws for ws in sockets if ws is not websocket]
        if sockets:
            self.user_connections[user_id] = sockets
        else:
            self.user_connections.pop(user_id, None)

    async def send_to_users(self, user_ids: List[str], event: dict):
        for user_id in user_ids:
            stale = []
            for websocket in list(self.user_connections.get(user_id, [])):
                try:
                    await websocket.send_text(json.dumps(event, default=str))
                except Exception:
                    stale.append(websocket)
            for websocket in stale:
                self.disconnect(user_id, websocket)

direct_message_manager = DirectMessageManager()

# Models
class UserRole(str):
    USER = "user"
    ADMIN = "admin"

class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    full_name: str
    role: str
    phone: Optional[str] = None
    avatar: Optional[str] = None
    rating: float = 0.0
    total_reviews: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_verified: bool = False
    verification_status: str = "pending"  # pending, id_requested, id_submitted, verified, rejected
    id_document_url: Optional[str] = None
    admin_note: Optional[str] = None
    email_verified: bool = False
    email_verified_at: Optional[str] = None
    accepted_terms_at: Optional[str] = None
    terms_version: Optional[str] = None

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    phone: Optional[str] = None
    terms_accepted: bool = False

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class DeleteAccountIn(BaseModel):
    confirm_email: EmailStr
    current_password: Optional[str] = None

class Trip(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    traveler_id: str
    transport_mode: str = "plane"  # plane, car, train, bus
    origin: Dict[str, Any]  # {lat, lng, address}
    destination: Dict[str, Any]  # {lat, lng, address}
    departure_date: datetime
    departure_time: Optional[str] = None
    available_weight: float
    # Legacy numeric field kept for backward compatibility. New UI uses capacity_size.
    available_space: float = 0.0
    capacity_size: Optional[str] = None  # small, medium, large, xlarge
    pricing_model: str = "per_kg"  # per_kg, fixed
    price_per_kg: Optional[float] = None
    fixed_price: Optional[float] = None
    route_stops: Optional[str] = None
    pickup_along_route: bool = False
    description: Optional[str] = None
    status: str = "active"  # active, completed, cancelled
    visibility: str = "public"  # public or private (match-only)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    # Enrichment fields populated on the public marketplace endpoint (not stored).
    traveler_name: Optional[str] = None
    traveler_avatar: Optional[str] = None
    traveler_rating: Optional[float] = None
    traveler_reviews: Optional[int] = None

class TripCreate(BaseModel):
    transport_mode: str = "plane"
    origin: Dict[str, Any]
    destination: Dict[str, Any]
    departure_date: datetime
    departure_time: Optional[str] = None
    available_weight: float
    available_space: Optional[float] = None
    capacity_size: Optional[str] = None
    pricing_model: str = "per_kg"
    price_per_kg: Optional[float] = None
    fixed_price: Optional[float] = None
    route_stops: Optional[str] = None
    pickup_along_route: bool = False
    description: Optional[str] = None
    visibility: str = "public"  # public or private (match-only)

class Shipment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sender_id: str
    origin: Dict[str, Any]
    destination: Dict[str, Any]
    description: str
    weight: float
    dimensions: Dict[str, float]  # {length, width, height}
    declared_value: float
    insurance_required: bool = False
    pickup_date: datetime
    photos: List[str] = Field(default_factory=list)  # base64-encoded data URLs of shipment photos
    photo_count: Optional[int] = None  # convenience field used by list endpoints (full count even when photos[] is trimmed)
    status: str = "pending"  # pending, matched, picked_up, in_transit, arrived, delivered, cancelled
    visibility: str = "public"  # public or private (match-only)
    status_history: List[Dict[str, Any]] = Field(default_factory=list)  # [{status, timestamp, notes, location}]
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    # Enrichment fields populated on the public marketplace endpoint (not stored).
    sender_name: Optional[str] = None
    sender_avatar: Optional[str] = None
    sender_rating: Optional[float] = None
    sender_reviews: Optional[int] = None

class ShipmentCreate(BaseModel):
    origin: Dict[str, Any]
    destination: Dict[str, Any]
    description: str
    weight: float
    dimensions: Dict[str, float]
    declared_value: float
    insurance_required: bool = False
    pickup_date: datetime
    photos: List[str] = Field(default_factory=list)
    visibility: str = "public"  # public or private (match-only)
    recipient_name: Optional[str] = None
    recipient_email: Optional[EmailStr] = None

class Match(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    trip_id: Optional[str] = None  # Make optional for direct matches
    shipment_id: str
    traveler_id: str
    sender_id: str
    requested_by: str = ""  # user_id of who initiated the request
    price_agreed: float
    status: str = "pending"  # pending, accepted, payment_pending, paid, in_progress, completed, cancelled, rejected
    payment_status: str = "unpaid"  # unpaid, escrowed, released, refunded
    payment_intent_id: Optional[str] = None  # Stripe payment intent
    platform_commission_percent: float = 10.0  # 10% commission
    platform_commission_amount: float = 0.0
    traveler_payout_amount: float = 0.0
    conversation_id: Optional[str] = None  # Direct message conversation that led to this booking
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    paid_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

# Review model
class Review(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    match_id: str
    shipment_id: str
    reviewer_id: str
    reviewed_user_id: str
    reviewer_name: str = ""
    reviewer_role: str = ""
    rating: int  # 1-5
    comment: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Shipment-based messaging models
class ShipmentMessage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    shipment_id: str
    sender_id: str  # User who sent the message
    message_type: str = "user"  # "user" or "system"
    content: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    read_by: List[str] = Field(default_factory=list)  # List of user IDs who have read this message
    metadata: Optional[Dict[str, Any]] = None  # For system messages

class ShipmentMessageCreate(BaseModel):
    shipment_id: str
    content: str
    message_type: str = "user"
    metadata: Optional[Dict[str, Any]] = None

class ShipmentChatThread(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    shipment_id: str
    participants: List[str]  # List of user IDs (sender, traveler, admins)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_message_at: Optional[datetime] = None
    is_active: bool = True

# System message types
class SystemMessageType:
    SHIPMENT_CREATED = "shipment_created"
    MATCH_ACCEPTED = "match_accepted"
    PAYMENT_COMPLETED = "payment_completed"
    PACKAGE_PICKED_UP = "package_picked_up"
    IN_TRANSIT = "in_transit"
    DELIVERED = "delivered"
    ISSUE_REPORTED = "issue_reported"

# Direct messaging models (user-to-user)
class DirectConversation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    participant_ids: List[str]  # Two user IDs
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_message_at: Optional[datetime] = None

class DirectMessage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    conversation_id: str
    sender_id: str
    content: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    read_by: List[str] = Field(default_factory=list)

class DirectMessageCreate(BaseModel):
    content: str

# Utility functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = await db.users.find_one({"id": user_id})
    if user is None:
        raise credentials_exception
    return User(**user)

async def get_websocket_user(token: str) -> Optional[User]:
    """Authenticate a WebSocket using the same JWT used by HTTP requests."""
    if not token:
        return None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            return None
        user = await db.users.find_one({"id": user_id})
        return User(**user) if user else None
    except JWTError:
        return None

async def verify_shipment_access(shipment_id: str, user: User) -> dict:
    """Verify user has access to shipment and return shipment data"""
    shipment = await db.shipments.find_one({"id": shipment_id}, {"_id": 0})
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    
    # Get match to find traveler
    match = await db.matches.find_one({
        "shipment_id": shipment_id, "traveler_id": user.id,
        "status": {"$in": ["accepted", "payment_pending", "paid", "in_progress", "completed"]},
    })
    
    # Check access rights
    has_access = (
        user.role == UserRole.ADMIN or
        shipment["sender_id"] == user.id or
        (match and match["traveler_id"] == user.id)
    )
    
    if not has_access:
        raise HTTPException(status_code=403, detail="Access denied to this shipment")
        
    return shipment

async def create_system_message(shipment_id: str, message_type: str, content: str, metadata: dict = None):
    """Create and broadcast system message for a shipment"""
    system_message = ShipmentMessage(
        shipment_id=shipment_id,
        sender_id="system",
        message_type="system",
        content=content,
        metadata=metadata or {"type": message_type}
    )
    
    # Store in database
    await db.shipment_messages.insert_one(system_message.dict())
    
    # Broadcast to all connected users in this shipment
    await chat_manager.broadcast_to_shipment(shipment_id, {
        "type": "new_message",
        "data": system_message.dict()
    })
    
    return system_message

# Root endpoint
@api_router.get("/")
async def root():
    return {"message": "SendJet API", "status": "running"}


# Public trust stats — used by the Safety page to prove the platform is real.
# Public (no auth) so anonymous visitors can see social proof.
@api_router.get("/stats/public")
async def public_stats():
    deliveries_done = await db.shipments.count_documents({"status": "delivered"})
    verified_users = await db.users.count_documents(
        {"role": UserRole.USER, "is_verified": True}
    )
    active_trips = await db.trips.count_documents({"status": "active"})
    total_shipments = await db.shipments.count_documents({})
    return {
        "deliveries_done": deliveries_done,
        "verified_users": verified_users,
        "active_trips": active_trips,
        "total_shipments": total_shipments,
    }

# Authentication endpoints
@api_router.post("/auth/register", response_model=dict)
async def register(user_data: UserCreate, background_tasks: BackgroundTasks):
    # Explicit acceptance keeps onboarding lightweight while recording consent.
    if not user_data.terms_accepted:
        raise HTTPException(status_code=400, detail="Please accept the Terms of Use and Privacy Policy to create an account")

    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user with unified "user" role
    hashed_password = get_password_hash(user_data.password)
    user_dict = user_data.dict()
    user_dict.pop('password')
    user_dict.pop('terms_accepted', None)
    user_dict['role'] = UserRole.USER
    user_dict['accepted_terms_at'] = datetime.now(timezone.utc).isoformat()
    user_dict['terms_version'] = '2026-09'
    user = User(**user_dict)
    
    # Save to database
    user_doc = user.dict()
    user_doc['password_hash'] = hashed_password
    await db.users.insert_one(user_doc)
    
    # Create access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.id}, expires_delta=access_token_expires
    )
    
    # Fire welcome + verification emails in the background so the response is snappy.
    # EmailService swallows send failures — a mail bounce must never block signup.
    mailer = get_email_service()
    verify_token = email_tokens.make_verify_email_token(user.id, user.email)
    background_tasks.add_task(mailer.send_welcome, user)
    background_tasks.add_task(mailer.send_verification, user, token=verify_token, ttl_hours=24)
    
    return {"access_token": access_token, "token_type": "bearer", "user": user}

@api_router.post("/auth/login", response_model=dict)
async def login(user_credentials: UserLogin):
    user = await db.users.find_one({"email": user_credentials.email})
    if not user or not user.get("password_hash") or not verify_password(user_credentials.password, user['password_hash']):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["id"]}, expires_delta=access_token_expires
    )
    
    user_data = User(**user)
    return {"access_token": access_token, "token_type": "bearer", "user": user_data}

@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@api_router.post("/auth/google/session", response_model=dict)
async def google_session_exchange(request: Request):
    """
    Emergent-managed Google Auth exchange.
    Frontend sends the transient session_id obtained from the OAuth redirect
    in the `X-Session-ID` header. We resolve it against Emergent's session-data
    endpoint, upsert the user by email, and issue our normal JWT so the rest
    of the app behaves identically to email/password login.
    """
    session_id = request.headers.get("X-Session-ID") or request.headers.get("x-session-id")
    if not session_id:
        raise HTTPException(status_code=400, detail="Missing X-Session-ID header")

    # Resolve session_id -> Google identity via Emergent (server-side only)
    try:
        async with httpx.AsyncClient(timeout=10.0) as http:
            resp = await http.get(
                EMERGENT_AUTH_SESSION_URL,
                headers={"X-Session-ID": session_id},
            )
        if resp.status_code != 200:
            logger.warning("Managed Google auth rejected session (%s): %s", resp.status_code, resp.text[:300])
            raise HTTPException(status_code=401, detail="Invalid or expired Google session")

        raw_profile = resp.json()
        # Managed-auth payloads have appeared both flat and nested across environments.
        # Accept the common shapes without weakening the requirement for a verified email.
        if isinstance(raw_profile, dict):
            profile = raw_profile.get("user") or raw_profile.get("data") or raw_profile
            if not isinstance(profile, dict):
                profile = raw_profile
        else:
            profile = {}
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Emergent Google auth exchange failed: %s", exc)
        raise HTTPException(status_code=502, detail="Google authentication service unavailable")

    email = (profile.get("email") or "").lower().strip()
    name = profile.get("name") or profile.get("full_name") or (email.split("@")[0] if email else "Google User")
    picture = profile.get("picture") or profile.get("avatar") or profile.get("photo_url")
    if not email:
        logger.warning("Google auth payload contained no email; keys=%s", list(profile.keys()) if isinstance(profile, dict) else [])
        raise HTTPException(status_code=400, detail="Google account did not return an email")

    terms_version = request.headers.get("X-Terms-Version") or request.headers.get("x-terms-version")

    # Upsert by email — Google-verified email counts as email_verified.
    existing = await db.users.find_one({"email": email})
    if existing:
        update_fields = {
            "email_verified": True,
            "email_verified_at": existing.get("email_verified_at") or datetime.now(timezone.utc).isoformat(),
            "auth_provider": existing.get("auth_provider") or "google",
        }
        if picture and not existing.get("avatar"):
            update_fields["avatar"] = picture
        if not existing.get("full_name"):
            update_fields["full_name"] = name
        await db.users.update_one({"id": existing["id"]}, {"$set": update_fields})
        user_doc = await db.users.find_one({"id": existing["id"]})
    else:
        # A first-time Google sign-in also creates an account. The frontend displays
        # the Terms/Privacy notice next to the Google button and sends its version.
        if not terms_version:
            raise HTTPException(status_code=400, detail="Please accept the Terms of Use and Privacy Policy before creating an account with Google")

        new_user = User(
            email=email,
            full_name=name,
            phone=None,
            role=UserRole.USER,
            avatar=picture,
            email_verified=True,
            email_verified_at=datetime.now(timezone.utc).isoformat(),
            accepted_terms_at=datetime.now(timezone.utc).isoformat(),
            terms_version=terms_version,
        )
        user_doc = new_user.dict()
        # No password_hash — Google-only account. Password login is disabled for these
        # users until they set one via the password-reset flow.
        user_doc["password_hash"] = None
        user_doc["auth_provider"] = "google"
        await db.users.insert_one(user_doc)

    user = User(**user_doc)
    access_token = create_access_token(
        data={"sub": user.id}, expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return {"access_token": access_token, "token_type": "bearer", "user": user}


# ---------------------------------------------------------------------------
# Email verification + password reset endpoints
# ---------------------------------------------------------------------------
class VerifyEmailIn(BaseModel):
    token: str


class ResendVerificationIn(BaseModel):
    email: EmailStr


class RequestPasswordResetIn(BaseModel):
    email: EmailStr


class ResetPasswordIn(BaseModel):
    token: str
    new_password: str = Field(..., min_length=6, max_length=128)


@api_router.post("/auth/verify-email")
async def verify_email(payload: VerifyEmailIn):
    """Confirm a user's email using the signed token from the verification link."""
    claims = email_tokens.decode_verify_email_token(payload.token)
    if not claims:
        raise HTTPException(status_code=400, detail="Verification link is invalid or has expired.")
    user = await db.users.find_one({"id": claims["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Account not found.")
    if user.get("email") != claims.get("email"):
        # Email was changed after the token was minted — invalidate.
        raise HTTPException(status_code=400, detail="Verification link no longer matches this account.")
    if user.get("email_verified"):
        return {"already_verified": True, "email": user["email"]}
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"email_verified": True, "email_verified_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"already_verified": False, "email": user["email"]}


@api_router.post("/auth/resend-verification")
async def resend_verification(payload: ResendVerificationIn, background_tasks: BackgroundTasks):
    """Send a fresh verification email. Returns the same response whether
    or not the account exists (avoids user-enumeration)."""
    user = await db.users.find_one({"email": payload.email}, {"_id": 0})
    if user and not user.get("email_verified"):
        token = email_tokens.make_verify_email_token(user["id"], user["email"])
        mailer = get_email_service()
        u = User(**user) if isinstance(user, dict) else user
        background_tasks.add_task(mailer.send_verification, u, token=token, ttl_hours=24)
    return {"ok": True, "message": "If an account exists for this email, a verification link has been sent."}


@api_router.post("/auth/request-password-reset")
async def request_password_reset(payload: RequestPasswordResetIn, background_tasks: BackgroundTasks):
    """Request a password-reset email. Same neutral response either way."""
    user = await db.users.find_one({"email": payload.email}, {"_id": 0})
    if user:
        pw_hash = user.get("password_hash", "")
        token = email_tokens.make_password_reset_token(user["id"], pw_hash)
        mailer = get_email_service()
        u = User(**user)
        background_tasks.add_task(mailer.send_password_reset, u, token=token, ttl_minutes=30)
    return {"ok": True, "message": "If an account exists for this email, a reset link has been sent."}


@api_router.post("/auth/reset-password")
async def reset_password(payload: ResetPasswordIn):
    """Complete a password reset using a valid token."""
    claims = email_tokens.decode_password_reset_token(payload.token)
    if not claims:
        raise HTTPException(status_code=400, detail="Reset link is invalid or has expired.")
    user = await db.users.find_one({"id": claims["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Account not found.")
    # pw_ref binding: if the password has changed since the token was minted,
    # the pw_ref slice no longer matches and the link is dead.
    current_ref = (user.get("password_hash", "") or "")[:12]
    if claims.get("pw_ref") != current_ref:
        raise HTTPException(status_code=400, detail="This reset link is no longer valid.")
    new_hash = get_password_hash(payload.new_password)
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"password_hash": new_hash, "password_updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"ok": True}


# User endpoints
@api_router.get("/users/{user_id}", response_model=User)
async def get_user_by_id(user_id: str, current_user: User = Depends(get_current_user)):
    """Get user profile by ID"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return User(**user)


@api_router.put("/users/me/avatar", response_model=User)
async def update_my_avatar(body: dict, current_user: User = Depends(get_current_user)):
    """Upload or replace the current user's profile photo.

    The browser sends a compressed JPEG/PNG/WebP data URL. Keeping the image small
    makes it practical to store with the profile while avoiding a separate storage
    dependency during the current SendJet beta.
    """
    avatar = body.get("avatar")
    if not isinstance(avatar, str) or not avatar.strip():
        raise HTTPException(status_code=400, detail="avatar is required")

    avatar = avatar.strip()
    match = re.match(r"^data:image/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=\s]+)$", avatar, re.IGNORECASE)
    if not match:
        raise HTTPException(status_code=400, detail="Please upload a JPEG, PNG or WebP image")
    try:
        raw = base64.b64decode(match.group(2), validate=True)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image data")
    if len(raw) > 1_500_000:
        raise HTTPException(status_code=413, detail="Profile photo is too large")

    await db.users.update_one({"id": current_user.id}, {"$set": {"avatar": avatar}})
    updated = await db.users.find_one({"id": current_user.id}, {"_id": 0, "password_hash": 0, "hashed_password": 0})
    return User(**updated)


@api_router.delete("/users/me/avatar", response_model=User)
async def delete_my_avatar(current_user: User = Depends(get_current_user)):
    """Remove the current user's profile photo."""
    await db.users.update_one({"id": current_user.id}, {"$set": {"avatar": None}})
    updated = await db.users.find_one({"id": current_user.id}, {"_id": 0, "password_hash": 0, "hashed_password": 0})
    return User(**updated)


@api_router.get("/users/me/deletion-status")
async def account_deletion_status(current_user: User = Depends(get_current_user)):
    """Return whether the signed-in user can safely delete the account now."""
    if current_user.role == UserRole.ADMIN:
        return {
            "can_delete": False,
            "requires_password": False,
            "blockers": {"active_matches": 0, "active_shipments": 0},
            "message": "Admin accounts cannot be deleted from the user profile.",
        }

    user_doc = await db.users.find_one(
        {"id": current_user.id}, {"_id": 0, "password_hash": 1}
    )
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")

    active_match_statuses = ["accepted", "payment_pending", "paid", "in_progress"]
    active_matches = await db.matches.count_documents({
        "$or": [{"sender_id": current_user.id}, {"traveler_id": current_user.id}],
        "status": {"$in": active_match_statuses},
    })
    active_shipments = await db.shipments.count_documents({
        "sender_id": current_user.id,
        "status": {"$in": ["matched", "picked_up", "in_transit", "arrived"]},
    })
    blockers = {"active_matches": active_matches, "active_shipments": active_shipments}
    can_delete = not any(blockers.values())
    return {
        "can_delete": can_delete,
        "requires_password": bool(user_doc.get("password_hash")),
        "blockers": blockers,
        "message": (
            "Account can be deleted."
            if can_delete
            else "Complete or cancel active deliveries and payment-related matches before deleting your account."
        ),
    }


@api_router.delete("/users/me")
async def delete_my_account(body: DeleteAccountIn, current_user: User = Depends(get_current_user)):
    """Permanently delete the signed-in user's account and personal app data.

    Active delivery/payment workflows must be resolved first. Historical payment
    ledger rows are kept only in anonymized form so operational records remain intact.
    """
    if current_user.role == UserRole.ADMIN:
        raise HTTPException(status_code=400, detail="Admin accounts cannot be deleted from the user profile")

    user = await db.users.find_one({"id": current_user.id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if body.confirm_email.lower().strip() != current_user.email.lower().strip():
        raise HTTPException(status_code=400, detail="Email confirmation does not match your account")

    if user.get("password_hash"):
        if not body.current_password or not verify_password(body.current_password, user["password_hash"]):
            raise HTTPException(status_code=400, detail="Current password is required and must be correct")

    active_match_statuses = ["accepted", "payment_pending", "paid", "in_progress"]
    active_matches = await db.matches.count_documents({
        "$or": [{"sender_id": current_user.id}, {"traveler_id": current_user.id}],
        "status": {"$in": active_match_statuses},
    })
    active_shipments = await db.shipments.count_documents({
        "sender_id": current_user.id,
        "status": {"$in": ["matched", "picked_up", "in_transit", "arrived"]},
    })
    if active_matches or active_shipments:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "ACTIVE_TRANSACTIONS",
                "message": "Complete or cancel active deliveries and payment-related matches before deleting your account.",
                "active_matches": active_matches,
                "active_shipments": active_shipments,
            },
        )

    user_id = current_user.id
    deleted_id = f"deleted-{uuid.uuid4()}"

    conversations = await db.direct_conversations.find(
        {"participant_ids": user_id}, {"_id": 0, "id": 1}
    ).to_list(10000)
    conversation_ids = [item["id"] for item in conversations]
    if conversation_ids:
        await db.direct_messages.delete_many({"conversation_id": {"$in": conversation_ids}})
        await db.direct_conversations.delete_many({"id": {"$in": conversation_ids}})

    owned_shipments = await db.shipments.find(
        {"sender_id": user_id}, {"_id": 0, "id": 1}
    ).to_list(10000)
    owned_shipment_ids = [item["id"] for item in owned_shipments]
    if owned_shipment_ids:
        await db.shipment_messages.delete_many({"shipment_id": {"$in": owned_shipment_ids}})
        await db.shipment_chats.delete_many({"shipment_id": {"$in": owned_shipment_ids}})
    await db.shipment_messages.delete_many({"sender_id": user_id})
    await db.shipment_chats.update_many({"participants": user_id}, {"$pull": {"participants": user_id}})

    await db.matches.delete_many({
        "$or": [{"sender_id": user_id}, {"traveler_id": user_id}],
        "status": {"$ne": "completed"},
    })
    await db.matches.update_many(
        {"sender_id": user_id, "status": "completed"}, {"$set": {"sender_id": deleted_id}}
    )
    await db.matches.update_many(
        {"traveler_id": user_id, "status": "completed"}, {"$set": {"traveler_id": deleted_id}}
    )

    await db.trips.delete_many({"traveler_id": user_id, "status": "active"})
    await db.trips.update_many(
        {"traveler_id": user_id},
        {"$set": {"traveler_id": deleted_id, "visibility": "private", "description": None}},
    )
    await db.shipments.delete_many({"sender_id": user_id, "status": "pending"})
    await db.shipments.update_many(
        {"sender_id": user_id},
        {"$set": {"sender_id": deleted_id, "visibility": "private", "description": "Deleted account shipment"}},
    )

    await db.notifications.delete_many({"user_id": user_id})
    await db.reviews.delete_many({"$or": [{"reviewer_id": user_id}, {"reviewed_user_id": user_id}]})

    await db.payment_transactions.update_many(
        {"sender_id": user_id},
        {"$set": {"sender_id": deleted_id}, "$unset": {"metadata.sender_id": ""}},
    )
    await db.payment_transactions.update_many(
        {"traveler_id": user_id}, {"$set": {"traveler_id": deleted_id}}
    )

    await db.users.delete_one({"id": user_id})
    notification_manager.disconnect(user_id)
    direct_message_manager.disconnect(user_id)

    return {"message": "Your SendJet account has been permanently deleted"}


@api_router.get("/users/{user_id}/match-options")
async def get_user_match_options(user_id: str, current_user: User = Depends(get_current_user)):
    """Return active listings needed to create a contextual match request.

    Public listings from the other user are discoverable. The current user also gets
    their own private match-only listings so they can reuse details created inline.
    """
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot match with yourself")
    target = await db.users.find_one({"id": user_id}, {"_id": 0, "id": 1})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    now = datetime.now(timezone.utc)
    public_only = {"visibility": {"$ne": "private"}}
    target_trips = await db.trips.find(
        {"traveler_id": user_id, "status": "active", "departure_date": {"$gte": now}, **public_only},
        {"_id": 0, "id": 1, "origin": 1, "destination": 1, "departure_date": 1, "transport_mode": 1, "pricing_model": 1, "price_per_kg": 1, "fixed_price": 1, "capacity_size": 1, "available_weight": 1}
    ).sort("departure_date", 1).to_list(50)
    target_shipments = await db.shipments.find(
        {"sender_id": user_id, "status": "pending", "pickup_date": {"$gte": now}, **public_only},
        {"_id": 0, "id": 1, "origin": 1, "destination": 1, "pickup_date": 1, "description": 1, "weight": 1}
    ).sort("pickup_date", 1).to_list(50)
    my_shipments = await db.shipments.find(
        {"sender_id": current_user.id, "status": "pending", "pickup_date": {"$gte": now}},
        {"_id": 0, "id": 1, "origin": 1, "destination": 1, "pickup_date": 1, "description": 1, "weight": 1, "visibility": 1}
    ).sort("pickup_date", 1).to_list(50)
    my_trips = await db.trips.find(
        {"traveler_id": current_user.id, "status": "active", "departure_date": {"$gte": now}},
        {"_id": 0, "id": 1, "origin": 1, "destination": 1, "departure_date": 1, "transport_mode": 1, "capacity_size": 1, "available_weight": 1, "visibility": 1}
    ).sort("departure_date", 1).to_list(50)

    existing_matches = await db.matches.find({
        "$or": [
            {"sender_id": current_user.id, "traveler_id": user_id},
            {"sender_id": user_id, "traveler_id": current_user.id},
        ],
        "status": {"$in": ["pending", "accepted", "payment_pending", "paid", "in_progress"]},
    }, {"_id": 0}).sort("created_at", -1).to_list(1000)

    return {
        "existing_matches": [Match(**m).dict() for m in existing_matches],
        "target_trips": target_trips,
        "target_shipments": target_shipments,
        "my_shipments": my_shipments,
        "my_trips": my_trips,
    }

# Shipment-based messaging endpoints
@api_router.post("/shipments/{shipment_id}/messages", response_model=ShipmentMessage)
async def send_shipment_message(
    shipment_id: str,
    message_data: ShipmentMessageCreate,
    current_user: User = Depends(get_current_user)
):
    # Verify access to shipment
    await verify_shipment_access(shipment_id, current_user)
    
    # Create message
    message = ShipmentMessage(
        **message_data.dict(),
        sender_id=current_user.id
    )
    
    # Store in database
    await db.shipment_messages.insert_one(message.dict())
    
    # Update chat thread
    await db.shipment_chats.update_one(
        {"shipment_id": shipment_id},
        {"$set": {"last_message_at": message.timestamp}}
    )
    
    # Broadcast to connected users
    await chat_manager.broadcast_to_shipment(shipment_id, {
        "type": "new_message",
        "data": message.dict()
    })
    
    # **SEND REAL-TIME NOTIFICATION TO OTHER PARTICIPANTS**
    chat_thread = await db.shipment_chats.find_one({"shipment_id": shipment_id})
    if chat_thread:
        for participant_id in chat_thread.get("participants", []):
            if participant_id != current_user.id:  # Don't notify sender
                await notification_manager.send_notification(participant_id, {
                    "type": "new_message",
                    "id": f"msg-{message.id}",
                    "title": "New Message",
                    "message": f"{current_user.full_name}: {message.content[:50]}...",
                    "shipment_id": shipment_id,
                    "sender_name": current_user.full_name,
                    "timestamp": message.timestamp.isoformat(),
                    "link": f"/shipment/{shipment_id}"
                })
    
    return message

@api_router.get("/shipments/{shipment_id}/messages", response_model=List[ShipmentMessage])
async def get_shipment_messages(
    shipment_id: str,
    current_user: User = Depends(get_current_user),
    limit: int = 100,
    offset: int = 0
):
    # Verify access to shipment
    await verify_shipment_access(shipment_id, current_user)
    
    # Get messages
    messages = await db.shipment_messages.find(
        {"shipment_id": shipment_id}
    ).sort("timestamp", 1).skip(offset).limit(limit).to_list(limit)
    
    return [ShipmentMessage(**msg) for msg in messages]

@api_router.post("/shipments/{shipment_id}/messages/{message_id}/read")
async def mark_message_read(
    shipment_id: str,
    message_id: str,
    current_user: User = Depends(get_current_user)
):
    # Verify access to shipment
    await verify_shipment_access(shipment_id, current_user)
    
    # Mark message as read
    await db.shipment_messages.update_one(
        {"id": message_id, "shipment_id": shipment_id},
        {"$addToSet": {"read_by": current_user.id}}
    )
    
    # Broadcast read status to other users
    await chat_manager.broadcast_to_shipment(shipment_id, {
        "type": "message_read",
        "data": {
            "message_id": message_id,
            "user_id": current_user.id,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    }, exclude_user=current_user.id)
    
    return {"status": "success"}

# Direct messaging endpoints (user-to-user)
@api_router.post("/conversations/start/{recipient_id}")
async def start_direct_conversation(
    recipient_id: str,
    current_user: User = Depends(get_current_user)
):
    """Start or get existing direct conversation with another user"""
    if recipient_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot message yourself")

    # Validate the recipient actually exists (avoids orphan "Unknown User" conversations)
    recipient = await db.users.find_one({"id": recipient_id}, {"_id": 0, "id": 1})
    if not recipient:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if conversation already exists
    participant_ids = sorted([current_user.id, recipient_id])
    conversation = await db.direct_conversations.find_one({
        "participant_ids": {"$all": participant_ids, "$size": 2}
    })
    
    if conversation:
        return {"conversation_id": conversation["id"], "existing": True}
    
    conversation_id = str(uuid.uuid5(uuid.NAMESPACE_URL, json.dumps(participant_ids)))
    new_conversation = DirectConversation(id=conversation_id, participant_ids=participant_ids)
    try:
        result = await db.direct_conversations.update_one(
            {"_id": f"direct:{conversation_id}"},
            {"$setOnInsert": new_conversation.dict()}, upsert=True,
        )
        existing = result.upserted_id is None
    except DuplicateKeyError:
        existing = True
    return {"conversation_id": conversation_id, "existing": existing}

@api_router.get("/conversations/my")
async def get_my_conversations(current_user: User = Depends(get_current_user)):
    """Get all conversations for current user"""
    conversations = await db.direct_conversations.find(
        {"participant_ids": current_user.id},
        {"_id": 0}
    ).sort("last_message_at", -1).to_list(100)
    
    # Enrich with other user info and last message
    enriched = []
    for conv in conversations:
        other_user_id = [uid for uid in conv["participant_ids"] if uid != current_user.id][0]
        other_user = await db.users.find_one(
            {"id": other_user_id},
            {"_id": 0, "id": 1, "full_name": 1, "role": 1, "avatar": 1, "rating": 1, "total_reviews": 1, "is_verified": 1}
        )
        
        # Get last message
        last_msg_cursor = db.direct_messages.find(
            {"conversation_id": conv["id"]},
            {"_id": 0}
        ).sort("timestamp", -1).limit(1)
        last_msg_list = await last_msg_cursor.to_list(1)
        last_msg = last_msg_list[0] if last_msg_list else None
        
        # Get unread count
        unread_count = await db.direct_messages.count_documents({
            "conversation_id": conv["id"],
            "sender_id": {"$ne": current_user.id},
            "read_by": {"$ne": current_user.id}
        })
        
        enriched.append({
            **conv,
            "other_user": other_user,
            "last_message": last_msg,
            "unread_count": unread_count
        })
    
    return enriched

@api_router.get("/conversations/{conversation_id}")
async def get_conversation(
    conversation_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get a single conversation with the other participant's public info.
    Works even when the conversation has no messages yet, so the chat header
    can always show who you're talking to."""
    conversation = await db.direct_conversations.find_one({"id": conversation_id}, {"_id": 0})
    if not conversation or current_user.id not in conversation["participant_ids"]:
        raise HTTPException(status_code=403, detail="Access denied")

    other_user_id = next((uid for uid in conversation["participant_ids"] if uid != current_user.id), None)
    other_user = await db.users.find_one(
        {"id": other_user_id},
        {"_id": 0, "id": 1, "full_name": 1, "role": 1, "avatar": 1, "rating": 1, "total_reviews": 1, "is_verified": 1}
    ) if other_user_id else None

    return {**conversation, "other_user": other_user}


@api_router.get("/conversations/{conversation_id}/messages")
async def get_conversation_messages(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    limit: int = 100
):
    """Get messages from a direct conversation"""
    # Verify user is participant
    conversation = await db.direct_conversations.find_one({"id": conversation_id})
    if not conversation or current_user.id not in conversation["participant_ids"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    messages = await db.direct_messages.find(
        {"conversation_id": conversation_id},
        {"_id": 0}
    ).sort("timestamp", 1).limit(limit).to_list(limit)
    
    return messages

@api_router.post("/conversations/{conversation_id}/messages")
async def send_direct_message(
    conversation_id: str,
    message_data: DirectMessageCreate,
    current_user: User = Depends(get_current_user)
):
    """Send a message in direct conversation"""
    # Verify user is participant
    conversation = await db.direct_conversations.find_one({"id": conversation_id})
    if not conversation or current_user.id not in conversation["participant_ids"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    content = (message_data.content or "").strip()
    if not content:
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    if len(content) > 4000:
        raise HTTPException(status_code=400, detail="Message is too long")

    message = DirectMessage(
        conversation_id=conversation_id,
        sender_id=current_user.id,
        content=content
    )

    await db.direct_messages.insert_one(message.dict())
    
    # Update conversation last message time
    await db.direct_conversations.update_one(
        {"id": conversation_id},
        {"$set": {"last_message_at": message.timestamp}}
    )
    
    # Push the new message immediately to every open chat/list for both participants.
    await direct_message_manager.send_to_users(conversation["participant_ids"], {
        "type": "direct_message",
        "conversation_id": conversation_id,
        "message": message.dict(),
    })

    # Send real-time notification to recipient
    recipient_id = [uid for uid in conversation["participant_ids"] if uid != current_user.id][0]
    await notification_manager.send_notification(recipient_id, {
        "type": "direct_message",
        "id": f"dm-{message.id}",
        "title": "New Message",
        "message": f"{current_user.full_name}: {message.content[:50]}...",
        "conversation_id": conversation_id,
        "sender_name": current_user.full_name,
        "timestamp": message.timestamp.isoformat(),
        "link": f"/direct-messages/{conversation_id}"
    })
    
    return message

@api_router.put("/conversations/{conversation_id}/read")
async def mark_conversation_read(
    conversation_id: str,
    current_user: User = Depends(get_current_user)
):
    """Mark all messages in conversation as read"""
    # Verify user is participant
    conversation = await db.direct_conversations.find_one({"id": conversation_id})
    if not conversation or current_user.id not in conversation["participant_ids"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Mark all unread messages as read
    await db.direct_messages.update_many(
        {
            "conversation_id": conversation_id,
            "sender_id": {"$ne": current_user.id},
            "read_by": {"$ne": current_user.id}
        },
        {"$addToSet": {"read_by": current_user.id}}
    )
    
    return {"status": "success"}

# Booking/Match creation from direct conversation
@api_router.post("/conversations/{conversation_id}/create-booking")
async def create_booking_from_conversation(
    conversation_id: str,
    booking_data: dict,
    current_user: User = Depends(get_current_user)
):
    """Create booking offer from conversation"""
    if current_user.role == UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin accounts cannot create bookings")
    
    # Verify conversation exists and user is participant
    conversation = await db.direct_conversations.find_one({"id": conversation_id})
    if not conversation or current_user.id not in conversation["participant_ids"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get sender ID from conversation
    sender_id = [uid for uid in conversation["participant_ids"] if uid != current_user.id][0]
    
    # Get shipment details
    shipment_id = booking_data.get("shipment_id")
    shipment = await db.shipments.find_one({"id": shipment_id}, {"_id": 0})
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    
    if shipment["sender_id"] != sender_id:
        raise HTTPException(status_code=400, detail="Shipment does not belong to conversation participant")
    
    if shipment.get("status") != "pending":
        raise HTTPException(status_code=409, detail="Shipment is no longer available for booking")

    # Calculate commission
    price_agreed = booking_data.get("price_agreed", 0.0)
    commission_percent = 10.0  # 10% platform fee
    commission_amount = price_agreed * (commission_percent / 100)
    traveler_payout = price_agreed - commission_amount
    
    # Create match/booking
    match = Match(
        shipment_id=shipment_id,
        traveler_id=current_user.id,
        sender_id=sender_id,
        price_agreed=price_agreed,
        status="payment_pending",
        payment_status="unpaid",
        platform_commission_percent=commission_percent,
        platform_commission_amount=commission_amount,
        traveler_payout_amount=traveler_payout,
        conversation_id=conversation_id
    )
    
    reserved = await db.shipments.update_one(
        {"id": shipment_id, "status": "pending"},
        {"$set": {"status": "matched", "assigned_match_id": match.id}},
    )
    if not reserved.modified_count:
        raise HTTPException(status_code=409, detail="Shipment is no longer available for booking")
    await db.matches.insert_one(match.dict())

    # Send notification to sender
    await notification_manager.send_notification(sender_id, {
        "type": "booking_request",
        "id": match.id,
        "title": "Booking Confirmed - Payment Required",
        "message": f"{current_user.full_name} will carry your package for ${price_agreed}. Please proceed with payment.",
        "match_id": match.id,
        "shipment_id": shipment_id,
        "price": price_agreed,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "link": f"/booking/{match.id}/payment"
    })
    
    return {
        "match": match.dict(),
        "message": "Booking created successfully. Sender will be notified to proceed with payment."
    }

# Get booking details
@api_router.get("/bookings/{match_id}")
async def get_booking(match_id: str, current_user: User = Depends(get_current_user)):
    """Get booking details"""
    match = await db.matches.find_one({"id": match_id}, {"_id": 0})
    if not match:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Verify access
    if current_user.id not in [match["sender_id"], match["traveler_id"]] and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return await _match_details(match)


async def _match_details(match):
    shipment = await db.shipments.find_one({"id": match["shipment_id"]}, {"_id": 0})
    trip = await db.trips.find_one({"id": match.get("trip_id")}, {"_id": 0}) if match.get("trip_id") else None
    profile = {"_id": 0, "id": 1, "full_name": 1, "avatar": 1, "role": 1, "rating": 1, "total_reviews": 1, "is_verified": 1}
    return {
        "match": Match(**match).dict(),
        "shipment": Shipment(**shipment).dict() if shipment else None,
        "trip": Trip(**trip).dict() if trip else None,
        "sender": await db.users.find_one({"id": match["sender_id"]}, profile),
        "traveler": await db.users.find_one({"id": match["traveler_id"]}, profile),
    }


@api_router.get("/matches/requests")
async def get_match_requests(current_user: User = Depends(get_current_user)):
    """Both directions and every lifecycle state, independent of listing availability."""
    matches = await db.matches.find({"$or": [
        {"sender_id": current_user.id}, {"traveler_id": current_user.id},
    ]}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [await _match_details(match) for match in matches]


@api_router.post("/matches/{match_id}/conversation")
async def open_match_conversation(match_id: str, current_user: User = Depends(get_current_user)):
    match = await db.matches.find_one({"id": match_id}, {"_id": 0})
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    if current_user.id not in {match["sender_id"], match["traveler_id"]}:
        raise HTTPException(status_code=403, detail="Not your match")
    if match.get("conversation_id"):
        conversation = await db.direct_conversations.find_one({"id": match["conversation_id"]})
        if conversation and set(conversation.get("participant_ids", [])) == {match["sender_id"], match["traveler_id"]}:
            return {"conversation_id": conversation["id"], "existing": True}
    other_id = match["traveler_id"] if current_user.id == match["sender_id"] else match["sender_id"]
    result = await start_direct_conversation(other_id, current_user)
    await db.matches.update_one({"id": match_id}, {"$set": {"conversation_id": result["conversation_id"]}})
    return result


@api_router.get("/shipments/{shipment_id}/chat-info")
async def get_shipment_chat_info(
    shipment_id: str,
    current_user: User = Depends(get_current_user)
):
    # Verify access and get shipment data
    shipment = await verify_shipment_access(shipment_id, current_user)
    match = await db.matches.find_one({
        "shipment_id": shipment_id,
        "status": {"$in": ["accepted", "payment_pending", "paid", "in_progress", "completed"]},
        **({"id": shipment["assigned_match_id"]} if shipment.get("assigned_match_id") else {}),
    }, {"_id": 0})
    
    # Get participants info
    participants = []
    
    # Add sender
    sender = await db.users.find_one({"id": shipment["sender_id"]}, {"_id": 0, "id": 1, "full_name": 1, "avatar": 1})
    if sender:
        participants.append({
            "user_id": sender["id"],
            "name": sender["full_name"],
            "role": "sender",
            "avatar": sender.get("avatar"),
            "online": sender["id"] in chat_manager.get_connected_users(shipment_id)
        })
    
    # Add traveler if matched
    traveler = None
    if match:
        traveler = await db.users.find_one({"id": match["traveler_id"]}, {"_id": 0, "id": 1, "full_name": 1, "avatar": 1})
        if traveler:
            participants.append({
                "user_id": traveler["id"],
                "name": traveler["full_name"],
                "role": "traveler",
                "avatar": traveler.get("avatar"),
                "online": traveler["id"] in chat_manager.get_connected_users(shipment_id)
            })
    
    # Get unread count for current user
    unread_count = await db.shipment_messages.count_documents({
        "shipment_id": shipment_id,
        "sender_id": {"$ne": current_user.id},
        "read_by": {"$ne": current_user.id}
    })
    
    return {
        "shipment_id": shipment_id,
        "shipment_description": shipment["description"],
        "shipment_status": shipment["status"],
        "participants": participants,
        "unread_count": unread_count,
        "match_status": match["status"] if match else None,
        "payment_status": match.get("payment_status") if match else None,
        "sender": sender,
        "traveler": traveler
    }

# Admin endpoints for message oversight
@api_router.get("/admin/shipments/{shipment_id}/messages", response_model=List[ShipmentMessage])
async def admin_get_shipment_messages(
    shipment_id: str,
    current_user: User = Depends(get_current_user),
    limit: int = 500
):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    messages = await db.shipment_messages.find(
        {"shipment_id": shipment_id}
    ).sort("timestamp", 1).limit(limit).to_list(limit)
    
    return [ShipmentMessage(**msg) for msg in messages]

@api_router.get("/admin/messages/overview")
async def admin_messages_overview(current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Get message statistics
    total_messages = await db.shipment_messages.count_documents({})
    today_messages = await db.shipment_messages.count_documents({
        "timestamp": {"$gte": datetime.now(timezone.utc).replace(hour=0, minute=0, second=0)}
    })
    
    # Get active shipment chats
    active_chats = await db.shipment_chats.count_documents({"is_active": True})
    
    return {
        "total_messages": total_messages,
        "today_messages": today_messages,
        "active_chats": active_chats,
        "connected_shipments": len(chat_manager.shipment_connections)
    }

# WebSocket endpoint for shipment-based chat
@app.websocket("/api/ws/shipment/{shipment_id}/{user_id}")
@app.websocket("/ws/shipment/{shipment_id}/{user_id}")
async def websocket_shipment_chat(websocket: WebSocket, shipment_id: str, user_id: str):
    # Verify user exists and has access to shipment
    user = await db.users.find_one({"id": user_id})
    if not user:
        await websocket.close(code=4004, reason="User not found")
        return
        
    user_obj = User(**user)
    try:
        await verify_shipment_access(shipment_id, user_obj)
    except HTTPException:
        await websocket.close(code=4003, reason="Access denied")
        return
    
    # Connect to shipment chat
    await chat_manager.connect_to_shipment(websocket, shipment_id, user_id)
    
    try:
        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)
            
            if message_data.get("type") == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
                
            elif message_data.get("type") == "send_message":
                # Handle real-time message sending
                content = message_data.get("content", "").strip()
                if content:
                    message = ShipmentMessage(
                        shipment_id=shipment_id,
                        sender_id=user_id,
                        content=content,
                        message_type="user"
                    )
                    
                    # Store in database
                    await db.shipment_messages.insert_one(message.dict())
                    
                    # Update chat thread
                    await db.shipment_chats.update_one(
                        {"shipment_id": shipment_id},
                        {"$set": {"last_message_at": message.timestamp}}
                    )
                    
                    # Broadcast to all users in shipment
                    await chat_manager.broadcast_to_shipment(shipment_id, {
                        "type": "new_message",
                        "data": message.dict()
                    })
                    
            elif message_data.get("type") == "typing":
                # Handle typing indicators
                await chat_manager.broadcast_to_shipment(shipment_id, {
                    "type": "typing",
                    "user_id": user_id,
                    "typing": message_data.get("typing", False)
                }, exclude_user=user_id)
                
    except WebSocketDisconnect:
        chat_manager.disconnect_from_shipment(shipment_id, user_id)
        
        # Notify others that user left
        await chat_manager.broadcast_to_shipment(shipment_id, {
            "type": "user_left",
            "user_id": user_id,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })

# WebSocket endpoint for real-time notifications
# Primary route is under /api so the Kubernetes ingress proxies it to the backend;
# the bare /ws/... route is kept as a backward-compatible alias.
@app.websocket("/api/ws/notifications/{user_id}")
@app.websocket("/ws/notifications/{user_id}")
async def notifications_websocket(websocket: WebSocket, user_id: str):
    token = websocket.query_params.get("token", "")
    current_user = await get_websocket_user(token)
    if not current_user or current_user.id != user_id:
        await websocket.close(code=4001, reason="Unauthorized")
        return
    await notification_manager.connect(websocket, user_id)

    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            if message.get("type") == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
    except WebSocketDisconnect:
        notification_manager.disconnect(user_id, websocket)


@app.websocket("/api/ws/direct-messages")
@app.websocket("/ws/direct-messages")
async def direct_messages_websocket(websocket: WebSocket):
    token = websocket.query_params.get("token", "")
    current_user = await get_websocket_user(token)
    if not current_user:
        await websocket.close(code=4001, reason="Unauthorized")
        return

    await direct_message_manager.connect(websocket, current_user.id)
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            if message.get("type") == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
    except WebSocketDisconnect:
        direct_message_manager.disconnect(current_user.id, websocket)

# Create chat thread when shipment is created
@api_router.post("/shipments", response_model=Shipment)
async def create_shipment(shipment_data: ShipmentCreate, current_user: User = Depends(get_current_user)):
    # Progressive engagement: any signed-up user can create a shipment immediately.
    # Match-only shipments may stay private and never appear on the public Marketplace.
    payload = shipment_data.dict()

    recipient_name = (payload.pop("recipient_name", None) or "").strip()
    recipient_email = payload.pop("recipient_email", None)
    if not recipient_name or not recipient_email:
        raise HTTPException(status_code=400, detail="Recipient name and email are required")

    visibility = (payload.get("visibility") or "public").lower().strip()
    if visibility not in {"public", "private"}:
        raise HTTPException(status_code=400, detail="Unsupported shipment visibility")
    payload["visibility"] = visibility

    # Create shipment with initial status history
    shipment = Shipment(
        **payload,
        sender_id=current_user.id,
        status_history=[{
            "status": "pending",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "notes": "Shipment request created",
            "location": shipment_data.origin.get("address", "")
        }]
    )
    await db.shipments.insert_one(shipment.dict())
    # Store recipient information privately, outside the public shipment document
    await db.shipment_private_details.update_one(
        {"shipment_id": shipment.id},
        {
            "$set": {
                "shipment_id": shipment.id,
                "sender_id": current_user.id,
                "recipient_name": recipient_name,
                "recipient_email": str(recipient_email),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
            "$setOnInsert": {
                "created_at": datetime.now(timezone.utc).isoformat()
            }
        },
        upsert=True
    )
    
    # Create chat thread for this shipment
    chat_thread = ShipmentChatThread(
        shipment_id=shipment.id,
        participants=[current_user.id]  # Start with sender, add traveler when matched
    )
    await db.shipment_chats.insert_one(chat_thread.dict())
    
    # Create system message
    await create_system_message(
        shipment.id,
        SystemMessageType.SHIPMENT_CREATED,
        f"Shipment created: {shipment.description}",
        {"created_by": current_user.full_name}
    )
    
    return shipment


async def _confirmation_context(shipment_id, current_user, kind, *, traveler_only=False):
    shipment = await db.shipments.find_one({"id": shipment_id}, {"_id": 0})
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    # Pending/rejected historical requests must never determine the assigned traveler.
    matches = await db.matches.find({
        "shipment_id": shipment_id,
        "sender_id": shipment["sender_id"],
        "payment_status": "escrowed",
        "status": {"$in": ["paid", "in_progress"]},
    }, {"_id": 0}).to_list(2)
    if len(matches) != 1:
        raise HTTPException(status_code=409, detail="Shipment needs one active paid match")
    match = matches[0]
    if shipment.get("assigned_match_id", match["id"]) != match["id"]:
        raise HTTPException(status_code=409, detail="Shipment assignment requires reconciliation")
    allowed_users = {match["traveler_id"]} if traveler_only else {match["sender_id"], match["traveler_id"]}
    if current_user.id not in allowed_users:
        raise HTTPException(status_code=403, detail="Only authorized shipment participants may perform this action")
    expected = "matched" if kind == "pickup" else "arrived"
    if shipment.get("status") != expected:
        raise HTTPException(status_code=409, detail=f"Shipment must be {expected} for {kind} confirmation")
    confirmation = await db.shipment_confirmations.find_one({
        "shipment_id": shipment_id, "match_id": match["id"]
    })
    if not confirmation:
        raise HTTPException(status_code=409, detail="Confirmation record not ready; refresh payment status")
    return shipment, match, confirmation


async def _send_confirmation_code(shipment, match, confirmation, kind, request, *, initial=False):
    """Reserve a send atomically; replace the usable hash only after provider acceptance.

    The lease coordinates workers. Its token fences a delayed send from overwriting
    a newer one. No plaintext code is persisted or returned.
    """
    hash_field = f"{kind}_code_hash"
    sent_field = f"{kind}_code_resent_at"
    requested_field = f"{kind}_code_requested_at"
    token_field = f"{kind}_send_token"
    until_field = f"{kind}_send_until"
    confirmed_field = f"{kind}_confirmed_at"
    if initial and confirmation.get(hash_field):
        return
    if confirmation.get(confirmed_field):
        raise HTTPException(status_code=409, detail=f"{kind.title()} already confirmed")

    if kind == "pickup":
        recipient = await db.users.find_one({"id": shipment["sender_id"]}, {"_id": 0})
        email = (recipient or {}).get("email")
        name = (recipient or {}).get("full_name", "")
    else:
        recipient = await db.shipment_private_details.find_one({"shipment_id": shipment["id"]}, {"_id": 0})
        email = (recipient or {}).get("recipient_email")
        name = (recipient or {}).get("recipient_name", "")
    if not email:
        raise HTTPException(status_code=400, detail=f"{'Sender' if kind == 'pickup' else 'Recipient'} email not available")

    now = datetime.now(timezone.utc)
    token = str(uuid.uuid4())
    selector = {"_id": confirmation["_id"], confirmed_field: None,
                hash_field: confirmation.get(hash_field),
                "$and": [
                    {"$or": [{until_field: {"$exists": False}}, {until_field: {"$lte": now.isoformat()}}]},
                    {"$or": [{sent_field: {"$exists": False}}, {sent_field: {"$lte": (now - timedelta(seconds=60)).isoformat()}}]},
                    {"$or": [{requested_field: {"$exists": False}}, {requested_field: {"$lte": (now - timedelta(seconds=60)).isoformat()}}]},
                ]}
    reserved = await db.shipment_confirmations.update_one(selector, {"$set": {
        token_field: token, until_field: (now + timedelta(minutes=5)).isoformat(),
        requested_field: now.isoformat()
    }})
    if not reserved.modified_count:
        if initial:
            latest = await db.shipment_confirmations.find_one({"_id": confirmation["_id"]})
            if latest and latest.get(hash_field):
                return
        raise HTTPException(status_code=429, detail=f"Please wait 60 seconds before requesting another {kind} code; a send may already be running", headers={"Retry-After": "60"})

    owned = {"_id": confirmation["_id"], token_field: token}
    try:
        code = generate_confirmation_code()
        # A resend must actually rotate the code, even in the unlikely event of a collision.
        while hash_confirmation_code(code) == confirmation.get(hash_field):
            code = generate_confirmation_code()
        mailer = get_email_service(request)
        send = mailer.send_pickup_code if kind == "pickup" else mailer.send_delivery_code
        try:
            sent = await send(email=email, name=name, code=code, shipment_id=shipment["id"])
        except Exception:
            sent = False  # Never log provider exceptions: they can contain the code.
        if not sent:
            raise HTTPException(status_code=502, detail=f"Could not send the {kind} email. No code was replaced. Please wait 60 seconds before retrying.", headers={"Retry-After": "60"})
        stored = await db.shipment_confirmations.update_one(
            {**owned, confirmed_field: None, hash_field: confirmation.get(hash_field)},
            {"$set": {hash_field: hash_confirmation_code(code), f"{kind}_attempts": 0,
                      sent_field: datetime.now(timezone.utc).isoformat()},
             "$unset": {token_field: "", until_field: ""}},
        )
        if not stored.modified_count:
            raise HTTPException(status_code=409, detail="The code changed while sending. Request a new code before confirming.")
    finally:
        await db.shipment_confirmations.update_one(owned, {"$unset": {token_field: "", until_field: ""}})


@api_router.post("/shipments/{shipment_id}/resend-pickup-code")
async def resend_pickup_code(shipment_id: str, request: Request, current_user: User = Depends(get_current_user)):
    shipment, match, confirmation = await _confirmation_context(shipment_id, current_user, "pickup")
    await _send_confirmation_code(shipment, match, confirmation, "pickup", request)
    return {"success": True, "message": "A new pickup code has been sent to the sender"}


@api_router.post("/shipments/{shipment_id}/resend-delivery-code")
async def resend_delivery_code(shipment_id: str, request: Request, current_user: User = Depends(get_current_user)):
    shipment, match, confirmation = await _confirmation_context(shipment_id, current_user, "delivery")
    await _send_confirmation_code(shipment, match, confirmation, "delivery", request)
    return {"success": True, "message": "A new delivery code has been sent to the recipient"}


async def _confirm_handover(shipment_id, payload, current_user, kind):
    code = payload.get("code", "")
    if not isinstance(code, str) or not re.fullmatch(r"[0-9]{6}", code):
        raise HTTPException(status_code=400, detail="Enter the 6-digit confirmation code")
    shipment, match, confirmation = await _confirmation_context(shipment_id, current_user, kind, traveler_only=True)
    hash_field = f"{kind}_code_hash"
    attempts_field = f"{kind}_attempts"
    confirmed_field = f"{kind}_confirmed_at"
    stored_hash = confirmation.get(hash_field)
    if not stored_hash:
        raise HTTPException(status_code=409, detail=f"Request a {kind} code first")
    now = datetime.now(timezone.utc).isoformat()
    # Reserve an attempt BEFORE comparing, so parallel guesses cannot exceed five.
    eligible = {"_id": confirmation["_id"], hash_field: stored_hash,
                confirmed_field: None, attempts_field: {"$lt": 5},
                "$or": [{f"{kind}_send_until": {"$exists": False}},
                         {f"{kind}_send_until": {"$lte": now}}]}
    attempt = await db.shipment_confirmations.update_one(eligible, {"$inc": {attempts_field: 1}})
    if not attempt.modified_count:
        raise HTTPException(status_code=429, detail="Confirmation is busy or five attempts were used. Wait for the resend or request a new code.")
    if not secrets.compare_digest(hash_confirmation_code(code), stored_hash):
        raise HTTPException(status_code=400, detail=f"Incorrect {kind} code")
    # A concurrent resend/confirmation must not validate a stale hash twice.
    accepted = await db.shipment_confirmations.update_one(
        {**eligible, attempts_field: {"$lte": 5}},
        {"$set": {confirmed_field: now, f"{kind}_confirmed_by": current_user.id}},
    )
    if not accepted.modified_count:
        raise HTTPException(status_code=409, detail="Confirmation changed. Refresh and try again.")
    new_status = "picked_up" if kind == "pickup" else "delivered"
    milestone = {"status": new_status, "timestamp": now,
                 "notes": f"Package {kind} confirmed with secure code",
                 "location": shipment.get("origin" if kind == "pickup" else "destination", {}).get("address", ""),
                 "updated_by": current_user.id}
    changed = await db.shipments.update_one(
        {"id": shipment_id, "status": shipment["status"]},
        {"$set": {"status": new_status}, "$push": {"status_history": milestone}},
    )
    if not changed.modified_count:
        raise HTTPException(status_code=409, detail="Shipment status changed. Refresh the shipment.")
    match_update = {"status": "in_progress" if kind == "pickup" else "completed"}
    if kind == "delivery":
        match_update["completed_at"] = now
    await db.matches.update_one({"id": match["id"]}, {"$set": match_update})
    await trigger_status_message(shipment_id, new_status)
    return {"success": True, "status": new_status, "message": f"{kind.title()} confirmed successfully"}


@api_router.post("/shipments/{shipment_id}/confirm-pickup")
async def confirm_shipment_pickup(shipment_id: str, payload: Dict[str, Any], current_user: User = Depends(get_current_user)):
    return await _confirm_handover(shipment_id, payload, current_user, "pickup")


@api_router.post("/shipments/{shipment_id}/confirm-delivery")
async def confirm_shipment_delivery(shipment_id: str, payload: Dict[str, Any], current_user: User = Depends(get_current_user)):
    return await _confirm_handover(shipment_id, payload, current_user, "delivery")


# Shipment status update endpoint
@api_router.put("/shipments/{shipment_id}/status", response_model=Shipment)
async def update_shipment_status(
    shipment_id: str,
    status_update: Dict[str, Any],
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Update shipment status and add to milestone history"""
    # Verify access to shipment
    shipment = await verify_shipment_access(shipment_id, current_user)
    matches = await db.matches.find({
        "shipment_id": shipment_id, "sender_id": shipment["sender_id"],
        "payment_status": "escrowed", "status": "in_progress",
    }, {"_id": 0}).to_list(2)
    if len(matches) != 1 or matches[0].get("traveler_id") != current_user.id:
        raise HTTPException(status_code=403, detail="Only the matched paid traveler can update delivery status")
    match = matches[0]
    if shipment.get("assigned_match_id", match["id"]) != match["id"]:
        raise HTTPException(status_code=409, detail="Shipment assignment requires reconciliation")

    new_status = status_update.get("status")
    notes = status_update.get("notes", "")
    location = status_update.get("location", "")
    
    # Valid status transitions
    allowed_transitions = {
        "picked_up": "in_transit",
        "in_transit": "arrived",
    }

    current_status = shipment.get("status")
    expected_status = allowed_transitions.get(current_status)

    if expected_status is None or new_status != expected_status:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status transition from {current_status} to {new_status}"
        )
    
    # Create milestone entry
    milestone = {
        "status": new_status,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "notes": notes or f"Status updated to {new_status}",
        "location": location,
        "updated_by": current_user.id
    }
    
    # Update shipment
    result = await db.shipments.find_one_and_update(
        {"id": shipment_id, "status": current_status},
        {
            "$set": {"status": new_status},
            "$push": {"status_history": milestone}
        },
        return_document=True
    )
    
    if not result:
        raise HTTPException(status_code=409, detail="Shipment status changed; refresh and retry")
    
    # Send system message to chat
    await trigger_status_message(shipment_id, new_status)
    
    # Broadcast status update to connected users
    await chat_manager.broadcast_to_shipment(shipment_id, {
        "type": "status_update",
        "data": milestone
    })
    
    if new_status == "arrived":
        confirmation = await db.shipment_confirmations.find_one({"shipment_id": shipment_id, "match_id": match["id"]})
        if not confirmation:
            raise HTTPException(status_code=409, detail="Shipment arrived, but confirmation record is missing")
        # Arrival is durable even if email fails; the resend endpoint retries delivery.
        await _send_confirmation_code(result, match, confirmation, "delivery", request, initial=True)
    return Shipment(**result)

# Get user's shipments
@api_router.get("/shipments/my", response_model=List[Shipment])
async def get_my_shipments(current_user: User = Depends(get_current_user)):
    """Get all shipments for current user"""
    shipments = await db.shipments.find(
        {"sender_id": current_user.id},
        {"_id": 0}
    ).to_list(1000)
    return [Shipment(**s) for s in shipments]

# Get shipment details endpoint
@api_router.get("/shipments/{shipment_id}", response_model=Shipment)
async def get_shipment(shipment_id: str, current_user: User = Depends(get_current_user)):
    """Get detailed shipment information.

    Public shipments are visible to any authenticated user (same data already
    exposed by the public marketplace list). Private shipments remain restricted
    to the sender, the matched traveler, or an admin.
    """
    shipment = await db.shipments.find_one({"id": shipment_id}, {"_id": 0})
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    if (shipment.get("visibility") or "public").lower() == "private":
        shipment = await verify_shipment_access(shipment_id, current_user)
    return Shipment(**shipment)


@api_router.delete("/shipments/{shipment_id}")
async def delete_shipment(shipment_id: str, current_user: User = Depends(get_current_user)):
    """Delete a shipment - only the owner can delete"""
    shipment = await db.shipments.find_one({"id": shipment_id}, {"_id": 0})
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    if shipment["sender_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Only the shipment owner can delete it")
    # Block deletion only if shipment is actively in transit (not yet delivered)
    if shipment["status"] in ["matched", "picked_up", "in_transit", "arrived"]:
        raise HTTPException(status_code=400, detail="Cannot delete an assigned shipment before delivery")
    # Cancel any pending/accepted matches for this shipment
    await db.matches.update_many(
        {"shipment_id": shipment_id, "status": {"$in": ["pending", "accepted", "payment_pending"]}},
        {"$set": {"status": "cancelled"}}
    )
    await db.shipments.delete_one({"id": shipment_id})
    return {"message": "Shipment deleted successfully"}

# Get user's matches
@api_router.get("/matches/my", response_model=List[Match])
async def get_my_matches(current_user: User = Depends(get_current_user)):
    """Get all matches for current user (as sender or traveler)"""
    query = {
        "$or": [
            {"sender_id": current_user.id},
            {"traveler_id": current_user.id}
        ]
    }
    
    matches = await db.matches.find(query, {"_id": 0}).to_list(1000)
    return [Match(**m) for m in matches]

# Get all shipments (for marketplace)
# ---------------------------------------------------------------------------
# Self-healing demo listings
# ---------------------------------------------------------------------------
# Keep unbooked, explicitly marked demo listings available. Throttle scans on
# marketplace reads; each write independently protects the marker and state.
# ---------------------------------------------------------------------------
_LAST_DEMO_REFRESH: Optional[datetime] = None
_DEMO_REFRESH_INTERVAL = timedelta(minutes=5)


async def _refresh_demo_listings_if_needed() -> None:
    global _LAST_DEMO_REFRESH
    now = datetime.now(timezone.utc)
    if not settings.enable_demo_data:
        return
    if _LAST_DEMO_REFRESH is not None and now - _LAST_DEMO_REFRESH < _DEMO_REFRESH_INTERVAL:
        return
    await refresh_demo_listings(db)
    _LAST_DEMO_REFRESH = now


async def _hidden_owner_ids() -> list[str]:
    """IDs of internal test/QA accounts whose listings must never show in the
    public marketplace (e.g. testing-agent 'R1 Tester' accounts on @example.com).
    Real demo listings live on @demo.sendjet.com and are NOT hidden."""
    cursor = db.users.find(
        {
            "$or": [
                {"email": {"$regex": r"@example\.com$", "$options": "i"}},
                {"email": {"$regex": r"^(r1_|qa[_.]|test)", "$options": "i"}},
                {"full_name": {"$regex": r"\btest(er)?\b", "$options": "i"}},
            ]
        },
        {"_id": 0, "id": 1},
    )
    return [u["id"] async for u in cursor]


async def _attach_owner_info(items: list[dict], *, id_field: str, prefix: str) -> None:
    """Enrich marketplace listings with their owner's public identity.

    Batch-fetches users referenced by `id_field` and writes `{prefix}_name`,
    `{prefix}_avatar`, `{prefix}_rating`, `{prefix}_reviews` onto each item.
    One DB round-trip regardless of list size.
    """
    if not items:
        return
    owner_ids = list({it.get(id_field) for it in items if it.get(id_field)})
    if not owner_ids:
        return
    users = await db.users.find(
        {"id": {"$in": owner_ids}},
        {"_id": 0, "id": 1, "full_name": 1, "avatar": 1, "rating": 1, "total_reviews": 1},
    ).to_list(len(owner_ids))
    umap = {u["id"]: u for u in users}
    for it in items:
        u = umap.get(it.get(id_field))
        if u:
            it[f"{prefix}_name"] = u.get("full_name")
            it[f"{prefix}_avatar"] = u.get("avatar")
            it[f"{prefix}_rating"] = u.get("rating")
            it[f"{prefix}_reviews"] = u.get("total_reviews")


@api_router.get("/shipments", response_model=List[Shipment])
async def get_all_shipments():
    """Get all shipments for marketplace - public endpoint, excludes expired (past pickup_date)"""
    await _refresh_demo_listings_if_needed()
    now = datetime.now(timezone.utc)
    hidden = await _hidden_owner_ids()
    shipments = await db.shipments.find(
        {
            "status": {"$in": ["pending", "matched"]},
            "pickup_date": {"$gte": now},
            "sender_id": {"$nin": hidden},
            "visibility": {"$ne": "private"},
        },
        {"_id": 0}
    ).to_list(1000)
    # Trim photos to first one for marketplace card preview (full gallery is fetched on /shipments/{id}).
    # Keeps the payload small even when many shipments have multiple high-res photos.
    for ship in shipments:
        all_photos = ship.get("photos") or []
        ship["photo_count"] = len(all_photos)
        ship["photos"] = all_photos[:1]
    # Enrich each shipment with its sender's public identity (name/avatar/rating).
    await _attach_owner_info(shipments, id_field="sender_id", prefix="sender")
    return [Shipment(**ship) for ship in shipments]

# Trip endpoints
@api_router.post("/trips", response_model=Trip)
async def create_trip(trip_data: TripCreate, current_user: User = Depends(get_current_user)):
    """Create a new trip.
    
    Progressive engagement: any signed-up user can post a trip immediately.
    Verification is only required at match acceptance / payment.
    """
    payload = trip_data.dict()
    transport_mode = (payload.get("transport_mode") or "plane").lower().strip()
    allowed_modes = {"plane", "car", "train", "bus"}
    if transport_mode not in allowed_modes:
        raise HTTPException(status_code=400, detail="Unsupported transport mode")
    payload["transport_mode"] = transport_mode

    capacity_size = (payload.get("capacity_size") or "medium").lower().strip()
    allowed_sizes = {"small", "medium", "large", "xlarge"}
    if capacity_size not in allowed_sizes:
        raise HTTPException(status_code=400, detail="Unsupported capacity size")
    if transport_mode != "car" and capacity_size == "xlarge":
        capacity_size = "large"
    payload["capacity_size"] = capacity_size

    # Preserve compatibility with existing data/features that still expect a numeric space value.
    space_by_size = {"small": 10.0, "medium": 30.0, "large": 60.0, "xlarge": 100.0}
    if payload.get("available_space") is None:
        payload["available_space"] = space_by_size[capacity_size]

    visibility = (payload.get("visibility") or "public").lower().strip()
    if visibility not in {"public", "private"}:
        raise HTTPException(status_code=400, detail="Unsupported journey visibility")
    payload["visibility"] = visibility

    pricing_model = (payload.get("pricing_model") or ("negotiable" if visibility == "private" else "per_kg")).lower().strip()
    if pricing_model not in {"per_kg", "fixed", "negotiable"}:
        raise HTTPException(status_code=400, detail="Unsupported pricing model")
    if pricing_model == "negotiable" and visibility != "private":
        raise HTTPException(status_code=400, detail="Public journeys need a price")
    payload["pricing_model"] = pricing_model
    if pricing_model == "per_kg":
        if payload.get("price_per_kg") is None or payload.get("price_per_kg") <= 0:
            raise HTTPException(status_code=400, detail="Price per kg must be greater than zero")
        payload["fixed_price"] = None
    elif pricing_model == "fixed":
        if payload.get("fixed_price") is None or payload.get("fixed_price") <= 0:
            raise HTTPException(status_code=400, detail="Fixed price must be greater than zero")
        payload["price_per_kg"] = None
    else:
        payload["price_per_kg"] = None
        payload["fixed_price"] = None

    # Pickup along route only applies to car journeys.
    if transport_mode != "car":
        payload["pickup_along_route"] = False

    trip = Trip(**payload, traveler_id=current_user.id)
    await db.trips.insert_one(trip.dict())
    return trip

@api_router.get("/trips/my", response_model=List[Trip])
async def get_my_trips(current_user: User = Depends(get_current_user)):
    """Get all trips for current user"""
    trips = await db.trips.find(
        {"traveler_id": current_user.id},
        {"_id": 0}
    ).to_list(1000)
    return [Trip(**t) for t in trips]

@api_router.get("/trips", response_model=List[Trip])
async def get_all_trips():
    """Get all trips for marketplace - public endpoint, excludes expired (past departure_date)"""
    await _refresh_demo_listings_if_needed()
    now = datetime.now(timezone.utc)
    hidden = await _hidden_owner_ids()
    trips = await db.trips.find(
        {
            "status": "active",
            "departure_date": {"$gte": now},
            "traveler_id": {"$nin": hidden},
            "visibility": {"$ne": "private"},
        },
        {"_id": 0}
    ).to_list(1000)
    await _attach_owner_info(trips, id_field="traveler_id", prefix="traveler")
    return [Trip(**t) for t in trips]

@api_router.delete("/trips/{trip_id}")
async def delete_trip(trip_id: str, current_user: User = Depends(get_current_user)):
    """Delete a trip - only the owner can delete"""
    trip = await db.trips.find_one({"id": trip_id}, {"_id": 0})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if trip["traveler_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Only the trip owner can delete it")
    # Block deletion only if there's an actively in-transit shipment on this trip
    active_shipment = await db.matches.find_one({
        "trip_id": trip_id,
        "status": {"$in": ["paid", "in_progress"]}
    })
    if active_shipment:
        # Check if the associated shipment is in transit
        shipment = await db.shipments.find_one({"id": active_shipment.get("shipment_id")}, {"_id": 0})
        if shipment and shipment.get("status") in ["picked_up", "in_transit"]:
            raise HTTPException(status_code=400, detail="Cannot delete trip while a shipment is in transit")
    # Cancel any pending matches for this trip
    await db.matches.update_many(
        {"trip_id": trip_id, "status": {"$in": ["pending", "accepted", "payment_pending"]}},
        {"$set": {"status": "cancelled"}}
    )
    await db.trips.delete_one({"id": trip_id})
    return {"message": "Trip deleted successfully"}


# ===== REVIEW ENDPOINTS =====

@api_router.post("/reviews")
async def submit_review(review_data: dict, current_user: User = Depends(get_current_user)):
    """Submit a review for the other party after delivery"""
    match_id = review_data.get("match_id")
    rating = review_data.get("rating")
    comment = review_data.get("comment", "")

    if not match_id or not rating:
        raise HTTPException(status_code=400, detail="match_id and rating are required")
    if rating < 1 or rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")

    match = await db.matches.find_one({"id": match_id}, {"_id": 0})
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    # Verify user is a participant
    if current_user.id not in [match["sender_id"], match["traveler_id"]]:
        raise HTTPException(status_code=403, detail="You are not part of this match")

    # Only allow reviews for delivered/completed matches
    shipment = await db.shipments.find_one({"id": match["shipment_id"]}, {"_id": 0})
    if not shipment or shipment.get("status") not in ["delivered", "completed"]:
        raise HTTPException(status_code=400, detail="Reviews can only be submitted after delivery")

    # Determine who is being reviewed
    reviewed_user_id = match["traveler_id"] if current_user.id == match["sender_id"] else match["sender_id"]

    # Check if user already reviewed this match
    existing = await db.reviews.find_one({
        "match_id": match_id,
        "reviewer_id": current_user.id
    })
    if existing:
        raise HTTPException(status_code=400, detail="You have already reviewed this delivery")

    review = Review(
        match_id=match_id,
        shipment_id=match["shipment_id"],
        reviewer_id=current_user.id,
        reviewed_user_id=reviewed_user_id,
        reviewer_name=current_user.full_name,
        reviewer_role=current_user.role,
        rating=rating,
        comment=comment
    )
    await db.reviews.insert_one(review.dict())

    # Update reviewed user's average rating
    all_reviews = await db.reviews.find(
        {"reviewed_user_id": reviewed_user_id}, {"_id": 0, "rating": 1}
    ).to_list(1000)
    avg_rating = sum(r["rating"] for r in all_reviews) / len(all_reviews)
    await db.users.update_one(
        {"id": reviewed_user_id},
        {"$set": {"rating": round(avg_rating, 1), "total_reviews": len(all_reviews)}}
    )

    # Notify the reviewed user
    await notification_manager.send_notification(reviewed_user_id, {
        "type": "review_received",
        "id": str(uuid.uuid4()),
        "title": "New Review!",
        "message": f"{current_user.full_name} left you a {rating}-star review",
        "link": f"/profile/{reviewed_user_id}",
        "timestamp": datetime.now(timezone.utc).isoformat()
    })

    return {"message": "Review submitted", "review": review.dict()}


@api_router.get("/reviews/{user_id}")
async def get_user_reviews(user_id: str, current_user: User = Depends(get_current_user)):
    """Get all reviews for a user"""
    reviews = await db.reviews.find(
        {"reviewed_user_id": user_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return reviews


@api_router.get("/reviews/pending/me")
async def get_pending_reviews(current_user: User = Depends(get_current_user)):
    """Get matches where current user hasn't left a review yet (delivered only)"""
    # Get all matches involving this user that are delivered/completed
    matches = await db.matches.find({
        "$or": [
            {"sender_id": current_user.id},
            {"traveler_id": current_user.id}
        ],
        "status": {"$in": ["paid", "completed"]}
    }, {"_id": 0}).to_list(100)

    pending = []
    for match in matches:
        # Check if shipment is delivered
        shipment = await db.shipments.find_one({"id": match["shipment_id"]}, {"_id": 0})
        if not shipment or shipment.get("status") not in ["delivered", "completed"]:
            continue

        # Check if user already reviewed
        existing = await db.reviews.find_one({
            "match_id": match["id"],
            "reviewer_id": current_user.id
        })
        if existing:
            continue

        # Get other user info
        other_id = match["traveler_id"] if current_user.id == match["sender_id"] else match["sender_id"]
        other_user = await db.users.find_one({"id": other_id}, {"_id": 0, "password_hash": 0, "hashed_password": 0})

        pending.append({
            "match": match,
            "shipment": shipment,
            "other_user": other_user
        })

    return pending


# ===== ADMIN ENDPOINTS =====

@api_router.get("/admin/users")
async def admin_get_all_users(current_user: User = Depends(get_current_user)):
    """Admin: Get all users with full details"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return users

@api_router.get("/admin/trips")
async def admin_get_all_trips(current_user: User = Depends(get_current_user)):
    """Admin: inspect every journey, including private, expired and completed records."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    trips = await db.trips.find({}, {"_id": 0}).sort("created_at", -1).to_list(2500)
    await _attach_owner_info(trips, id_field="traveler_id", prefix="traveler")
    return trips


@api_router.get("/admin/shipments")
async def admin_get_all_shipments(current_user: User = Depends(get_current_user)):
    """Admin: inspect every shipment, including private and completed records."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    shipments = await db.shipments.find({}, {"_id": 0}).sort("created_at", -1).to_list(2500)
    await _attach_owner_info(shipments, id_field="sender_id", prefix="sender")
    for shipment in shipments:
        photos = shipment.get("photos") or []
        shipment["photo_count"] = len(photos)
        shipment["photos"] = photos[:1]
    return shipments


@api_router.get("/admin/matches")
async def admin_get_all_matches(current_user: User = Depends(get_current_user)):
    """Admin: operational view of all sender-traveler matches with route context."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    matches = await db.matches.find({}, {"_id": 0}).sort("created_at", -1).to_list(2500)
    if not matches:
        return []

    user_ids = list({uid for m in matches for uid in (m.get("sender_id"), m.get("traveler_id")) if uid})
    shipment_ids = list({m.get("shipment_id") for m in matches if m.get("shipment_id")})
    trip_ids = list({m.get("trip_id") for m in matches if m.get("trip_id")})
    users = await db.users.find({"id": {"$in": user_ids}}, {"_id": 0, "id": 1, "full_name": 1, "email": 1, "avatar": 1}).to_list(len(user_ids) or 1)
    shipments = await db.shipments.find({"id": {"$in": shipment_ids}}, {"_id": 0, "id": 1, "description": 1, "origin": 1, "destination": 1, "weight": 1, "status": 1}).to_list(len(shipment_ids) or 1)
    trips = await db.trips.find({"id": {"$in": trip_ids}}, {"_id": 0, "id": 1, "origin": 1, "destination": 1, "departure_date": 1, "transport_mode": 1, "status": 1}).to_list(len(trip_ids) or 1)
    umap = {u["id"]: u for u in users}
    smap = {x["id"]: x for x in shipments}
    tmap = {x["id"]: x for x in trips}
    for match in matches:
        match["sender"] = umap.get(match.get("sender_id"))
        match["traveler"] = umap.get(match.get("traveler_id"))
        match["shipment"] = smap.get(match.get("shipment_id"))
        match["trip"] = tmap.get(match.get("trip_id"))
    return matches


@api_router.get("/admin/payments")
async def admin_get_all_payments(current_user: User = Depends(get_current_user)):
    """Admin: read-only payment ledger with only operational fields."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    txs = await db.payment_transactions.find({}, {
        "_id": 0, "id": 1, "session_id": 1, "match_id": 1, "sender_id": 1,
        "traveler_id": 1, "shipment_id": 1, "amount": 1, "currency": 1,
        "payment_status": 1, "status": 1, "created_at": 1, "updated_at": 1
    }).sort("created_at", -1).to_list(2500)
    if not txs:
        return []
    user_ids = list({uid for t in txs for uid in (t.get("sender_id"), t.get("traveler_id")) if uid})
    users = await db.users.find({"id": {"$in": user_ids}}, {"_id": 0, "id": 1, "full_name": 1, "avatar": 1}).to_list(len(user_ids) or 1)
    umap = {u["id"]: u for u in users}
    for tx in txs:
        tx["sender"] = umap.get(tx.get("sender_id"))
        tx["traveler"] = umap.get(tx.get("traveler_id"))
    return txs


@api_router.put("/admin/users/{user_id}/verify")
async def admin_verify_user(user_id: str, current_user: User = Depends(get_current_user)):
    """Admin: Verify/approve a user account"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    result = await db.users.update_one(
        {"id": user_id},
        {"$set": {"is_verified": True, "verification_status": "verified", "admin_note": None}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    # Notify the user
    notification = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "message": "Your account has been verified! You now have full access to SendJet.",
        "type": "verification",
        "read": False,
        "link": "/dashboard",
        "created_at": datetime.now(timezone.utc)
    }
    await db.notifications.insert_one(notification)
    return {"message": "User verified successfully"}

@api_router.put("/admin/users/{user_id}/reject")
async def admin_reject_user(user_id: str, body: dict, current_user: User = Depends(get_current_user)):
    """Admin: Reject a user account"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    reason = body.get("reason", "Your account verification was rejected.")
    result = await db.users.update_one(
        {"id": user_id},
        {"$set": {"is_verified": False, "verification_status": "rejected", "admin_note": reason}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    notification = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "message": f"Account verification rejected: {reason}",
        "type": "verification",
        "read": False,
        "link": "/dashboard",
        "created_at": datetime.now(timezone.utc)
    }
    await db.notifications.insert_one(notification)
    return {"message": "User rejected"}

@api_router.put("/admin/users/{user_id}/request-id")
async def admin_request_id(user_id: str, body: dict, current_user: User = Depends(get_current_user)):
    """Admin: Request ID document from a user"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    note = body.get("note", "Please upload a valid government-issued ID to verify your identity.")
    result = await db.users.update_one(
        {"id": user_id},
        {"$set": {"verification_status": "id_requested", "admin_note": note}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    notification = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "message": f"Admin has requested identity verification: {note}",
        "type": "id_request",
        "read": False,
        "link": "/dashboard",
        "created_at": datetime.now(timezone.utc)
    }
    await db.notifications.insert_one(notification)
    return {"message": "ID request sent to user"}

@api_router.delete("/admin/users/{user_id}")
async def admin_delete_user(user_id: str, current_user: User = Depends(get_current_user)):
    """Admin: Delete a user and all their data"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.get("role") == "admin":
        raise HTTPException(status_code=400, detail="Cannot delete admin accounts")
    # Delete user's data
    await db.trips.delete_many({"traveler_id": user_id})
    await db.shipments.delete_many({"sender_id": user_id})
    await db.matches.delete_many({"$or": [{"sender_id": user_id}, {"traveler_id": user_id}]})
    await db.notifications.delete_many({"user_id": user_id})
    await db.reviews.delete_many({"$or": [{"reviewer_id": user_id}, {"reviewee_id": user_id}]})
    await db.users.delete_one({"id": user_id})
    return {"message": "User and all associated data deleted"}

# User: Upload ID document (base64)
@api_router.post("/users/upload-id")
async def upload_id_document(body: dict, current_user: User = Depends(get_current_user)):
    """User uploads their ID document (base64 image data)"""
    id_data = body.get("id_document")
    if not id_data:
        raise HTTPException(status_code=400, detail="id_document is required")
    await db.users.update_one(
        {"id": current_user.id},
        {"$set": {"id_document_url": id_data, "verification_status": "id_submitted"}}
    )
    # Notify admin
    admins = await db.users.find({"role": "admin"}, {"_id": 0, "id": 1}).to_list(100)
    for admin in admins:
        notification = {
            "id": str(uuid.uuid4()),
            "user_id": admin["id"],
            "message": f"{current_user.full_name} has submitted their ID for verification.",
            "type": "id_submitted",
            "read": False,
            "link": "/admin",
            "created_at": datetime.now(timezone.utc)
        }
        await db.notifications.insert_one(notification)
    return {"message": "ID document uploaded. Awaiting admin review."}


@api_router.get("/admin/conversations")
async def admin_get_all_conversations(current_user: User = Depends(get_current_user)):
    """Admin: Get all direct conversations with participant info and last message"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    conversations = await db.direct_conversations.find({}, {"_id": 0}).sort("last_message_at", -1).to_list(200)
    
    enriched = []
    for conv in conversations:
        # Get participant details
        participants = []
        for pid in conv.get("participant_ids", []):
            user = await db.users.find_one({"id": pid}, {"_id": 0, "password_hash": 0, "hashed_password": 0})
            if user:
                participants.append({"id": user["id"], "full_name": user["full_name"], "email": user["email"], "role": user["role"]})
        
        # Get last message
        last_msg = await db.direct_messages.find_one(
            {"conversation_id": conv["id"]}, {"_id": 0}
        , sort=[("timestamp", -1)])
        
        # Get message count
        msg_count = await db.direct_messages.count_documents({"conversation_id": conv["id"]})
        
        enriched.append({
            "id": conv["id"],
            "participants": participants,
            "last_message": last_msg.get("content", "") if last_msg else "",
            "last_message_at": conv.get("last_message_at"),
            "created_at": conv.get("created_at"),
            "message_count": msg_count
        })
    
    return enriched


@api_router.get("/admin/conversations/{conversation_id}/messages")
async def admin_get_conversation_messages(conversation_id: str, current_user: User = Depends(get_current_user)):
    """Admin: Get all messages in a direct conversation"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    conversation = await db.direct_conversations.find_one({"id": conversation_id}, {"_id": 0})
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    messages = await db.direct_messages.find(
        {"conversation_id": conversation_id}, {"_id": 0}
    ).sort("timestamp", 1).to_list(500)
    
    # Get participant details
    participants = {}
    for pid in conversation.get("participant_ids", []):
        user = await db.users.find_one({"id": pid}, {"_id": 0, "password_hash": 0, "hashed_password": 0})
        if user:
            participants[pid] = {"full_name": user["full_name"], "role": user["role"]}
    
    return {
        "conversation": conversation,
        "participants": participants,
        "messages": messages
    }


@api_router.get("/admin/shipment-chats")
async def admin_get_all_shipment_chats(current_user: User = Depends(get_current_user)):
    """Admin: Get all shipment chat threads with participant info"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    chats = await db.shipment_chats.find({}, {"_id": 0}).to_list(200)
    
    enriched = []
    for chat in chats:
        shipment = await db.shipments.find_one({"id": chat["shipment_id"]}, {"_id": 0})
        
        participants = []
        for pid in chat.get("participants", []):
            user = await db.users.find_one({"id": pid}, {"_id": 0, "password_hash": 0, "hashed_password": 0})
            if user:
                participants.append({"id": user["id"], "full_name": user["full_name"], "role": user["role"]})
        
        msg_count = await db.shipment_messages.count_documents({"shipment_id": chat["shipment_id"]})
        last_msg = await db.shipment_messages.find_one(
            {"shipment_id": chat["shipment_id"]}, {"_id": 0}
        , sort=[("timestamp", -1)])
        
        enriched.append({
            "id": chat["id"],
            "shipment_id": chat["shipment_id"],
            "shipment_description": shipment.get("description", "") if shipment else "",
            "participants": participants,
            "message_count": msg_count,
            "last_message": last_msg.get("content", "") if last_msg else "",
            "last_message_at": chat.get("last_message_at"),
        })
    
    return enriched


@api_router.get("/admin/shipment-chats/{shipment_id}/messages")
async def admin_get_shipment_chat_messages(shipment_id: str, current_user: User = Depends(get_current_user)):
    """Admin: Get all messages in a shipment chat"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    messages = await db.shipment_messages.find(
        {"shipment_id": shipment_id}, {"_id": 0}
    ).sort("timestamp", 1).to_list(500)
    
    # Get participant names
    sender_ids = set(m.get("sender_id") for m in messages if m.get("sender_id") != "system")
    participants = {}
    for sid in sender_ids:
        user = await db.users.find_one({"id": sid}, {"_id": 0, "password_hash": 0, "hashed_password": 0})
        if user:
            participants[sid] = {"full_name": user["full_name"], "role": user["role"]}
    
    return {
        "shipment_id": shipment_id,
        "participants": participants,
        "messages": messages
    }


# ===== NOTIFICATION REST ENDPOINTS =====

@api_router.get("/notifications")
async def get_notifications(
    current_user: User = Depends(get_current_user),
    limit: int = 50,
    offset: int = 0,
):
    """Get persisted notifications for the current user, newest first.

    Reading a notification never deletes it. The client can page backwards to older
    history using limit/offset.
    """
    limit = max(1, min(limit, 100))
    offset = max(0, offset)
    notifs = await db.notifications.find(
        {"user_id": current_user.id},
        {"_id": 0}
    ).sort("created_at", -1).skip(offset).limit(limit).to_list(limit)
    return notifs

@api_router.put("/notifications/{notif_id}/read")
async def mark_notification_read(notif_id: str, current_user: User = Depends(get_current_user)):
    """Mark a notification as read while preserving it in history."""
    result = await db.notifications.update_one(
        {"id": notif_id, "user_id": current_user.id},
        {"$set": {"read": True, "read_at": datetime.now(timezone.utc)}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"status": "ok"}

@api_router.put("/notifications/read-all")
async def mark_all_notifications_read(current_user: User = Depends(get_current_user)):
    """Mark notifications as read without removing history."""
    await db.notifications.update_many(
        {"user_id": current_user.id, "read": False},
        {"$set": {"read": True, "read_at": datetime.now(timezone.utc)}}
    )
    return {"status": "ok"}

# Matching endpoints - UPDATED
@api_router.post("/matches/request")
async def create_match_request(match_data: dict, current_user: User = Depends(get_current_user)):
    """Create a match only when both sides of the transaction are defined.

    Every match references a real Shipment + Journey. Either side may create their own
    missing record inline (including private match-only records) before calling here.
    """
    shipment_id = match_data.get("shipment_id")
    trip_id = match_data.get("trip_id")
    conversation_id = match_data.get("conversation_id")
    if not shipment_id or not trip_id:
        raise HTTPException(status_code=400, detail="A match needs both a shipment and a journey")
    try:
        price_offered = float(match_data.get("price_offered", 0.0))
    except (TypeError, ValueError):
        price_offered = 0.0
    if price_offered <= 0:
        raise HTTPException(status_code=400, detail="Offer price must be greater than zero")

    shipment = await db.shipments.find_one({"id": shipment_id}, {"_id": 0})
    trip = await db.trips.find_one({"id": trip_id}, {"_id": 0})
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    if not trip:
        raise HTTPException(status_code=404, detail="Journey not found")
    sender_id = shipment["sender_id"]
    traveler_id = trip["traveler_id"]
    if sender_id == traveler_id:
        raise HTTPException(status_code=400, detail="Sender and traveler must be different users")
    if current_user.id not in {sender_id, traveler_id}:
        raise HTTPException(status_code=403, detail="You must own either the shipment or the journey")

    other_user_id = traveler_id if current_user.id == sender_id else sender_id
    if conversation_id:
        conversation = await db.direct_conversations.find_one({"id": conversation_id}, {"_id": 0})
        expected = {current_user.id, other_user_id}
        if not conversation or set(conversation.get("participant_ids", [])) != expected:
            raise HTTPException(status_code=400, detail="Conversation does not match these users")

    combination = {"shipment_id": shipment_id, "trip_id": trip_id,
                   "sender_id": sender_id, "traveler_id": traveler_id}
    existing = await db.matches.find_one({**combination,
        "status": {"$in": ["pending", "accepted", "payment_pending", "paid", "in_progress"]},
    }, {"_id": 0})
    # Resolve an existing request before testing availability: acceptance reserves the shipment.
    if existing:
        return {"match": Match(**existing).dict(), "existing": True, "message": "Continue your existing match"}
    if shipment.get("status") != "pending":
        raise HTTPException(status_code=400, detail="This shipment is no longer available for matching")
    if trip.get("status") != "active":
        raise HTTPException(status_code=400, detail="This journey is no longer available for matching")
    if not conversation_id:
        conversation = await start_direct_conversation(other_user_id, current_user)
        conversation_id = conversation["conversation_id"]

    commission_amount = price_offered * 0.1
    match = Match(
        shipment_id=shipment_id,
        trip_id=trip_id,
        traveler_id=traveler_id,
        sender_id=sender_id,
        requested_by=current_user.id,
        price_agreed=price_offered,
        status="pending",
        payment_status="unpaid",
        platform_commission_amount=commission_amount,
        traveler_payout_amount=price_offered - commission_amount,
        conversation_id=conversation_id
    )
    # Mongo's unique _id serializes simultaneous repeats without migrating legacy rows.
    # A terminal request permits a new generation, preserving all previous requests.
    generation = await db.matches.count_documents({**combination,
        "status": {"$in": ["rejected", "cancelled", "completed"]}})
    request_key = hashlib.sha256(json.dumps(combination, sort_keys=True).encode()).hexdigest()
    record_id = f"request:{request_key}:{generation}"
    try:
        created = await db.matches.update_one({"_id": record_id},
            {"$setOnInsert": match.dict()}, upsert=True)
        inserted = created.upserted_id is not None
    except DuplicateKeyError:
        inserted = False
    if not inserted:
        existing = await db.matches.find_one({"_id": record_id}, {"_id": 0})
        return {"match": Match(**existing).dict(), "existing": True, "message": "Continue your existing match"}

    if current_user.id == sender_id:
        title = "New Match Request"
        message = f"{current_user.full_name} wants you to carry their shipment for {price_offered:.2f}"
    else:
        title = "New Carry Offer"
        message = f"{current_user.full_name} offered to carry your shipment for {price_offered:.2f}"

    await notification_manager.send_notification(other_user_id, {
        "type": "match_request",
        "id": match.id,
        "title": title,
        "message": message,
        "match_id": match.id,
        "shipment_id": shipment_id,
        "trip_id": trip_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "link": f"/match-requests?match={match.id}"
    })
    if conversation_id:
        await direct_message_manager.send_to_users([sender_id, traveler_id], {
            "type": "conversation_updated",
            "conversation_id": conversation_id,
            "reason": "match_request"
        })
    return {"match": match.dict(), "existing": False, "message": "Match request sent successfully"}

# Accept match request
@api_router.put("/matches/{match_id}/accept")
async def accept_match_request(match_id: str, current_user: User = Depends(get_current_user)):
    """Accept a match request - only the RECIPIENT (not the requester) can accept"""
    match = await db.matches.find_one({"id": match_id}, {"_id": 0})
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    
    # Verify user is a participant
    if current_user.id not in [match["sender_id"], match["traveler_id"]]:
        raise HTTPException(status_code=403, detail="Not your match request")
    
    # Verify user is NOT the one who initiated the request
    if match.get("requested_by") == current_user.id:
        raise HTTPException(status_code=403, detail="Cannot accept your own request")
    
    if match["status"] != "pending":
        raise HTTPException(status_code=400, detail="Match request already processed")
    
    reserved = await db.shipments.update_one(
        {"id": match["shipment_id"], "status": "pending"},
        {"$set": {"status": "matched", "assigned_match_id": match_id}},
    )
    if not reserved.modified_count:
        raise HTTPException(status_code=409, detail="Shipment is no longer available for matching")
    accepted = await db.matches.update_one(
        {"id": match_id, "status": "pending"},
        {"$set": {"status": "accepted", "payment_status": "payment_pending"}},
    )
    if not accepted.modified_count:
        await db.shipments.update_one(
            {"id": match["shipment_id"], "status": "matched", "assigned_match_id": match_id},
            {"$set": {"status": "pending"}, "$unset": {"assigned_match_id": ""}},
        )
        raise HTTPException(status_code=409, detail="Match request already processed")

    # Determine who is who
    requester_id = match.get("requested_by", "")
    sender_id = match["sender_id"]
    traveler_id = match["traveler_id"]
    
    if requester_id == traveler_id:
        # Scenario 1: Traveler offered → Sender accepted → Sender pays now
        # Notify traveler their offer was accepted
        await notification_manager.send_notification(traveler_id, {
            "type": "match_accepted",
            "id": str(uuid.uuid4()),
            "title": "Offer Accepted!",
            "message": f"{current_user.full_name} accepted your offer. Awaiting payment.",
            "match_id": match_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "link": f"/match-requests"
        })
    else:
        # Scenario 2: Sender requested → Traveler accepted → Notify sender to pay
        await notification_manager.send_notification(sender_id, {
            "type": "payment_required",
            "id": str(uuid.uuid4()),
            "title": "Request Accepted - Pay Now!",
            "message": f"{current_user.full_name} accepted your request. Tap here to pay ${match['price_agreed']}",
            "match_id": match_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "link": f"/booking/{match_id}/payment"
        })
    
    return {"message": "Match accepted successfully", "match_id": match_id}

# Reject match request
@api_router.put("/matches/{match_id}/reject")
async def reject_match_request(match_id: str, current_user: User = Depends(get_current_user)):
    """Reject a match request - only the RECIPIENT can reject"""
    match = await db.matches.find_one({"id": match_id}, {"_id": 0})
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    
    # Verify user is a participant but NOT the requester
    if current_user.id not in [match["sender_id"], match["traveler_id"]]:
        raise HTTPException(status_code=403, detail="Not your match request")
    if match.get("requested_by") == current_user.id:
        raise HTTPException(status_code=403, detail="Cannot reject your own request")
    
    # A stale decline button must not reject an accepted or paid booking.
    result = await db.matches.update_one(
        {"id": match_id, "status": "pending"},
        {"$set": {"status": "rejected"}}
    )
    
    if not result.modified_count:
        raise HTTPException(status_code=409, detail="Only pending requests may be declined")

    # Notify requester
    requester_id = match.get("requested_by", "")
    if requester_id:
        await notification_manager.send_notification(requester_id, {
            "type": "match_rejected",
            "id": match_id,
            "title": "Match Request Declined",
            "message": f"{current_user.full_name} declined your match request",
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
    
    return {"message": "Match rejected"}

# Get pending match requests for current user (only INCOMING - not ones you sent)
@api_router.get("/matches/requests/pending")
async def get_pending_match_requests(current_user: User = Depends(get_current_user)):
    """Get pending match requests sent TO the current user (not BY them)"""
    query = {
        "status": "pending",
        "requested_by": {"$ne": current_user.id},  # Exclude requests I initiated
        "$or": [
            {"sender_id": current_user.id},
            {"traveler_id": current_user.id}
        ]
    }
    
    matches = await db.matches.find(query, {"_id": 0}).to_list(100)
    
    # Enrich with details
    enriched = []
    for match in matches:
        shipment = await db.shipments.find_one({"id": match["shipment_id"]}, {"_id": 0})
        trip = await db.trips.find_one({"id": match.get("trip_id")}, {"_id": 0}) if match.get("trip_id") else None
        traveler = await db.users.find_one({"id": match["traveler_id"]}, {"_id": 0, "hashed_password": 0})
        sender = await db.users.find_one({"id": match["sender_id"]}, {"_id": 0, "hashed_password": 0})
        
        enriched.append({
            "match": match,
            "shipment": shipment,
            "trip": trip,
            "traveler": traveler,
            "sender": sender
        })
    
    return enriched

# System message triggers for status updates
async def trigger_status_message(shipment_id: str, status: str):
    """Trigger system messages based on shipment status changes"""
    messages = {
        "picked_up": (SystemMessageType.PACKAGE_PICKED_UP, "📦 Package has been picked up and is now in transit"),
        "in_transit": (SystemMessageType.IN_TRANSIT, "🚚 Package is on the way to destination"),
        "delivered": (SystemMessageType.DELIVERED, "✅ Package has been successfully delivered"),
    }
    
    if status in messages:
        msg_type, content = messages[status]
        await create_system_message(shipment_id, msg_type, content, {"status": status})

# ===== STRIPE PAYMENT ENDPOINTS =====

@api_router.post("/payments/checkout")
async def create_payment_checkout(
    request: Request,
    checkout_data: dict,
    current_user: User = Depends(get_current_user)
):
    """Create Stripe checkout session for a match payment"""
    _ensure_payments_enabled()
    match_id = checkout_data.get("match_id")
    if not isinstance(match_id, str) or not match_id:
        raise HTTPException(status_code=400, detail="match_id required")
    
    # Get match details
    match = await db.matches.find_one({"id": match_id}, {"_id": 0})
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    
    # Only sender can pay
    if match["sender_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Only the sender can make payment")
    
    # Check match status
    if match["status"] not in ["accepted", "payment_pending"]:
        raise HTTPException(status_code=400, detail="Match is not in a payable state")
    
    shipment = await db.shipments.find_one({"id": match["shipment_id"]}, {"_id": 0})
    if not shipment or shipment.get("status") != "matched" or shipment.get("assigned_match_id", match_id) != match_id:
        raise HTTPException(status_code=409, detail="Shipment is not assigned to this payable match")

    private_details = await db.shipment_private_details.find_one({"shipment_id": match["shipment_id"]})
    if not private_details or not private_details.get("recipient_name") or not private_details.get("recipient_email"):
        raise HTTPException(status_code=400, detail="Recipient name and email must be provided before payment; recreate this shipment with recipient details")

    async def reconcile(transaction):
        await _complete_paid_payment(transaction, request)

    # The client cannot choose redirect hosts. All workers share durable attempts.
    return await checkout_for_match(db, match, stripe_gateway, settings.public_site_url, reconcile)


async def _complete_paid_payment(transaction, request):
    """Idempotent reconciliation shared by status polling and verified webhooks."""
    match_id = transaction["match_id"]
    shipment_id = transaction["shipment_id"]
    now = datetime.now(timezone.utc).isoformat()
    shipment = await db.shipments.find_one({"id": shipment_id}, {"_id": 0})
    if not shipment or shipment.get("assigned_match_id", match_id) != match_id:
        raise HTTPException(status_code=409, detail="Paid shipment requires assignment reconciliation")
    paid = await db.matches.update_one(
        {"id": match_id, "status": {"$in": ["accepted", "payment_pending"]}},
        {"$set": {"status": "paid", "payment_status": "escrowed", "paid_at": now}},
    )
    match = await db.matches.find_one({"id": match_id}, {"_id": 0})
    if not match or match.get("payment_status") not in {"escrowed", "released"}:
        raise HTTPException(status_code=409, detail="Paid match requires manual reconciliation")
    shipment = await db.shipments.find_one({"id": shipment_id}, {"_id": 0})
    if not shipment:
        raise HTTPException(status_code=409, detail="Paid shipment is missing")
    # Never roll an in-progress or delivered shipment back to matched on a retry.
    await db.shipments.update_one(
        {"id": shipment_id, "status": {"$in": ["pending", "matched"]}, "payment_recorded_match_id": {"$ne": match_id}},
        {"$set": {"status": "matched", "payment_recorded_match_id": match_id},
         "$push": {"status_history": {"status": "paid", "timestamp": now,
                    "notes": "Payment received. Funds held in escrow.", "location": ""}}},
    )
    # Reuse legacy records; new records use Mongo's unique _id for concurrent polls.
    confirmation = await db.shipment_confirmations.find_one({"shipment_id": shipment_id, "match_id": match_id})
    if not confirmation:
        try:
            await db.shipment_confirmations.update_one(
                {"_id": f"confirmation:{match_id}"},
                {"$setOnInsert": {"shipment_id": shipment_id, "match_id": match_id,
                    "sender_id": transaction["sender_id"], "traveler_id": transaction["traveler_id"],
                    "pickup_confirmed_at": None, "delivery_confirmed_at": None,
                    "pickup_attempts": 0, "delivery_attempts": 0, "created_at": now}},
                upsert=True,
            )
        except DuplicateKeyError:
            pass  # Another worker created the same deterministic record.
        confirmation = await db.shipment_confirmations.find_one({"_id": f"confirmation:{match_id}"})

    await db.shipment_chats.update_one({"shipment_id": shipment_id}, {"$addToSet": {"participants": transaction["traveler_id"]}})
    if paid.modified_count:
        await notification_manager.send_notification(transaction["traveler_id"], {
            "type": "payment_received", "id": f"pay-{transaction['session_id']}",
            "title": "Payment Received!", "message": "The sender has paid. You can now arrange pickup.",
            "match_id": match_id, "timestamp": now, "link": f"/shipment/{shipment_id}",
        })
        await create_system_message(shipment_id, SystemMessageType.PAYMENT_COMPLETED,
            f"Payment of ${transaction['amount']} received and held in escrow.", {"amount": transaction["amount"]})
    notice = None
    if not confirmation.get("pickup_code_hash") and not confirmation.get("pickup_confirmed_at") and match.get("status") == "paid":
        try:
            await _send_confirmation_code(shipment, match, confirmation, "pickup", request, initial=True)
        except HTTPException as exc:
            if exc.status_code not in {400, 429, 502}:
                raise
            notice = "Payment completed, but the pickup email is unavailable or still sending. Request a pickup code from shipment tracking."
    return {"confirmation_notice": notice, "shipment_id": shipment_id}


@api_router.get("/payments/status/{session_id}")
async def get_payment_status(
    request: Request,
    session_id: str,
    current_user: User = Depends(get_current_user)
):
    """Check payment status and update records"""
    _ensure_payments_enabled()
    # Find the transaction
    transaction = await db.payment_transactions.find_one(
        {"session_id": session_id}, {"_id": 0}
    )
    if not transaction:
        raise HTTPException(status_code=404, detail="Payment transaction not found")
    
    # Verify access
    if current_user.id not in [transaction["sender_id"], transaction["traveler_id"]]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    checkout_status = await stripe_gateway.retrieve(session_id)
    validate_payment_session(checkout_status, transaction)

    new_payment_status = checkout_status["payment_status"]
    # A paid webhook may precede this poll; reconciliation must still run.
    await db.payment_transactions.update_one(
        {"session_id": session_id, "payment_status": {"$ne": "paid"}},
        {"$set": {"payment_status": new_payment_status, "status": checkout_status["status"],
                  "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    confirmation_status = {}
    if new_payment_status == "paid":
        confirmation_status = await _complete_paid_payment(transaction, request)

    return {
        "status": checkout_status["status"],
        "payment_status": checkout_status["payment_status"],
        "amount_total": checkout_status["amount_total"],
        "currency": checkout_status["currency"],
        "metadata": checkout_status["metadata"],
        **confirmation_status,
    }


async def _stripe_receipt_object(path: str, expand: Optional[str] = None):
    """Read only the Stripe objects needed for a receipt; never log provider data."""
    try:
        async with httpx.AsyncClient(timeout=15.0) as http:
            result = await http.get(
                f"https://api.stripe.com/v1/{path}",
                headers={"Authorization": f"Bearer {stripe_api_key}", "Stripe-Version": "2024-06-20"},
                params={"expand[]": expand} if expand else None,
            )
            result.raise_for_status()
            data = result.json()
        if not isinstance(data, dict) or data.get("id") != path.rsplit("/", 1)[-1]:
            raise ValueError("Invalid Stripe response")
        return data
    except (httpx.HTTPError, ValueError):
        raise HTTPException(status_code=502, detail="Could not retrieve the Stripe receipt. Please try again.") from None


@api_router.get("/payments/receipt/{session_id}")
async def get_payment_receipt(
    session_id: str,
    response: Response,
    current_user: User = Depends(get_current_user),
):
    """Resolve a fresh hosted receipt for the paying sender or an administrator."""
    response.headers["Cache-Control"] = "no-store"
    if not re.fullmatch(r"cs_[A-Za-z0-9_]+", session_id):
        raise HTTPException(status_code=400, detail="Invalid Checkout Session ID")
    transaction = await db.payment_transactions.find_one(
        {"session_id": session_id}, {"_id": 0, "sender_id": 1},
    )
    if not transaction:
        raise HTTPException(status_code=404, detail="Payment transaction not found")
    # Payment-status visibility for travelers does not grant access to payer receipts.
    if current_user.id != transaction.get("sender_id") and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only the paying sender or an admin can access this receipt")
    _ensure_payments_enabled()

    session = await _stripe_receipt_object(f"checkout/sessions/{session_id}", "payment_intent.latest_charge")
    if session.get("id") != session_id:
        raise HTTPException(status_code=502, detail="Could not verify the Stripe payment receipt")
    if session.get("status") != "complete" or session.get("payment_status") != "paid":
        raise HTTPException(status_code=409, detail="A receipt is available only after payment is completed")

    # The stored match.payment_intent_id is historically a cs_ ID. Follow Stripe's
    # actual relationship instead; support expanded objects and ID-only responses.
    intent = session.get("payment_intent")
    if isinstance(intent, str) and re.fullmatch(r"pi_[A-Za-z0-9]+", intent):
        intent = await _stripe_receipt_object(f"payment_intents/{intent}", "latest_charge")
    if not isinstance(intent, dict):
        raise HTTPException(status_code=404, detail="Stripe has not made a receipt available for this payment yet")
    if intent.get("status") != "succeeded":
        raise HTTPException(status_code=409, detail="A receipt is available only after payment is completed")
    charge = intent.get("latest_charge")
    if isinstance(charge, str) and re.fullmatch(r"ch_[A-Za-z0-9]+", charge):
        charge = await _stripe_receipt_object(f"charges/{charge}")
    if not isinstance(charge, dict):
        raise HTTPException(status_code=404, detail="Stripe has not made a receipt available for this payment yet")
    if not intent.get("id") or charge.get("payment_intent") != intent["id"]:
        raise HTTPException(status_code=502, detail="Could not verify the Stripe payment receipt")
    if charge.get("paid") is not True or charge.get("status") != "succeeded":
        raise HTTPException(status_code=409, detail="A receipt is available only after payment is completed")
    receipt_url = charge.get("receipt_url")
    if not receipt_url:
        raise HTTPException(status_code=404, detail="Stripe has not made a receipt available for this payment yet")
    try:
        url = urlsplit(receipt_url)
        valid_url = (url.scheme == "https" and url.hostname == "pay.stripe.com"
                     and url.port in (None, 443) and not url.username and not url.password
                     and url.path.startswith("/receipts/"))
    except (TypeError, ValueError, AttributeError):
        valid_url = False
    if not valid_url:
        raise HTTPException(status_code=502, detail="Stripe returned an invalid receipt link. Please try again.")
    # Do not persist an expiring URL or return the underlying Stripe objects.
    return {"receipt_url": receipt_url}


@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """Verify raw bytes before inspecting the event or touching the database."""
    _ensure_payments_enabled()
    event = verify_webhook(await request.body(), request.headers.get("Stripe-Signature"),
                           settings.webhook_secret, settings.stripe_live)
    if event.get("type") not in {"checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.expired", "checkout.session.async_payment_failed"}:
        return {"status": "ok"}
    session_id = event.get("data", {}).get("object", {}).get("id")
    transaction = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not transaction:
        # Creation may have reached Stripe before its DB write. Retry the event
        # rather than silently losing a legitimate payment on this account.
        if event.get("data", {}).get("object", {}).get("metadata", {}).get("match_id"):
            raise HTTPException(503, "Payment record not yet available; retry required")
        return {"status": "ok"}
    session = await stripe_gateway.retrieve(session_id)
    validate_payment_session(session, transaction)
    await db.payment_transactions.update_one(
        {"session_id": session_id, "payment_status": {"$ne": "paid"}},
        {"$set": {"payment_status": session["payment_status"], "event_type": event["type"],
                  "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    if session["payment_status"] == "paid":
        await _complete_paid_payment(transaction, request)
    return {"status": "ok"}


# Include router
app.include_router(api_router)


# ---------------------------------------------------------------------------
# Public utility routes (NOT under /api prefix — served at site root)
# ---------------------------------------------------------------------------
@app.get("/api/health")
async def health_check():
    """Lightweight liveness probe (returns fast, no DB roundtrip)."""
    return {"status": "ok", "service": "sendjet"}


@app.get("/api/sitemap.xml")
async def sitemap():
    """Dynamic sitemap for search engines.
    
    Includes:
      - Static public routes (landing, marketplace, about, faq, safety, etc.)
      - All active trips and shipments (public detail pages)
    """
    from fastapi.responses import Response
    
    base = settings.public_site_url
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    urls = [
        (f"{base}/",           now, "daily",   "1.0"),
        (f"{base}/marketplace", now, "hourly", "0.9"),
        (f"{base}/about",      now, "monthly", "0.6"),
        (f"{base}/faq",        now, "monthly", "0.7"),
        (f"{base}/safety",     now, "monthly", "0.6"),
        (f"{base}/contact",    now, "monthly", "0.4"),
        (f"{base}/impressum",  now, "yearly",  "0.2"),
        (f"{base}/legal",      now, "yearly",  "0.2"),
    ]
    
    # Active trips (public browsable listings). Cap at 2000 for sitemap size sanity.
    try:
        trips_cursor = db.trips.find(
            {"status": "active"}, {"_id": 0, "id": 1, "created_at": 1}
        ).limit(2000)
        async for t in trips_cursor:
            lastmod = str(t.get("created_at", now))[:10] or now
            urls.append((f"{base}/trip/{t['id']}", lastmod, "weekly", "0.7"))
        
        shipments_cursor = db.shipments.find(
            {"status": {"$in": ["pending", "matched"]}}, {"_id": 0, "id": 1, "created_at": 1}
        ).limit(2000)
        async for s in shipments_cursor:
            lastmod = str(s.get("created_at", now))[:10] or now
            urls.append((f"{base}/shipment/{s['id']}", lastmod, "weekly", "0.6"))
    except Exception as e:
        logger.warning(f"sitemap listing scan skipped: {e}")
    
    parts = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for loc, lastmod, freq, prio in urls:
        parts.append(
            f"<url><loc>{loc}</loc><lastmod>{lastmod}</lastmod>"
            f"<changefreq>{freq}</changefreq><priority>{prio}</priority></url>"
        )
    parts.append("</urlset>")
    return Response(content="\n".join(parts), media_type="application/xml")


# CORS middleware
# Note: When allow_origins=["*"], browsers REJECT responses with allow_credentials=True
# (spec violation). This app uses JWT in the Authorization header — no cookies — so we
# only enable credentials when explicit origins are configured.
_cors_origins = list(settings.cors_origins)
_allow_credentials = not (len(_cors_origins) == 1 and _cors_origins[0] == '*')
app.add_middleware(
    CORSMiddleware,
    allow_credentials=_allow_credentials,
    allow_origins=_cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def initialize_demo_listings():
    # No legacy migrations, expiration jobs, or real-record writes on restart.
    if settings.enable_demo_data:
        await seed_demo_data(db)
        await refresh_demo_listings(db)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()