from fastapi import FastAPI, APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from fastapi.responses import PlainTextResponse, Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorGridFSBucket
import os
import io
import csv
import random
import string
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from enum import Enum
import uuid
from datetime import datetime, timezone, date, timedelta
from jose import jwt, JWTError
import hashlib
import httpx
from passlib.context import CryptContext

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# msg91_client kept in codebase but dormant (OTP flow retired in favour of password auth)
import msg91_client
import email_service
import export_service
import gridfs_images

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _pre_hash(password: str) -> str:
    """SHA-256 pre-hash to sidestep bcrypt's 72-byte truncation limit."""
    return hashlib.sha256(password.encode()).hexdigest()


def hash_password(password: str) -> str:
    return pwd_context.hash(_pre_hash(password))


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return pwd_context.verify(_pre_hash(plain), hashed)
    except Exception:
        return False

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

image_bucket = AsyncIOMotorGridFSBucket(db, bucket_name="worker_images")

JWT_SECRET = os.environ.get('JWT_SECRET', 'dev_secret')
JWT_ALGORITHM = os.environ.get('JWT_ALGORITHM', 'HS256')
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get('ACCESS_TOKEN_EXPIRE_MINUTES', '43200'))
USE_DEV_OTP = os.environ.get('USE_DEV_OTP', 'true').lower() == 'true'
DEV_OTP_CODE = os.environ.get('DEV_OTP_CODE', '123456')
OTP_SEND_COOLDOWN_SECONDS = int(os.environ.get('OTP_SEND_COOLDOWN_SECONDS', '30'))
OTP_MAX_PER_HOUR = int(os.environ.get('OTP_MAX_PER_HOUR', '5'))

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


def gen_referral_code() -> str:
    return "KAR-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=5))


# ---------------------------------------------------------------------------
# Enums / Models
# ---------------------------------------------------------------------------
ARTISAN_ROLES = {"karigar"}
ADMIN_ROLES = {"admin"}
VERIFY_ROLES = {"admin"}


class RegisterPayload(BaseModel):
    phone: str
    password: str
    role: str = "karigar"


class LoginPayload(BaseModel):
    phone: str
    password: str


class CreateAdminPayload(BaseModel):
    phone: str
    password: str


class WorkerProfilePayload(BaseModel):
    full_name: str
    gender: str
    languages: List[str]
    area: str
    city: str = "Hyderabad"
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None
    skills: List[str]
    years_experience: int = 0
    current_employer: Optional[str] = None
    previous_employer: Optional[str] = None
    wage_expectation: Optional[int] = None
    upi_id: Optional[str] = None
    portfolio_images: List[str] = []
    aadhar_images: List[str] = []
    employment_proof_type: Optional[str] = None
    employment_proof_images: List[str] = []
    availability_status: str = "not_available"
    available_from: Optional[str] = None
    referred_by_code: Optional[str] = None


class AvailabilityPayload(BaseModel):
    availability_status: str
    available_from: Optional[str] = None


class RejectPayload(BaseModel):
    reason: Optional[str] = None


class SkillPayload(BaseModel):
    name: str


