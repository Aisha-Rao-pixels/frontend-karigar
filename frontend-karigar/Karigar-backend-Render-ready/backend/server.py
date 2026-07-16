from fastapi import FastAPI, APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from fastapi.responses import PlainTextResponse, Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorGridFSBucket
import os
import io
import asyncio
import csv
import random
import re
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

import msg91_client
import email_service
import export_service
import gridfs_images
import daily_summary_service

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _pre_hash(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def hash_password(password: str) -> str:
    return pwd_context.hash(_pre_hash(password))


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return pwd_context.verify(_pre_hash(plain), hashed)
    except Exception:
        return False

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

image_bucket = AsyncIOMotorGridFSBucket(db, bucket_name="worker_images")

JWT_SECRET = os.environ.get('JWT_SECRET', 'dev_secret')
JWT_ALGORITHM = os.environ.get('JWT_ALGORITHM', 'HS256')
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get('ACCESS_TOKEN_EXPIRE_MINUTES', '43200'))
USE_DEV_OTP = os.environ.get('USE_DEV_OTP', 'true').lower() == 'true'
DEV_OTP_CODE = os.environ.get('DEV_OTP_CODE', '123456')

# Comma-separated list of allowed frontend origins (no trailing slash).
# Falls back to the known Vercel deployment + localhost for local dev if the
# env var isn't set on Render yet.
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.environ.get(
        'ALLOWED_ORIGINS',
        'https://frontend-karigar-swart.vercel.app,http://localhost:8081,http://localhost:19006',
    ).split(',')
    if origin.strip()
]
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


ARTISAN_ROLES = {"karigar"}
ADMIN_ROLES = {"admin"}
VERIFY_ROLES = {"admin"}


class RegisterPayload(BaseModel):
    phone: str
    password: str
    role: str = "karigar"
    referred_by_code: Optional[str] = None


class LoginPayload(BaseModel):
    phone: str
    password: str


class CreateAdminPayload(BaseModel):
    phone: str
    password: str
    name: str = ""
    admin_role: str = "Admin"


class UpdateSelfAdminPayload(BaseModel):
    name: str
    admin_role: str


class DeleteAdminPayload(BaseModel):
    confirm_phone: str


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


class ReferralClickPayload(BaseModel):
    referral_code: str

class BulkMarkPaidPayload(BaseModel):
    referral_ids: list[str]
    amount_per_referral_rs: Optional[int] = None


class AdminRegisterWorkerPayload(WorkerProfilePayload):
    mobile: str


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
    await _register_referral_account(user["id"], phone, payload.referred_by_code)
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
    phone = _validate_phone(payload.phone)
    _validate_password(payload.password)
    if await db.users.find_one({"phone": phone}):
        raise HTTPException(status_code=400, detail="This mobile number is already registered")
    user = {
        "id": new_id(),
        "phone": phone,
        "role": "admin",
        "name": payload.name.strip(),
        "admin_role": payload.admin_role.strip() or "Admin",
        "password_hash": hash_password(payload.password),
        "created_at": now_iso(),
        "created_by": current["id"],
    }
    await db.users.insert_one(dict(user))
    return {"success": True, "phone": phone}


@api_router.get("/auth/admins")
async def list_admins(current: dict = Depends(require_roles("admin"))):
    admins = await db.users.find({"role": "admin"}).sort("created_at", 1).to_list(200)
    return [{"id": a["id"], "phone": a["phone"], "name": a.get("name", ""), "admin_role": a.get("admin_role", "Admin"), "created_at": a.get("created_at"), "is_you": a["id"] == current["id"]} for a in admins]


@api_router.patch("/auth/admin/me")
async def update_self_admin(payload: UpdateSelfAdminPayload, current: dict = Depends(require_roles("admin"))):
    name = payload.name.strip()
    admin_role = payload.admin_role.strip()
    if not name or not admin_role:
        raise HTTPException(status_code=400, detail="Name and role are required")
    # An admin must not be able to grant themselves the "Manager" title (and
    # the delete-admin powers that come with it) just by editing their own
    # profile. Only someone who is already a Manager may keep/set that role;
    # everyone else can rename their designation to anything except "Manager".
    if admin_role.lower() == "manager" and current.get("admin_role") != "Manager":
        raise HTTPException(status_code=403, detail="Only an existing Manager can assign the Manager role. Ask a Manager to update this for you.")
    await db.users.update_one({"id": current["id"]}, {"$set": {"name": name, "admin_role": admin_role}})
    return {"success": True}