class AdminRegisterWorkerPayload(WorkerProfilePayload):
    mobile: str


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------
def create_access_token(user_id: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": user_id, "role": role, "exp": expire}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


from fastapi import Request


async def get_current_user(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    token = auth.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    user.pop("_id", None)
    return user


def require_roles(*roles):
    async def dep(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Not enough permissions")
        return user
    return dep


def clean(doc: dict) -> dict:
    if doc:
        doc.pop("_id", None)
    return doc


async def worker_for_user(user: dict) -> Optional[dict]:
    w = await db.workers.find_one({"phone": user["phone"]})
    return clean(w) if w else None


# ---------------------------------------------------------------------------
# Auth routes (phone + password)
# ---------------------------------------------------------------------------
def _validate_phone(phone: str) -> str:
    phone = phone.strip()
    if len(phone) != 10 or not phone.isdigit():
        raise HTTPException(status_code=400, detail="Enter a valid 10-digit mobile number")
    if phone[0] not in ("6", "7", "8", "9"):
        raise HTTPException(status_code=400, detail="Mobile number must start with 6, 7, 8 or 9")
    return phone


def _validate_password(password: str):
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")


def _auth_response(user: dict, has_profile: bool) -> dict:
    token = create_access_token(user["id"], user["role"])
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "phone": user["phone"],
            "role": user["role"],
            "has_profile": has_profile,
        },
    }


@api_router.get("/auth/admin/exists")
async def admin_exists():
    """Public: tells the staff portal whether first-admin signup is still open."""
    count = await db.users.count_documents({"role": "admin"})
    return {"exists": count > 0}


@api_router.post("/auth/register")
async def register(payload: RegisterPayload):
    phone = _validate_phone(payload.phone)
    _validate_password(payload.password)
    role = payload.role if payload.role in ("karigar", "admin") else "karigar"

    if role == "admin":
        admin_count = await db.users.count_documents({"role": "admin"})
        if admin_count > 0:
            raise HTTPException(status_code=403, detail="Admin registration is closed. Ask an existing admin to add you.")

    if await db.users.find_one({"phone": phone}):
        raise HTTPException(status_code=400, detail="This mobile number is already registered. Please log in.")

    user = {
        "id": new_id(),
        "phone": phone,
        "role": role,
        "password_hash": hash_password(payload.password),
        "created_at": now_iso(),
    }
    await db.users.insert_one(dict(user))
    worker = await db.workers.find_one({"phone": phone})
    return _auth_response(user, worker is not None)


@api_router.post("/auth/login")
async def login(payload: LoginPayload):
    phone = payload.phone.strip()
    user = await db.users.find_one({"phone": phone})
    if not user or not verify_password(payload.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Incorrect mobile number or password")
    user = clean(user)
    worker = await db.workers.find_one({"phone": phone})
    return _auth_response(user, worker is not None)


@api_router.post("/auth/admin/create")
async def create_admin(payload: CreateAdminPayload, current: dict = Depends(require_roles("admin"))):
    """Invite-only: an existing admin creates another admin."""
    phone = _validate_phone(payload.phone)
    _validate_password(payload.password)
    if await db.users.find_one({"phone": phone}):
        raise HTTPException(status_code=400, detail="This mobile number is already registered")
    user = {
        "id": new_id(),
        "phone": phone,
        "role": "admin",
        "password_hash": hash_password(payload.password),
        "created_at": now_iso(),
        "created_by": current["id"],
    }
    await db.users.insert_one(dict(user))
    return {"success": True, "phone": phone}


@api_router.get("/auth/admins")
async def list_admins(current: dict = Depends(require_roles("admin"))):
    admins = await db.users.find({"role": "admin"}).sort("created_at", 1).to_list(200)
    return [{"id": a["id"], "phone": a["phone"], "created_at": a.get("created_at"),
             "is_you": a["id"] == current["id"]} for a in admins]


@api_router.get("/auth/me")
async def auth_me(user: dict = Depends(get_current_user)):
    worker = await db.workers.find_one({"phone": user["phone"]})
    return {
        "id": user["id"],
        "phone": user["phone"],
        "role": user["role"],
        "has_profile": worker is not None,
    }


# ---------------------------------------------------------------------------
# Skills
# ---------------------------------------------------------------------------
@api_router.get("/skills")
async def list_skills(user: dict = Depends(get_current_user)):
    skills = await db.skills.find().sort("name", 1).to_list(200)
    return [clean(s) for s in skills]


@api_router.post("/skills")
async def add_skill(payload: SkillPayload, user: dict = Depends(require_roles("admin"))):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Skill name required")
    existing = await db.skills.find_one({"name": name})
    if existing:
        raise HTTPException(status_code=400, detail="Skill already exists")
    skill = {"id": new_id(), "name": name, "created_at": now_iso()}
    await db.skills.insert_one(dict(skill))
    return clean(skill)


@api_router.delete("/skills/{skill_id}")
async def delete_skill(skill_id: str, user: dict = Depends(require_roles("admin"))):
    await db.skills.delete_one({"id": skill_id})
    return {"success": True}


# ---------------------------------------------------------------------------
# Location (reverse geocoding)
# ---------------------------------------------------------------------------
@api_router.get("/geocode/reverse")
async def reverse_geocode(lat: float, lng: float, user: dict = Depends(get_current_user)):
    """Server-side proxy to OpenStreetMap Nominatim. Proxying (rather than
    calling Nominatim directly from the client) keeps a single, descriptive
    User-Agent as required by Nominatim's usage policy, and lets us apply
    one rate-limit point for the whole app instead of 400 uncoordinated
    client-side callers."""
    try:
        async with httpx.AsyncClient(timeout=10) as client_http:
            resp = await client_http.get(
                "https://nominatim.openstreetmap.org/reverse",
                params={"lat": lat, "lon": lng, "format": "jsonv2", "zoom": 16},
                headers={"User-Agent": "KarigarApp/1.0 (contact: pixels@aisharao.com)"},
            )
        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail="Location lookup failed, please enter your area manually")
        data = resp.json()
        addr = data.get("address", {})
        # Nominatim's "suburb"/"neighbourhood" fields map best to an Indian
        # locality/area name; fall back progressively if unavailable.
        area = (
            addr.get("suburb") or addr.get("neighbourhood") or addr.get("residential")
            or addr.get("village") or addr.get("town") or ""
        )
        city = addr.get("city") or addr.get("state_district") or addr.get("county") or ""
        return {
            "area": area,
            "city": city,
            "display_name": data.get("display_name", ""),
            "lat": lat,
            "lng": lng,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.warning("Reverse geocode failed: %s", e)
        raise HTTPException(status_code=502, detail="Location lookup failed, please enter your area manually")


# ---------------------------------------------------------------------------
# Worker (artisan self-service)
# ---------------------------------------------------------------------------
@api_router.get("/workers/me")
async def get_my_profile(user: dict = Depends(get_current_user)):
    worker = await worker_for_user(user)
    if not worker:
        raise HTTPException(status_code=404, detail="Profile not found")
    return await gridfs_images.hydrate_worker(image_bucket, worker)


async def _build_worker_doc(payload: WorkerProfilePayload, phone: str, user_id: Optional[str], duplicate_flags: Optional[List[str]] = None) -> dict:
    code = gen_referral_code()
    while await db.workers.find_one({"referral_code": code}):
        code = gen_referral_code()

    img_meta = {"phone": phone}
    portfolio_refs = await gridfs_images.store_images(image_bucket, payload.portfolio_images, metadata=img_meta)
    aadhar_refs = await gridfs_images.store_images(image_bucket, payload.aadhar_images, metadata=img_meta)
    proof_refs = await gridfs_images.store_images(image_bucket, payload.employment_proof_images, metadata=img_meta)

    return {
        "id": new_id(),
        "phone": phone,
        "user_id": user_id,
        "full_name": payload.full_name.strip(),
        "gender": payload.gender,
        "languages": payload.languages,
        "area": payload.area.strip(),
        "city": (payload.city or "Hyderabad").strip(),
        "location_lat": payload.location_lat,
        "location_lng": payload.location_lng,
        "skills": payload.skills,
        "years_experience": payload.years_experience,
        "current_employer": payload.current_employer,
        "previous_employer": payload.previous_employer,
        "wage_expectation": payload.wage_expectation,
        "upi_id": payload.upi_id,
        "portfolio_images": portfolio_refs,
        "portfolio_image_hashes": _hash_images(payload.portfolio_images),
        "aadhar_images": aadhar_refs,
        "aadhar_image_hashes": _hash_images(payload.aadhar_images),
        "employment_proof_type": payload.employment_proof_type,
        "employment_proof_images": proof_refs,
        "referral_code": code,
        "referred_by_code": payload.referred_by_code,
        "availability_status": payload.availability_status or "not_available",
        "available_from": payload.available_from,
        "verification_status": "pending",
        "verified_by": None,
        "verified_at": None,
        "rejection_reason": None,
        "duplicate_flags": duplicate_flags or [],
        "history": [],
        "profile_submitted_at": now_iso(),
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }


# Fields captured in a version snapshot when a profile is edited.
_SNAPSHOT_FIELDS = [
    "full_name", "gender", "languages", "area", "city",
    "location_lat", "location_lng", "skills",
    "years_experience", "current_employer", "previous_employer", "wage_expectation",
    "upi_id", "portfolio_images", "aadhar_images", "employment_proof_type",
    "employment_proof_images", "availability_status", "available_from",
    "verification_status",
]


def _make_snapshot(worker: dict, edited_by: str) -> dict:
    """Snapshot the current ('before') profile state for version history.

    Image fields are intentionally excluded: they are large and can be
    retrieved from GridFS (new uploads) or the current document (legacy
    base64) at any time.  Excluding them keeps the history array small
    regardless of how many edits accumulate.
    """
    snap = {f: worker.get(f) for f in _SNAPSHOT_FIELDS if f not in gridfs_images.IMAGE_FIELDS}
    snap["snapshot_at"] = worker.get("updated_at") or now_iso()
    snap["archived_at"] = now_iso()
    snap["edited_by"] = edited_by
    return snap


async def _profile_update_fields(payload: WorkerProfilePayload, worker: dict) -> dict:
    img_meta = {"phone": worker.get("phone", "")}
    portfolio_refs = await gridfs_images.store_images(image_bucket, payload.portfolio_images, metadata=img_meta)
    aadhar_refs = await gridfs_images.store_images(image_bucket, payload.aadhar_images, metadata=img_meta)
    proof_refs = await gridfs_images.store_images(image_bucket, payload.employment_proof_images, metadata=img_meta)
    return {
        "full_name": payload.full_name.strip(),
        "gender": payload.gender,
        "languages": payload.languages,
        "area": payload.area.strip(),
        "city": (payload.city or "Hyderabad").strip(),
        "location_lat": payload.location_lat,
        "location_lng": payload.location_lng,
        "skills": payload.skills,
        "years_experience": payload.years_experience,
        "current_employer": payload.current_employer,
        "previous_employer": payload.previous_employer,
        "wage_expectation": payload.wage_expectation,
        "upi_id": payload.upi_id,
        "portfolio_images": portfolio_refs,
        "portfolio_image_hashes": _hash_images(payload.portfolio_images),
        "aadhar_images": aadhar_refs,
        "aadhar_image_hashes": _hash_images(payload.aadhar_images),
        "employment_proof_type": payload.employment_proof_type,
        "employment_proof_images": proof_refs,
        "availability_status": payload.availability_status or worker.get("availability_status"),
        "available_from": payload.available_from,
        "updated_at": now_iso(),
    }


async def _register_referral(worker: dict):
    code = worker.get("referred_by_code")
    if not code:
        return
    referrer = await db.workers.find_one({"referral_code": code})
    if not referrer:
        return
    ref = {
        "id": new_id(),
        "referrer_worker_id": referrer["id"],
        "referred_worker_id": worker["id"],
        "status": "pending",
        "payout_amount_rs": 50,
        "razorpay_payout_id": None,
        "created_at": now_iso(),
    }
    await db.referrals.insert_one(dict(ref))


# ---------------------------------------------------------------------------
# Duplicate detection (registration-time checks)
# ---------------------------------------------------------------------------
def _hash_data_url(data_url: str) -> Optional[str]:
    """SHA-256 over the raw image bytes (not the data: prefix), so identical
    photos hash identically regardless of how the client encoded the wrapper."""
    if not data_url:
        return None
    try:
        b64 = data_url.split(",", 1)[1] if "," in data_url else data_url
        raw = __import__("base64").b64decode(b64)
        return hashlib.sha256(raw).hexdigest()
    except Exception:
        return None


def _hash_images(images: List[str]) -> List[str]:
    return [h for h in (_hash_data_url(img) for img in (images or [])) if h]


async def _check_hard_blocks(phone: str, upi_id: Optional[str], exclude_worker_id: Optional[str] = None):
    """Mobile number and PhonePe/GPay number: hard blocks per business decision.
    NOTE: UPI is hard-blocked per explicit instruction, despite shared family
    UPI accounts being a known false-positive risk in this worker demographic."""
    query: dict = {"phone": phone}
    if exclude_worker_id:
        query["id"] = {"$ne": exclude_worker_id}
    if await db.workers.find_one(query):
        raise HTTPException(status_code=400, detail="A worker with this mobile number is already registered")

    if upi_id:
        query = {"upi_id": upi_id}
        if exclude_worker_id:
            query["id"] = {"$ne": exclude_worker_id}
        existing = await db.workers.find_one(query)
        if existing:
            raise HTTPException(
                status_code=400,
                detail=f"This PhonePe/Google Pay number is already registered to {existing.get('full_name', 'another worker')}",
            )


async def _check_aadhaar_image_reuse(aadhaar_hashes: List[str], exclude_worker_id: Optional[str] = None):
    """Hard block: identical Aadhaar card photo (by file hash) reused across
    two different worker registrations. Does NOT verify Aadhaar numbers
    (no such field exists) and will not catch two different photos of the
    same physical card."""
    if not aadhaar_hashes:
        return
    query: dict = {"aadhar_image_hashes": {"$in": aadhaar_hashes}}
    if exclude_worker_id:
        query["id"] = {"$ne": exclude_worker_id}
    existing = await db.workers.find_one(query)
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"This Aadhaar card image is already on file for {existing.get('full_name', 'another worker')}. Possible duplicate registration.",
        )


async def _check_portfolio_image_reuse(portfolio_hashes: List[str], exclude_worker_id: Optional[str] = None) -> Optional[str]:
    """Soft fraud signal: identical portfolio photo reused by a different
    worker. Does not block; returns a warning string for the admin queue."""
    if not portfolio_hashes:
        return None
    query: dict = {"portfolio_image_hashes": {"$in": portfolio_hashes}}
    if exclude_worker_id:
        query["id"] = {"$ne": exclude_worker_id}
    existing = await db.workers.find_one(query)
    if existing:
        return f"Portfolio image also used by {existing.get('full_name', 'another worker')} (phone ending {existing.get('phone', '')[-4:]}) — possible duplicate/fraud."
    return None


async def _check_name_duplicate(full_name: str, exclude_worker_id: Optional[str] = None) -> Optional[str]:
    """Allowed duplicate per business decision (common names in this
    demographic). Returns a flag string for the admin queue, never blocks."""
    query: dict = {"full_name": {"$regex": f"^{full_name.strip()}$", "$options": "i"}}
    if exclude_worker_id:
        query["id"] = {"$ne": exclude_worker_id}
    existing = await db.workers.find_one(query)
    if existing:
        return f"Name matches an existing worker (phone ending {existing.get('phone', '')[-4:]}) — verify these are different people."
    return None


async def _run_duplicate_checks(payload: "WorkerProfilePayload", phone: str, exclude_worker_id: Optional[str] = None) -> List[str]:
    """Runs all hard blocks (raises HTTPException on failure) then collects
    soft-warning flags for the admin verification queue. Returns the list of
    duplicate_flags to store on the worker document."""
    await _check_hard_blocks(phone, payload.upi_id, exclude_worker_id)

    aadhaar_hashes = _hash_images(payload.aadhar_images)
    await _check_aadhaar_image_reuse(aadhaar_hashes, exclude_worker_id)

    flags = []
    portfolio_hashes = _hash_images(payload.portfolio_images)
    portfolio_flag = await _check_portfolio_image_reuse(portfolio_hashes, exclude_worker_id)
    if portfolio_flag:
        flags.append(portfolio_flag)
    name_flag = await _check_name_duplicate(payload.full_name, exclude_worker_id)
    if name_flag:
        flags.append(name_flag)
    return flags


@api_router.post("/workers")
async def create_my_profile(payload: WorkerProfilePayload, user: dict = Depends(get_current_user)):
    existing = await db.workers.find_one({"phone": user["phone"]})
    if existing:
        raise HTTPException(status_code=400, detail="Profile already exists")
    duplicate_flags = await _run_duplicate_checks(payload, user["phone"])
    doc = await _build_worker_doc(payload, user["phone"], user["id"], duplicate_flags)
    await db.workers.insert_one(dict(doc))
    await _register_referral(doc)
    # notify admins
    await db.notifications.insert_one({
        "id": new_id(), "recipient_worker_id": None, "recipient_admin_id": "ALL",
        "type": "verification_update",
        "title_en": "New profile submitted", "title_hi": "नया प्रोफ़ाइल जमा हुआ", "title_te": "కొత్త ప్రొఫైల్ సమర్పించబడింది",
        "body_en": f"{doc['full_name']} submitted a profile for review.",
        "body_hi": f"{doc['full_name']} ने समीक्षा के लिए प्रोफ़ाइल जमा की।",
        "body_te": f"{doc['full_name']} సమీక్ష కోసం ప్రొఫైల్‌ను సమర్పించారు.",
        "is_read": False, "created_at": now_iso(),
    })
    return clean(doc)


@api_router.put("/workers/me")
async def update_my_profile(payload: WorkerProfilePayload, user: dict = Depends(get_current_user)):
    worker = await db.workers.find_one({"phone": user["phone"]})
    if not worker:
        raise HTTPException(status_code=404, detail="Profile not found")
    duplicate_flags = await _run_duplicate_checks(payload, user["phone"], exclude_worker_id=worker["id"])
    update = await _profile_update_fields(payload, worker)
    update["duplicate_flags"] = duplicate_flags
    # A worker editing their own profile sends it back for re-verification.
    update["verification_status"] = "pending"
    update["verified_by"] = None
    update["verified_at"] = None
    update["rejection_reason"] = None
    snapshot = _make_snapshot(worker, edited_by="worker")
    await db.workers.update_one(
        {"id": worker["id"]},
        {"$set": update, "$push": {"history": snapshot}},
    )
    # Notify admins that the updated profile needs re-verification.
    await db.notifications.insert_one({
        "id": new_id(), "recipient_worker_id": None, "recipient_admin_id": "ALL",
        "type": "verification_update",
        "title_en": "Profile updated — re-verify", "title_hi": "प्रोफ़ाइल अपडेट — पुनः सत्यापन", "title_te": "ప్రొఫైల్ నవీకరణ — మళ్లీ ధృవీకరణ",
        "body_en": f"{update['full_name']} edited their profile and needs re-verification.",
        "body_hi": f"{update['full_name']} ने अपना प्रोफ़ाइल संपादित किया और पुनः सत्यापन आवश्यक है।",
        "body_te": f"{update['full_name']} తమ ప్రొఫైల్‌ను సవరించారు, మళ్లీ ధృవీకరణ అవసరం.",
        "is_read": False, "created_at": now_iso(),
    })
    updated = await db.workers.find_one({"id": worker["id"]})
    return await gridfs_images.hydrate_worker(image_bucket, clean(updated))


@api_router.patch("/workers/me/availability")
async def update_availability(payload: AvailabilityPayload, user: dict = Depends(get_current_user)):
    if payload.availability_status not in {"available_now", "available_from", "not_available"}:
        raise HTTPException(status_code=400, detail="Invalid status")
    if payload.availability_status == "available_from" and not payload.available_from:
        raise HTTPException(status_code=400, detail="A date is required for Available From")
    worker = await db.workers.find_one({"phone": user["phone"]})
    if not worker:
        raise HTTPException(status_code=404, detail="Profile not found")
    available_from = payload.available_from if payload.availability_status == "available_from" else None
    await db.workers.update_one(
        {"id": worker["id"]},
        {"$set": {
            "availability_status": payload.availability_status,
            "available_from": available_from,
            "updated_at": now_iso(),
        }},
    )
    return {"availability_status": payload.availability_status, "available_from": available_from}


# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------
@api_router.get("/notifications")
async def get_notifications(user: dict = Depends(get_current_user)):
    if user["role"] in ADMIN_ROLES:
        query = {"recipient_admin_id": "ALL"}
    else:
        worker = await db.workers.find_one({"phone": user["phone"]})
        wid = worker["id"] if worker else "none"
        query = {"recipient_worker_id": wid}
    notifs = await db.notifications.find(query).sort("created_at", -1).to_list(200)
    return [clean(n) for n in notifs]


@api_router.post("/notifications/read-all")
async def mark_all_read(user: dict = Depends(get_current_user)):
    if user["role"] in ADMIN_ROLES:
        query = {"recipient_admin_id": "ALL"}
    else:
        worker = await db.workers.find_one({"phone": user["phone"]})
        wid = worker["id"] if worker else "none"
        query = {"recipient_worker_id": wid}
    await db.notifications.update_many(query, {"$set": {"is_read": True}})
    return {"success": True}


# ---------------------------------------------------------------------------
# Referrals (artisan)
# ---------------------------------------------------------------------------
@api_router.get("/referrals/me")
async def my_referrals(user: dict = Depends(get_current_user)):
    worker = await db.workers.find_one({"phone": user["phone"]})
    if not worker:
        raise HTTPException(status_code=404, detail="Profile not found")
    refs = await db.referrals.find({"referrer_worker_id": worker["id"]}).to_list(200)
    refs = [clean(r) for r in refs]
    paid = sum(r["payout_amount_rs"] for r in refs if r["status"] == "paid")
    pending = sum(r["payout_amount_rs"] for r in refs if r["status"] in ("pending", "reward_triggered"))
    return {
        "referral_code": worker["referral_code"],
        "referred_count": len(refs),
        "total_paid_rs": paid,
        "pending_rs": pending,
        "referrals": refs,
    }


# ---------------------------------------------------------------------------
# Admin
# ---------------------------------------------------------------------------
@api_router.get("/admin/metrics")
async def admin_metrics(user: dict = Depends(require_roles(*ADMIN_ROLES))):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    total = await db.workers.count_documents({})
    verified = await db.workers.count_documents({"verification_status": "approved"})
    available = await db.workers.count_documents({"availability_status": "available_now"})
    pending = await db.workers.count_documents({"verification_status": "pending"})
    new_today = await db.workers.count_documents({"created_at": {"$gte": today}})
    open_reqs = await db.employer_requirements.count_documents({"status": "open"})
    return {
        "total_workers": total,
        "verified_workers": verified,
        "available_workers": available,
        "pending_verification": pending,
        "new_today": new_today,
        "open_requirements": open_reqs,
    }


@api_router.get("/admin/analytics")
async def admin_analytics(user: dict = Depends(require_roles(*ADMIN_ROLES))):
    """Aggregated workforce intelligence for the BI-style admin dashboard."""
    workers = await db.workers.find().to_list(10000)
    total = len(workers)

    # KPI counts
    verified = sum(1 for w in workers if w.get("verification_status") == "approved")
    pending = sum(1 for w in workers if w.get("verification_status") == "pending")
    rejected = sum(1 for w in workers if w.get("verification_status") == "rejected")
    avail_now = sum(1 for w in workers if w.get("availability_status") == "available_now")
    avail_from = sum(1 for w in workers if w.get("availability_status") == "available_from")
    avail_no = sum(1 for w in workers if w.get("availability_status") == "not_available")

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).strftime("%Y-%m-%d")
    new_today = sum(1 for w in workers if (w.get("created_at") or "")[:10] >= today)
    new_week = sum(1 for w in workers if (w.get("created_at") or "")[:10] >= week_ago)

    # Location concentration (by area within city)
    loc: dict = {}
    for w in workers:
        area = (w.get("area") or "Unknown").strip() or "Unknown"
        city = (w.get("city") or "").strip()
        key = f"{area}|{city}"
        loc.setdefault(key, {"area": area, "city": city, "count": 0})
        loc[key]["count"] += 1
    location_distribution = sorted(loc.values(), key=lambda x: x["count"], reverse=True)
    for item in location_distribution:
        item["pct"] = round((item["count"] / total) * 100) if total else 0

    # Skill distribution
    skill_counts: dict = {}
    for w in workers:
        for s in (w.get("skills") or []):
            skill_counts[s] = skill_counts.get(s, 0) + 1
    skill_distribution = sorted(
        [{"skill": k, "count": v} for k, v in skill_counts.items()],
        key=lambda x: x["count"], reverse=True,
    )

    # Experience buckets
    buckets = [
        {"label": "0-2 yrs", "count": 0},
        {"label": "3-5 yrs", "count": 0},
        {"label": "6-10 yrs", "count": 0},
        {"label": "10+ yrs", "count": 0},
    ]
    for w in workers:
        e = w.get("years_experience") or 0
        if e <= 2:
            buckets[0]["count"] += 1
        elif e <= 5:
            buckets[1]["count"] += 1
        elif e <= 10:
            buckets[2]["count"] += 1
        else:
            buckets[3]["count"] += 1

    # Gender split
    gender = {"male": 0, "female": 0, "other": 0}
    for w in workers:
        g = w.get("gender") or "other"
        gender[g] = gender.get(g, 0) + 1

    # Registration trend (last 14 days)
    trend = []
    for i in range(13, -1, -1):
        d = (datetime.now(timezone.utc) - timedelta(days=i)).strftime("%Y-%m-%d")
        c = sum(1 for w in workers if (w.get("created_at") or "")[:10] == d)
        trend.append({"date": d, "count": c})

    return {
        "kpis": {
            "total_workers": total,
            "verified_workers": verified,
            "pending_verification": pending,
            "rejected_workers": rejected,
            "available_workers": avail_now,
            "new_today": new_today,
            "new_this_week": new_week,
        },
        "location_distribution": location_distribution,
        "skill_distribution": skill_distribution,
        "verification_funnel": {"approved": verified, "pending": pending, "rejected": rejected},
        "availability_distribution": {
            "available_now": avail_now,
            "available_from": avail_from,
            "not_available": avail_no,
        },
        "experience_buckets": buckets,
        "gender_distribution": gender,
        "registration_trend": trend,
    }


def _apply_filters(search, skill, availability, verification, city, area, min_exp, max_exp):
    query = {}
    if search:
        query["$or"] = [
            {"full_name": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}},
        ]
    if skill and skill != "all":
        query["skills"] = skill
    if availability and availability != "all":
        query["availability_status"] = availability
    if verification and verification != "all":
        query["verification_status"] = verification
    if city:
        query["city"] = {"$regex": city, "$options": "i"}
    if area:
        query["area"] = {"$regex": area, "$options": "i"}
    exp = {}
    if min_exp is not None:
        exp["$gte"] = min_exp
    if max_exp is not None:
        exp["$lte"] = max_exp
    if exp:
        query["years_experience"] = exp
    return query


@api_router.get("/admin/workers")
async def admin_search_workers(
    user: dict = Depends(require_roles(*ADMIN_ROLES)),
    search: Optional[str] = None,
    skill: Optional[str] = None,
    availability: Optional[str] = None,
    verification: Optional[str] = None,
    city: Optional[str] = None,
    area: Optional[str] = None,
    min_exp: Optional[int] = None,
    max_exp: Optional[int] = None,
    page: int = 1,
    page_size: int = 50,
):
    query = _apply_filters(search, skill, availability, verification, city, area, min_exp, max_exp)
    total = await db.workers.count_documents(query)
    cursor = db.workers.find(
        query,
        {
            "portfolio_images": 0,
            "aadhar_images": 0,
            "employment_proof_images": 0,
        }
    ).sort("created_at", -1).skip((page - 1) * page_size).limit(page_size)
    raw_items = [clean(w) for w in await cursor.to_list(page_size)]
    return {"total": total, "page": page, "page_size": page_size, "items": raw_items}