@api_router.delete("/auth/admins/{admin_id}")
async def delete_admin(admin_id: str, payload: DeleteAdminPayload, current: dict = Depends(require_roles("admin"))):
    # Defense in depth: deleting an admin requires BOTH the acting admin's
    # role to be "Manager" AND the acting admin to re-confirm their own
    # registered mobile number. Checking role alone is not enough, since a
    # role name is just a mutable profile field — requiring the admin to
    # also prove who they are (their own phone on file) ensures the person
    # performing this destructive action is really the account it appears
    # to be, and keeps a clear, deliberate confirmation step for something
    # that permanently affects admin data.
    if current.get("admin_role") != "Manager":
        raise HTTPException(status_code=403, detail="Only a Manager can remove an admin")
    confirm_phone = (payload.confirm_phone or "").strip()
    if confirm_phone != current.get("phone"):
        raise HTTPException(status_code=403, detail="Mobile number does not match your account. Enter your own registered mobile number to confirm.")
    if admin_id == current["id"]:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")
    target = await db.users.find_one({"id": admin_id, "role": "admin"})
    if not target:
        raise HTTPException(status_code=404, detail="Admin not found")

   # Protected accounts — these can never be deleted by anyone
    PROTECTED_PHONES = {
        "9959602258",  # Ravichandra (owner) — permanently protected
        "9491106575",  # Shashank (Manager) — permanently protected
    }
    target_phone = target.get("phone", "")
    target_name = target.get("name") or "this admin"
    if target_phone in PROTECTED_PHONES:
        raise HTTPException(
            status_code=403,
            detail=f"You cannot delete Mr. {target_name}'s profile. This account is permanently protected."
        )

    # Manager accounts are also protected — no one can delete a Manager
    if target.get("admin_role") == "Manager":
        raise HTTPException(
            status_code=403,
            detail=f"You cannot delete Mr. {target_name}'s profile. Manager accounts are protected."
        )

    await db.users.delete_one({"id": admin_id})
    return {"success": True}


@api_router.get("/auth/me")
async def auth_me(user: dict = Depends(get_current_user)):
    worker = await db.workers.find_one({"phone": user["phone"]})
    return {
        "id": user["id"],
        "phone": user["phone"],
        "role": user["role"],
        "has_profile": worker is not None,
    }


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


@api_router.get("/geocode/reverse")
async def reverse_geocode(lat: float, lng: float, user: dict = Depends(get_current_user)):
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


_SNAPSHOT_FIELDS = [
    "full_name", "gender", "languages", "area", "city",
    "location_lat", "location_lng", "skills",
    "years_experience", "current_employer", "previous_employer", "wage_expectation",
    "upi_id", "portfolio_images", "aadhar_images", "employment_proof_type",
    "employment_proof_images", "availability_status", "available_from",
    "verification_status",
]


def _make_snapshot(worker: dict, edited_by: str) -> dict:
    snap = {f: worker.get(f) for f in _SNAPSHOT_FIELDS}
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


async def _register_referral_account(user_id: str, phone: str, code: Optional[str]):
    if not code:
        return
    code = code.strip().upper()
    referrer = await db.workers.find_one({"referral_code": code})
    if not referrer:
        return
    existing = await db.referrals.find_one({"referred_user_id": user_id})
    if existing:
        return
    ref = {
        "id": new_id(),
        "referrer_worker_id": referrer["id"],
        "referred_worker_id": None,
        "referred_user_id": user_id,
        "referred_phone": phone,
        "status": "account_created",
        "payout_amount_rs": 50,
        "razorpay_payout_id": None,
        "created_at": now_iso(),
    }
    await db.referrals.insert_one(dict(ref))


async def _register_referral(worker: dict):
    code = worker.get("referred_by_code")
    if not code:
        return
    code = code.strip().upper()
    referrer = await db.workers.find_one({"referral_code": code})
    if not referrer:
        return
    existing = await db.referrals.find_one({"referred_phone": worker.get("phone"), "status": "account_created"})
    if existing:
        await db.referrals.update_one({"id": existing["id"]}, {"$set": {
            "referred_worker_id": worker["id"], "status": "pending",
        }})
        return
    ref = {
        "id": new_id(),
        "referrer_worker_id": referrer["id"],
        "referred_worker_id": worker["id"],
        "referred_user_id": None,
        "referred_phone": worker.get("phone"),
        "status": "pending",
        "payout_amount_rs": 50,
        "razorpay_payout_id": None,
        "created_at": now_iso(),
    }
    await db.referrals.insert_one(dict(ref))


def _hash_data_url(data_url: str) -> Optional[str]:
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
    query: dict = {"full_name": {"$regex": f"^{full_name.strip()}$", "$options": "i"}}
    if exclude_worker_id:
        query["id"] = {"$ne": exclude_worker_id}
    existing = await db.workers.find_one(query)
    if existing:
        return f"Name matches an existing worker (phone ending {existing.get('phone', '')[-4:]}) — verify these are different people."
    return None


async def _run_duplicate_checks(payload: "WorkerProfilePayload", phone: str, exclude_worker_id: Optional[str] = None) -> List[str]:
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
    update["verification_status"] = "pending"
    update["verified_by"] = None
    update["verified_at"] = None
    update["rejection_reason"] = None
    snapshot = _make_snapshot(worker, edited_by="worker")
    await db.workers.update_one(
        {"id": worker["id"]},
        {"$set": update, "$push": {"history": snapshot}},
    )
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


@api_router.post("/referrals/track")
async def track_referral_click(payload: ReferralClickPayload):
    code = (payload.referral_code or "").strip().upper()
    if not code:
        return {"success": False}
    referrer = await db.workers.find_one({"referral_code": code})
    if not referrer:
        return {"success": False}
    await db.referral_clicks.insert_one({
        "id": new_id(),
        "referral_code": code,
        "referrer_worker_id": referrer["id"],
        "created_at": now_iso(),
    })
    return {"success": True}


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


@api_router.get("/admin/referrals/overview")
async def admin_referrals_overview(user: dict = Depends(require_roles(*ADMIN_ROLES))):
    workers = await db.workers.find({"referral_code": {"$exists": True}}).to_list(10000)
    clicks = await db.referral_clicks.find().to_list(100000)
    refs = await db.referrals.find().to_list(100000)

    click_counts: dict = {}
    for c in clicks:
        click_counts[c["referral_code"]] = click_counts.get(c["referral_code"], 0) + 1

    reg_by_referrer: dict = {}
    for r in refs:
        reg_by_referrer.setdefault(r["referrer_worker_id"], []).append(r)

    rows = []
    for w in workers:
        code = w.get("referral_code")
        if not code:
            continue
        total_clicks = click_counts.get(code, 0)
        referrer_refs = reg_by_referrer.get(w["id"], [])
        account_created_count = sum(1 for r in referrer_refs if r["status"] == "account_created")
        registered_count = sum(1 for r in referrer_refs if r["status"] in ("pending", "reward_triggered", "paid"))
        total_referred = max(total_clicks, len(referrer_refs))
        not_registered = max(total_referred - registered_count - account_created_count, 0)
        paid_amount = sum(r["payout_amount_rs"] for r in referrer_refs if r["status"] == "paid")
        pending_amount = sum(r["payout_amount_rs"] for r in referrer_refs if r["status"] in ("pending", "reward_triggered"))
        rows.append({
            "worker_id": w["id"],
            "full_name": w.get("full_name") or "Unknown",
            "phone": w.get("phone"),
            "referral_code": code,
            "total_referred": total_referred,
            "registered_count": registered_count,
            "account_created_count": account_created_count,
            "not_registered_count": not_registered,
            "paid_amount_rs": paid_amount,
            "pending_amount_rs": pending_amount,
        })

    rows.sort(key=lambda r: r["total_referred"], reverse=True)
    return {"rows": rows}


@api_router.get("/admin/referrals/{worker_id}/detail")
async def admin_referral_detail(worker_id: str, user: dict = Depends(require_roles(*ADMIN_ROLES))):
    referrer = await db.workers.find_one({"id": worker_id})
    if not referrer:
        raise HTTPException(status_code=404, detail="Referrer not found")

    refs = await db.referrals.find({"referrer_worker_id": worker_id}).sort("created_at", -1).to_list(10000)

    people = []
    for r in refs:
        name = None
        verification_status = None
        if r.get("referred_worker_id"):
            w = await db.workers.find_one({"id": r["referred_worker_id"]})
            if w:
                name = w.get("full_name")
                verification_status = w.get("verification_status")
        people.append({
            "worker_id": r.get("referred_worker_id"),
            "name": name or "Not registered yet",
            "phone": r.get("referred_phone") or "—",
            "status": r.get("status"),
            "verification_status": verification_status,
            "verified": verification_status == "approved",
            "payout_amount_rs": r.get("payout_amount_rs", 0),
            "created_at": r.get("created_at"),
        })

    return {
        "referrer_name": referrer.get("full_name") or "Unknown",
        "referrer_phone": referrer.get("phone"),
        "referral_code": referrer.get("referral_code"),
        "people": people,
    }


@api_router.post("/admin/referrals/{referral_id}/mark-paid")
async def mark_referral_paid(referral_id: str, user: dict = Depends(require_roles(*ADMIN_ROLES))):
    ref = await db.referrals.find_one({"id": referral_id})
    if not ref:
        raise HTTPException(status_code=404, detail="Referral not found")
    if ref.get("status") == "paid":
        raise HTTPException(status_code=400, detail="This referral is already marked as paid")
    if ref.get("status") not in ("pending", "reward_triggered"):
        raise HTTPException(status_code=400, detail="This referral has no reward pending yet")
    referrer = await db.workers.find_one({"id": ref.get("referrer_worker_id")})
    if not referrer or not referrer.get("upi_id"):
        raise HTTPException(status_code=400, detail="Referrer has no PhonePe/Google Pay number on file yet")
    amount = ref.get("payout_amount_rs", 50)
    await db.referrals.update_one({"id": referral_id}, {"$set": {
        "status": "paid", "paid_by": user["id"], "paid_at": now_iso(),
        "payout_amount_rs": amount,
    }})
    await _notify_worker(referrer, "referral_reward",
        "Referral Reward Paid ₹" + str(amount), "रेफ़रल इनाम ₹" + str(amount) + " भेजा गया",
        "రెఫరల్ రివార్డ్ ₹" + str(amount) + " చెల్లించబడింది",
        f"₹{amount} has been sent to your PhonePe/Google Pay number for a successful referral.",
        f"एक सफल रेफ़रल के लिए ₹{amount} आपके PhonePe/Google Pay नंबर पर भेजे गए हैं।",
        f"విజయవంతమైన రెఫరల్ కోసం ₹{amount} మీ PhonePe/Google Pay నంబర్‌కు పంపబడ్డాయి.")
    return {"success": True, "amount_paid_rs": amount}