@api_router.get("/admin/workers/{worker_id}")
async def admin_worker_detail(worker_id: str, user: dict = Depends(require_roles(*ADMIN_ROLES))):
    worker = await db.workers.find_one({"id": worker_id})
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")
    result = clean(worker)
    # Hydrate only one image field at a time to avoid memory spike
    for field in ["portfolio_images", "aadhar_images", "employment_proof_images"]:
        if result.get(field):
            result[field] = await gridfs_images.hydrate_images(
                image_bucket, result[field][:3]  # max 3 images per field
            )
    code = worker.get("referred_by_code")
    if code:
        referrer = await db.workers.find_one({"referral_code": code})
        if referrer:
            result["referred_by"] = {"name": referrer.get("full_name"), "phone": referrer.get("phone")}
    return result


@api_router.put("/admin/workers/{worker_id}")
async def admin_update_worker(worker_id: str, payload: WorkerProfilePayload, user: dict = Depends(require_roles(*ADMIN_ROLES))):
    worker = await db.workers.find_one({"id": worker_id})
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")
    duplicate_flags = await _run_duplicate_checks(payload, worker["phone"], exclude_worker_id=worker_id)
    update = await _profile_update_fields(payload, worker)
    update["duplicate_flags"] = duplicate_flags
    snapshot = _make_snapshot(worker, edited_by="admin")
    await db.workers.update_one(
        {"id": worker_id},
        {"$set": update, "$push": {"history": snapshot}},
    )
    updated = await db.workers.find_one({"id": worker_id})
    return await gridfs_images.hydrate_worker(image_bucket, clean(updated))


@api_router.delete("/admin/workers/{worker_id}")
async def admin_delete_worker(worker_id: str, user: dict = Depends(require_roles(*ADMIN_ROLES))):
    """Permanently deletes a worker profile (any verification status), unlike
    reject which is limited to pending profiles. The artisan's login account
    is kept so they can re-register, consistent with the reject behaviour."""
    worker = await db.workers.find_one({"id": worker_id})
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")
    await gridfs_images.delete_worker_images(image_bucket, worker)
    await db.workers.delete_one({"id": worker_id})
    await db.referrals.delete_many({"$or": [
        {"referred_worker_id": worker_id}, {"referrer_worker_id": worker_id},
    ]})
    await db.notifications.delete_many({"recipient_worker_id": worker_id})
    return {"success": True, "deleted": True}


@api_router.post("/admin/workers")
async def admin_register_worker(payload: AdminRegisterWorkerPayload, user: dict = Depends(require_roles(*ADMIN_ROLES))):
    phone = payload.mobile.strip()
    base = WorkerProfilePayload(**payload.dict(exclude={"mobile"}))
    duplicate_flags = await _run_duplicate_checks(base, phone)
    doc = await _build_worker_doc(base, phone, None, duplicate_flags)
    await db.workers.insert_one(dict(doc))
    await _register_referral(doc)
    return clean(doc)