@api_router.post("/admin/referrals/bulk-mark-paid")
async def bulk_mark_referrals_paid(payload: BulkMarkPaidPayload, user: dict = Depends(require_roles(*ADMIN_ROLES))):
    if not payload.referral_ids:
        raise HTTPException(status_code=400, detail="No referral IDs provided")
    if len(payload.referral_ids) > 200:
        raise HTTPException(status_code=400, detail="Cannot bulk-pay more than 200 at once")
    succeeded = []
    skipped = []
    for ref_id in payload.referral_ids:
        ref = await db.referrals.find_one({"id": ref_id})
        if not ref:
            skipped.append({"id": ref_id, "reason": "not_found"}); continue
        if ref.get("status") == "paid":
            skipped.append({"id": ref_id, "reason": "already_paid"}); continue
        if ref.get("status") not in ("pending", "reward_triggered"):
            skipped.append({"id": ref_id, "reason": "not_eligible"}); continue
        referrer = await db.workers.find_one({"id": ref.get("referrer_worker_id")})
        if not referrer or not referrer.get("upi_id"):
            skipped.append({"id": ref_id, "reason": "no_payout_number"}); continue
        amount = payload.amount_per_referral_rs if payload.amount_per_referral_rs is not None \
                 else ref.get("payout_amount_rs", 50)
        await db.referrals.update_one({"id": ref_id}, {"$set": {
            "status": "paid", "paid_by": user["id"], "paid_at": now_iso(),
            "payout_amount_rs": amount,
        }})
        try:
            await _notify_worker(referrer, "referral_reward",
                "Referral Reward Paid ₹" + str(amount), "रेफ़रल इनाम ₹" + str(amount) + " भेजा गया",
                "రెఫరల్ రివార్డ్ ₹" + str(amount) + " చెల్లించబడింది",
                f"₹{amount} has been sent to your PhonePe/Google Pay number for a successful referral.",
                f"एक सफल रेफ़रल के लिए ₹{amount} आपके PhonePe/Google Pay नंबर पर भेजे गए हैं।",
                f"విజయవంతమైన రెఫరల్ కోసం ₹{amount} మీ PhonePe/Google Pay నంబర్‌కు పంపబడ్డాయి.")
        except Exception:
            pass
        succeeded.append({"id": ref_id, "amount_rs": amount})
    return {
        "success": True,
        "paid_count": len(succeeded),
        "skipped_count": len(skipped),
        "total_amount_rs": sum(s["amount_rs"] for s in succeeded),
        "succeeded": succeeded,
        "skipped": skipped,
    }


@api_router.get("/admin/referrals/{worker_id}/pending-summary")
async def referrer_pending_summary(worker_id: str, user: dict = Depends(require_roles(*ADMIN_ROLES))):
    refs = await db.referrals.find({
        "referrer_worker_id": worker_id,
        "status": {"$in": ["pending", "reward_triggered"]},
    }).to_list(1000)
    referrer = await db.workers.find_one({"id": worker_id})
    return {
        "worker_id": worker_id,
        "referrer_name": referrer.get("full_name") if referrer else "Unknown",
        "upi_id": referrer.get("upi_id") if referrer else None,
        "pending_count": len(refs),
        "total_pending_rs": sum(r.get("payout_amount_rs", 50) for r in refs),
        "pending_referral_ids": [r["id"] for r in refs],
    }


@api_router.get("/admin/referrals/list")
async def admin_referrals_list(category: str, user: dict = Depends(require_roles(*ADMIN_ROLES))):
    # Backs the clickable KPI cards on the Referral Dashboard — each card
    # opens this same endpoint filtered to its own category, so the number
    # on the card and the rows on the following page always match.
    status_filter = {
        "referred":   None,
        "registered": {"$in": ["pending", "reward_triggered", "paid"]},
        "logged_in":  "account_created",
        "paid":       "paid",
        "pending":    {"$in": ["pending", "reward_triggered"]},
    }
    if category not in status_filter:
        raise HTTPException(status_code=400, detail="Unknown category")

    query: dict = {}
    if status_filter[category] is not None:
        query["status"] = status_filter[category]

    refs = await db.referrals.find(query).sort("created_at", -1).to_list(10000)

    rows = []
    for r in refs:
        referrer = await db.workers.find_one({"id": r.get("referrer_worker_id")})
        name = "Not registered yet"
        if r.get("referred_worker_id"):
            w = await db.workers.find_one({"id": r["referred_worker_id"]})
            if w:
                name = w.get("full_name") or name
        rows.append({
            "referral_id": r["id"],
            "referrer_name": referrer.get("full_name") if referrer else "Unknown",
            "referrer_phone": referrer.get("phone") if referrer else "—",
            "referrer_worker_id": r.get("referrer_worker_id"),
            "referrer_has_payout_number": bool(referrer and referrer.get("upi_id")),
            "name": name,
            "phone": r.get("referred_phone") or "—",
            "worker_id": r.get("referred_worker_id"),
            "status": r.get("status"),
            "payout_amount_rs": r.get("payout_amount_rs", 0),
            "created_at": r.get("created_at"),
        })
    return {"category": category, "rows": rows}


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