@api_router.get("/admin/verification/queue")
async def verification_queue(user: dict = Depends(require_roles(*VERIFY_ROLES))):
    cursor = db.workers.find(
        {"verification_status": "pending"},
        {
            "portfolio_images": 0,
            "aadhar_images": 0,
            "employment_proof_images": 0,
        }
    ).sort("created_at", 1)
    raw = [clean(w) for w in await cursor.to_list(200)]
    return raw


async def _notify_worker(worker, ntype, title_en, title_hi, title_te, body_en, body_hi, body_te):
    await db.notifications.insert_one({
        "id": new_id(), "recipient_worker_id": worker["id"], "recipient_admin_id": None,
        "type": ntype,
        "title_en": title_en, "title_hi": title_hi, "title_te": title_te,
        "body_en": body_en, "body_hi": body_hi, "body_te": body_te,
        "is_read": False, "created_at": now_iso(),
    })


@api_router.post("/admin/workers/{worker_id}/approve")
async def approve_worker(worker_id: str, background_tasks: BackgroundTasks, user: dict = Depends(require_roles(*VERIFY_ROLES))):
    worker = await db.workers.find_one({"id": worker_id})
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")
    await db.workers.update_one({"id": worker_id}, {"$set": {
        "verification_status": "approved", "verified_by": user["id"],
        "verified_at": now_iso(), "rejection_reason": None, "updated_at": now_iso(),
    }})
    await _notify_worker(worker, "verification_update",
        "Profile Verified ✓", "प्रोफ़ाइल सत्यापित ✓", "ప్రొఫైల్ ధృవీకరించబడింది ✓",
        "Congratulations! Your profile is now verified.",
        "बधाई हो! आपका प्रोफ़ाइल अब सत्यापित है।",
        "అభినందనలు! మీ ప్రొఫైల్ ఇప్పుడు ధృవీకరించబడింది.")
    # Mock referral payout
    ref = await db.referrals.find_one({"referred_worker_id": worker_id, "status": "pending"})
    if ref:
        referrer = await db.workers.find_one({"id": ref["referrer_worker_id"]})
        if referrer and referrer.get("upi_id"):
            await db.referrals.update_one({"id": ref["id"]}, {"$set": {
                "status": "paid", "razorpay_payout_id": "MOCK_" + new_id()[:8]}})
            await _notify_worker(referrer, "referral_reward",
                "Referral Reward Paid ₹50", "रेफ़रल इनाम ₹50 भेजा गया", "రెఫరల్ రివార్డ్ ₹50 చెల్లించబడింది",
                "₹50 has been sent to your PhonePe/Google Pay number for a successful referral.",
                "एक सफल रेफ़रल के लिए ₹50 आपके PhonePe/Google Pay नंबर पर भेजे गए हैं।",
                "విజయవంతమైన రెఫరల్ కోసం ₹50 మీ PhonePe/Google Pay నంబర్‌కు పంపబడ్డాయి.")
        elif referrer:
            await db.referrals.update_one({"id": ref["id"]}, {"$set": {"status": "reward_triggered"}})
            await _notify_worker(referrer, "referral_reward",
                "Add PhonePe/Google Pay to claim ₹50", "₹50 पाने के लिए PhonePe/Google Pay जोड़ें", "₹50 పొందడానికి PhonePe/Google Pay జోడించండి",
                "You earned ₹50! Add your PhonePe/Google Pay number to claim the reward.",
                "आपने ₹50 कमाए! इनाम पाने के लिए अपना PhonePe/Google Pay नंबर जोड़ें।",
                "మీరు ₹50 సంపాదించారు! రివార్డ్ పొందడానికి మీ PhonePe/Google Pay నంబర్‌ను జోడించండి.")
    updated = await db.workers.find_one({"id": worker_id})
    updated_hydrated = await gridfs_images.hydrate_worker(image_bucket, clean(updated))
    # Email the verified profile (with photos) as a PDF to the company inbox.
    referred_by = None
    code = updated.get("referred_by_code")
    if code:
        referrer = await db.workers.find_one({"referral_code": code})
        if referrer:
            referred_by = {"name": referrer.get("full_name"), "phone": referrer.get("phone")}
    background_tasks.add_task(email_service.send_profile_email, updated_hydrated, referred_by)
    return updated_hydrated


@api_router.post("/admin/workers/{worker_id}/reject")
async def reject_worker(worker_id: str, payload: RejectPayload, user: dict = Depends(require_roles(*VERIFY_ROLES))):
    """Rejecting a profile removes it from the database entirely. The artisan's
    login account is kept so they can re-register a fresh profile."""
    worker = await db.workers.find_one({"id": worker_id})
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")
    await gridfs_images.delete_worker_images(image_bucket, worker)
    await db.workers.delete_one({"id": worker_id})
    await db.referrals.delete_many({"$or": [
        {"referred_worker_id": worker_id}, {"referrer_worker_id": worker_id},
    ]})
    await db.notifications.delete_many({"recipient_worker_id": worker_id})
    return {"success": True, "deleted": True}


@api_router.get("/admin/export", response_class=PlainTextResponse)
async def export_workers_csv(
    user: dict = Depends(require_roles(*ADMIN_ROLES)),
    search: Optional[str] = None,
    skill: Optional[str] = None,
    availability: Optional[str] = None,
    verification: Optional[str] = None,
    city: Optional[str] = None,
    area: Optional[str] = None,
    min_exp: Optional[int] = None,
    max_exp: Optional[int] = None,
):
    """Lightweight summary export (no images) for quick filtering/sorting.
    For the full profile export including Aadhaar/proof/portfolio photos,
    use /admin/export/full instead."""
    query = _apply_filters(search, skill, availability, verification, city, area, min_exp, max_exp)
    workers = await db.workers.find(query).sort("created_at", -1).to_list(5000)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["Worker ID", "Name", "Mobile", "Skills", "City", "Area",
                "Availability", "Verification Status", "Registration Date", "Wage Expectation"])
    for d in workers:
        w.writerow([
            d.get("id"), d.get("full_name"), d.get("phone"), ", ".join(d.get("skills", [])),
            d.get("city"), d.get("area"), d.get("availability_status"),
            d.get("verification_status"), d.get("created_at"), d.get("wage_expectation"),
        ])
    return PlainTextResponse(content=buf.getvalue(), media_type="text/csv",
                             headers={"Content-Disposition": "attachment; filename=workers.csv"})