@api_router.get("/admin/rejected-profiles")
async def list_rejected_profiles(user: dict = Depends(require_roles(*ADMIN_ROLES))):
    docs = await db.rejected_profiles.find().sort("rejected_at", -1).to_list(2000)
    hydrated = [await gridfs_images.hydrate_worker(image_bucket, clean(d)) for d in docs]
    return {"profiles": hydrated, "count": len(hydrated)}


@api_router.get("/admin/rejected-profiles/{profile_id}")
async def get_rejected_profile(profile_id: str, user: dict = Depends(require_roles(*ADMIN_ROLES))):
    doc = await db.rejected_profiles.find_one({"id": profile_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Rejected profile not found")
    return await gridfs_images.hydrate_worker(image_bucket, clean(doc))


@api_router.post("/admin/rejected-profiles/{profile_id}/restore")
async def restore_rejected_profile(profile_id: str, user: dict = Depends(require_roles(*ADMIN_ROLES))):
    doc = await db.rejected_profiles.find_one({"id": profile_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Rejected profile not found")

    restored = clean(dict(doc))
    restored.pop("_id", None)
    restored.pop("rejected_by", None)
    restored.pop("rejected_at", None)
    restored["rejection_reason"] = None
    restored["verification_status"] = "pending"
    restored["updated_at"] = now_iso()

    if await db.workers.find_one({"phone": restored.get("phone")}):
        raise HTTPException(status_code=409, detail="A worker with this phone number is already registered")
    if await db.workers.find_one({"id": restored["id"]}):
        restored["id"] = new_id()

    await db.workers.insert_one(restored)
    await db.rejected_profiles.delete_one({"id": profile_id})
    await _register_referral(restored)
    return {"success": True, "worker_id": restored["id"]}


def _build_registration_trend(workers: list, period: str) -> list:
    """Builds registration_trend buckets for the requested granularity.
    Every bucket carries date_from/date_to (inclusive, YYYY-MM-DD) so the
    frontend can drill into that exact range, plus a display-ready label.
    Day buckets also keep a `date` field for backward compatibility."""
    now = datetime.now(timezone.utc)
    trend = []

    if period == "week":
        today = now.date()
        this_monday = today - timedelta(days=today.weekday())
        for i in range(11, -1, -1):
            start = this_monday - timedelta(weeks=i)
            end = start + timedelta(days=6)
            start_s, end_s = start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d")
            c = sum(1 for w in workers if start_s <= (w.get("created_at") or "")[:10] <= end_s)
            trend.append({
                "label": f"{start.strftime('%b %d')}",
                "date_from": start_s, "date_to": end_s, "count": c,
            })
    elif period == "month":
        y, m = now.year, now.month
        for i in range(11, -1, -1):
            mm, yy = m - i, y
            while mm <= 0:
                mm += 12
                yy -= 1
            start = date(yy, mm, 1)
            next_month = date(yy + 1, 1, 1) if mm == 12 else date(yy, mm + 1, 1)
            end = next_month - timedelta(days=1)
            start_s, end_s = start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d")
            c = sum(1 for w in workers if start_s <= (w.get("created_at") or "")[:10] <= end_s)
            trend.append({
                "label": start.strftime("%b %Y"),
                "date_from": start_s, "date_to": end_s, "count": c,
            })
    else:  # day
        for i in range(13, -1, -1):
            d = (now - timedelta(days=i)).strftime("%Y-%m-%d")
            c = sum(1 for w in workers if (w.get("created_at") or "")[:10] == d)
            trend.append({
                "label": d[5:].replace("-", "/"),
                "date_from": d, "date_to": d, "date": d, "count": c,
            })
    return trend


@api_router.get("/admin/analytics")
async def admin_analytics(user: dict = Depends(require_roles(*ADMIN_ROLES)), period: str = "day"):
    if period not in ("day", "week", "month"):
        period = "day"
    await _refresh_availability_statuses()
    workers = await db.workers.find().to_list(10000)
    total = len(workers)
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
    skill_counts: dict = {}
    for w in workers:
        for s in (w.get("skills") or []):
            skill_counts[s] = skill_counts.get(s, 0) + 1
    skill_distribution = sorted(
        [{"skill": k, "count": v} for k, v in skill_counts.items()],
        key=lambda x: x["count"], reverse=True,
    )
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
    gender = {"male": 0, "female": 0, "other": 0}
    for w in workers:
        g = w.get("gender") or "other"
        gender[g] = gender.get(g, 0) + 1
    trend = _build_registration_trend(workers, period)
    rejected_profiles_count = await db.rejected_profiles.count_documents({})
    total_referrals = await db.referrals.count_documents({"status": {"$in": ["pending", "reward_triggered", "paid"]}})
    return {
        "kpis": {
            "total_workers": total,
            "verified_workers": verified,
            "pending_verification": pending,
            "rejected_workers": rejected,
            "available_workers": avail_now,
            "new_today": new_today,
            "new_this_week": new_week,
            "rejected_profiles": rejected_profiles_count,
            "total_referrals": total_referrals,
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
        "trend_period": period,
    }


def _apply_filters(search, skill, availability, verification, city, area, min_exp, max_exp, registered_date=None, date_from=None, date_to=None):
    query = {}
    and_clauses = []
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
    if min_exp is not None or max_exp is not None:
        lo = min_exp if min_exp is not None else 0
        rng = {"$gte": lo}
        if max_exp is not None:
            rng["$lte"] = max_exp
        if lo <= 0:
            # A worker with no years_experience field at all (profile not yet
            # fully filled in) is treated as 0 years by the analytics bucket
            # count — match that here too, or a $gte/$lte query silently
            # excludes them (Mongo range operators never match a missing
            # field), which is why the Experience Mix bar count and the
            # filtered table count used to disagree.
            and_clauses.append({
                "$or": [
                    {"years_experience": {"$exists": False}},
                    {"years_experience": None},
                    {"years_experience": rng},
                ]
            })
        else:
            and_clauses.append({"years_experience": rng})
    if registered_date:
        query["created_at"] = {"$regex": f"^{registered_date}"}
    elif date_from or date_to:
        rng2 = {}
        if date_from:
            rng2["$gte"] = date_from
        if date_to:
            rng2["$lte"] = date_to + "T23:59:59"
        query["created_at"] = rng2
    if and_clauses:
        query["$and"] = and_clauses
    return query


_AVAIL_IST = timezone(timedelta(hours=5, minutes=30))


async def _refresh_availability_statuses() -> int:
    """Flip any worker whose `available_from` date has arrived (today or
    earlier) from 'available_from' -> 'available_now'. Returns the number
    of workers updated. Cheap no-op query when nothing needs flipping."""
    today_str = datetime.now(_AVAIL_IST).strftime("%Y-%m-%d")
    result = await db.workers.update_many(
        {
            "availability_status": "available_from",
            "available_from": {"$ne": None, "$lte": today_str},
        },
        {"$set": {"availability_status": "available_now", "available_from": None}},
    )
    if result.modified_count:
        logger.info(
            "Availability auto-update: flipped %d worker(s) to available_now",
            result.modified_count,
        )
    return result.modified_count


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
    registered_date: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    page: int = 1,
    page_size: int = 100,
):
    if registered_date and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", registered_date):
        raise HTTPException(status_code=400, detail="registered_date must be YYYY-MM-DD")
    if date_from and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", date_from):
        raise HTTPException(status_code=400, detail="date_from must be YYYY-MM-DD")
    if date_to and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", date_to):
        raise HTTPException(status_code=400, detail="date_to must be YYYY-MM-DD")
    # Keep availability_status accurate the moment an admin looks at it,
    # rather than waiting for the 30-min background loop.
    await _refresh_availability_statuses()
    query = _apply_filters(search, skill, availability, verification, city, area, min_exp, max_exp, registered_date, date_from, date_to)
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
    await _refresh_availability_statuses()
    worker = await db.workers.find_one({"id": worker_id})
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")
    result = clean(worker)
    for field in ["portfolio_images", "aadhar_images", "employment_proof_images"]:
        if result.get(field):
            result[field] = await gridfs_images.hydrate_images(
                image_bucket, result[field][:3]
            )
    if result.get("history"):
        hydrated_history = []
        for snap in result["history"]:
            snap = dict(snap)
            for field in ["portfolio_images", "aadhar_images", "employment_proof_images"]:
                if snap.get(field):
                    snap[field] = await gridfs_images.hydrate_images(image_bucket, snap[field])
            hydrated_history.append(snap)
        result["history"] = hydrated_history
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
    worker = await db.workers.find_one({"id": worker_id})
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")

    archived = clean(dict(worker))
    archived.pop("_id", None)
    archived["rejection_reason"] = archived.get("rejection_reason") or "Deleted by admin"
    archived["rejected_by"] = user.get("phone") or user.get("id")
    archived["rejected_at"] = now_iso()
    await db.rejected_profiles.insert_one(archived)

    await db.workers.delete_one({"id": worker_id})
    await db.referrals.delete_many({"$or": [
        {"referred_worker_id": worker_id}, {"referrer_worker_id": worker_id},
    ]})
    await db.notifications.delete_many({"recipient_worker_id": worker_id})
    return {"success": True, "deleted": True, "archived": True}


@api_router.post("/admin/maintenance/cleanup-orphaned-images")
async def cleanup_orphaned_images(
    user: dict = Depends(require_roles("admin")),
    dry_run: bool = True,
):
    in_use = set()
    async for w in db.workers.find({}, {f: 1 for f in gridfs_images.IMAGE_FIELDS}):
        for field in gridfs_images.IMAGE_FIELDS:
            for entry in w.get(field) or []:
                if isinstance(entry, str) and entry.startswith(gridfs_images.GRIDFS_PREFIX):
                    in_use.add(entry)

    total_files = 0
    total_bytes = 0
    orphans = []
    async for f in db["worker_images.files"].find({}, {"_id": 1, "length": 1}):
        total_files += 1
        total_bytes += f.get("length", 0)
        ref = f"{gridfs_images.GRIDFS_PREFIX}{f['_id']}"
        if ref not in in_use:
            orphans.append(f)

    orphan_bytes = sum(f.get("length", 0) for f in orphans)

    if dry_run:
        return {
            "dry_run": True,
            "total_files": total_files,
            "total_mb": round(total_bytes / 1_000_000, 2),
            "orphaned_files": len(orphans),
            "orphaned_mb": round(orphan_bytes / 1_000_000, 2),
        }

    deleted = 0
    for f in orphans:
        try:
            await image_bucket.delete(f["_id"])
            deleted += 1
        except Exception as exc:
            logger.warning("Could not delete orphaned file %s: %s", f["_id"], exc)

    return {"dry_run": False, "deleted": deleted, "attempted": len(orphans),
            "freed_mb": round(orphan_bytes / 1_000_000, 2)}


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
    ref = await db.referrals.find_one({"referred_worker_id": worker_id, "status": "pending"})
    if ref:
        referrer = await db.workers.find_one({"id": ref["referrer_worker_id"]})
        if referrer:
            # IMPORTANT: there is no real payment-gateway integration in this
            # app (no live Razorpay/UPI payout call anywhere). Approving a
            # worker only means the referral REWARD HAS BEEN EARNED — it must
            # never be auto-marked "paid" here, because that previously told
            # referrers (and the admin dashboard) that ₹50 had already been
            # sent when nothing had actually happened. Status is now always
            # set to "reward_triggered" (earned, awaiting payout); the ONLY
            # place status becomes "paid" is POST
            # /admin/referrals/{id}/mark-paid, which an admin calls after
            # they have actually sent the money themselves.
            await db.referrals.update_one({"id": ref["id"]}, {"$set": {"status": "reward_triggered"}})
            if referrer.get("upi_id"):
                await _notify_worker(referrer, "referral_reward",
                    "You earned ₹50 — reward on its way", "आपने ₹50 कमाए — इनाम जल्द भेजा जाएगा", "మీరు ₹50 సంపాదించారు — రివార్డ్ త్వరలో పంపబడుతుంది",
                    "You earned ₹50 for a successful referral! It will be sent to your PhonePe/Google Pay number shortly.",
                    "एक सफल रेफ़रल के लिए आपने ₹50 कमाए! यह जल्द ही आपके PhonePe/Google Pay नंबर पर भेजा जाएगा।",
                    "విజయవంతమైన రెఫరల్ కోసం మీరు ₹50 సంపాదించారు! ఇది త్వరలో మీ PhonePe/Google Pay నంబర్‌కు పంపబడుతుంది.")
            else:
                await _notify_worker(referrer, "referral_reward",
                    "Add PhonePe/Google Pay to claim ₹50", "₹50 पाने के लिए PhonePe/Google Pay जोड़ें", "₹50 పొందడానికి PhonePe/Google Pay జోడించండి",
                    "You earned ₹50! Add your PhonePe/Google Pay number to claim the reward.",
                    "आपने ₹50 कमाए! इनाम पाने के लिए अपना PhonePe/Google Pay नंबर जोड़ें।",
                    "మీరు ₹50 సంపాదించారు! రివార్డ్ పొందడానికి మీ PhonePe/Google Pay నంబర్‌ను జోడించండి.")
    updated = await db.workers.find_one({"id": worker_id})
    updated_hydrated = await gridfs_images.hydrate_worker(image_bucket, clean(updated))
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
    worker = await db.workers.find_one({"id": worker_id})
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")

    archived = clean(dict(worker))
    archived.pop("_id", None)
    archived["rejection_reason"] = payload.reason
    archived["rejected_by"] = user.get("phone") or user.get("id")
    archived["rejected_at"] = now_iso()
    await db.rejected_profiles.insert_one(archived)

    # Note: images are intentionally kept in storage (not deleted) so the
    # archived record above remains fully viewable for future reference.
    await db.workers.delete_one({"id": worker_id})
    await db.referrals.delete_many({"$or": [
        {"referred_worker_id": worker_id}, {"referrer_worker_id": worker_id},
    ]})
    await db.notifications.delete_many({"recipient_worker_id": worker_id})
    return {"success": True, "deleted": True, "archived": True}


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


# ── PDF Export with embedded images ─────────────────────────────────────────
# Generates a professional PDF report with worker info + embedded photos.
# Images are fetched from GridFS one worker at a time (max 3 per field)
# to avoid memory crashes on the 512MB Render free tier.
@api_router.get("/admin/export/full")
async def export_workers_pdf(
    user: dict = Depends(require_roles(*ADMIN_ROLES)),
    search: Optional[str] = None,
    skill: Optional[str] = None,
    availability: Optional[str] = None,
    verification: Optional[str] = None,
    city: Optional[str] = None,
    area: Optional[str] = None,
    min_exp: Optional[int] = None,
    max_exp: Optional[int] = None,
    limit: Optional[int] = None,
):
    query = _apply_filters(search, skill, availability, verification, city, area, min_exp, max_exp)
    fetch_cap = min(limit, 5000) if limit else 5000
    workers = await db.workers.find(query).sort("created_at", -1).to_list(fetch_cap)
    async def _hydrate_one(w):
        try:
            wc = clean(w)
            for field in ["portfolio_images", "aadhar_images", "employment_proof_images"]:
                if wc.get(field):
                    wc[field] = await gridfs_images.hydrate_images(
                        image_bucket, wc[field][:1]
                    )
            code = wc.get("referred_by_code")
            if code:
                referrer = await db.workers.find_one({"referral_code": code})
                if referrer:
                    wc["referred_by"] = {
                        "name": referrer.get("full_name"),
                        "phone": referrer.get("phone"),
                    }
            return wc
        except Exception as e:
            logger.warning("Skipping images for worker %s: %s", w.get("id"), e)
            return clean(w)

    # Hydrate all workers' images concurrently instead of one at a time,
    # so the request doesn't exceed Render's timeout on larger lists.
    hydrated = await asyncio.gather(*[_hydrate_one(w) for w in workers])

    try:
        pdf_bytes = export_service.build_workers_pdf(hydrated)
    except Exception as e:
        logger.exception("PDF build failed")
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {e}")

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=karigar_worker_report.pdf"},
    )


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
    await db["worker_images.files"].create_index("metadata.phone")


@app.on_event("startup")
async def seed_data():
    try:
        if await db.skills.count_documents({}) == 0:
            for name in DEFAULT_SKILLS:
                await db.skills.insert_one({"id": new_id(), "name": name, "created_at": now_iso()})
            logger.info("Seeded skills")

        if not await db.meta.find_one({"key": "pwd_auth_migration_v1"}):
            await db.users.delete_many({})
            await db.workers.delete_many({})
            await db.otp_requests.delete_many({})
            await db.referrals.delete_many({})
            await db.notifications.delete_many({})
            await db.meta.insert_one({"key": "pwd_auth_migration_v1", "done_at": now_iso()})
            logger.info("Auth pivot: wiped legacy users/workers/demo data")

        await _ensure_indexes()

        # ── Flip any workers whose available_from date has already passed ──
        await _refresh_availability_statuses()

        # ── Start daily summary scheduler ────────────────────────────────────
        asyncio.create_task(_daily_summary_loop())
        logger.info("Daily summary scheduler started.")

    except Exception as exc:
        logger.error("Startup seeding/index step failed, but app will still start: %s", exc)


# ── Daily summary scheduler ──────────────────────────────────────────────────
# Checks every 30 minutes whether it's past 5:30 PM IST and summary not yet
# sent today. Render's free tier can sleep the app, so we never rely on a
# simple "sleep 24 hours" approach — checking every 30 min means it catches up
# the moment the server wakes up.

_IST = timezone(timedelta(hours=5, minutes=30))
_last_summary_date: str = ""          # "YYYY-MM-DD" of last successful send


async def _daily_summary_loop():
    global _last_summary_date
    while True:
        try:
            await asyncio.sleep(30 * 60)          # check every 30 minutes
            now_ist  = datetime.now(_IST)
            today_str = now_ist.strftime("%Y-%m-%d")

            # Keep availability_status live even when no admin is browsing
            await _refresh_availability_statuses()

            # Send only once per day, at or after 17:30 IST
            if (
                now_ist.hour > 17
                or (now_ist.hour == 17 and now_ist.minute >= 30)
            ) and _last_summary_date != today_str:
                logger.info("Daily summary: triggering scheduled send for %s", today_str)
                success = await daily_summary_service.send_daily_summary(db)
                if success:
                    _last_summary_date = today_str
                    logger.info("Daily summary: sent successfully for %s", today_str)
                else:
                    logger.warning("Daily summary: send failed for %s — will retry next cycle", today_str)

        except asyncio.CancelledError:
            break
        except Exception as exc:
            logger.error("Daily summary scheduler error: %s", exc, exc_info=True)


# ── Admin endpoints: manual trigger + status ─────────────────────────────────

@api_router.post("/admin/daily-summary/run")
async def run_daily_summary_now(current_user=Depends(get_current_user)):
    """Trigger the daily summary email immediately (for testing or manual send)."""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    success = await daily_summary_service.send_daily_summary(db)
    return {
        "success": success,
        "message": "Summary email sent." if success else "Failed to send — check server logs.",
    }


@api_router.get("/admin/daily-summary/status")
async def daily_summary_status(current_user=Depends(get_current_user)):
    """Check when the last daily summary was sent."""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return {
        "last_sent_date": _last_summary_date or "Never",
        "next_scheduled":  "Today at 17:30 IST" if not _last_summary_date else "Tomorrow at 17:30 IST",
    }


@api_router.get("/")
async def root():
    return {"message": "Karigar API"}

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