@api_router.get("/admin/export/full")
async def export_workers_xlsx(
    user: dict = Depends(require_roles(*ADMIN_ROLES)),
    search: Optional[str] = None,
    skill: Optional[str] = None,
    availability: Optional[str] = None,
    verification: Optional[str] = None,
    city: Optional[str] = None,
    area: Optional[str] = None,
    min_exp: Optional[int] = None,
    max_exp: Optional[int] = None,
):
    """Full profile export as .xlsx with every text field plus real embedded
    thumbnails for Aadhaar, employment proof, and portfolio images. CSV
    cannot hold a viewable image, so this is intentionally a separate
    workbook export rather than a CSV variant.

    NOTE: with many workers and multiple images each, this is CPU/memory
    heavier than the summary CSV and may take noticeably longer to generate
    at full 400-worker pilot scale — it's built for spot-checking individual
    profiles, not as a casual bulk-open file."""
    query = _apply_filters(search, skill, availability, verification, city, area, min_exp, max_exp)
    workers = await db.workers.find(query).sort("created_at", -1).to_list(5000)
    workers = [await gridfs_images.hydrate_worker(image_bucket, clean(w)) for w in workers]
    xlsx_bytes = export_service.build_workers_xlsx(workers)
    return Response(
        content=xlsx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=workers_full_export.xlsx"},
    )


# ---------------------------------------------------------------------------
# Seed
# ---------------------------------------------------------------------------
DEFAULT_SKILLS = [
    "Aari", "Zardozi", "Dabka", "Sitara/Sequin", "Mukaish",
    "Machine Embroidery", "Bead Work",
    "Pattern Master", "Cutting Master", "Tailor",
    "Cutting", "Finishing", "Spotting", "Line QC", "Mid QC", "Final QC",
    "Supervisor/Coordinator",
]

SEED_USERS = []


async def _ensure_indexes():
    await db.users.create_index("phone", unique=True)
    await db.users.create_index("role")
    await db.workers.create_index("phone", unique=True)
    await db.workers.create_index("skills")
    await db.workers.create_index("area")
    await db.workers.create_index("availability_status")
    await db.workers.create_index("verification_status")
    await db.workers.create_index("referral_code", unique=True)
    # GridFS chunk lookup (Motor creates files/chunks collections automatically
    # on first upload; this ensures the metadata index is in place early).
    await db["worker_images.files"].create_index("metadata.phone")


@app.on_event("startup")
async def seed_data():
    # Seed reference skill taxonomy (idempotent).
    if await db.skills.count_documents({}) == 0:
        for name in DEFAULT_SKILLS:
            await db.skills.insert_one({"id": new_id(), "name": name, "created_at": now_iso()})
        logger.info("Seeded skills")

    # One-time clean slate for the phone+password auth pivot: wipe legacy OTP
    # users, dummy admins and all demo/sample worker data. Runs exactly once.
    if not await db.meta.find_one({"key": "pwd_auth_migration_v1"}):
        await db.users.delete_many({})
        await db.workers.delete_many({})
        await db.otp_requests.delete_many({})
        await db.referrals.delete_many({})
        await db.notifications.delete_many({})
        await db.meta.insert_one({"key": "pwd_auth_migration_v1", "done_at": now_iso()})
        logger.info("Auth pivot: wiped legacy users/workers/demo data")

    await _ensure_indexes()


@api_router.get("/")
async def root():
    return {"message": "Karigar API"}

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
