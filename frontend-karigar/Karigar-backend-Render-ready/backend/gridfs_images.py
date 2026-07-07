"""gridfs_images.py
Centralised GridFS helpers for worker image fields.

Design contract
---------------
* New images written after this migration are stored in GridFS and the worker
  document holds a small string reference: ``"gridfs:<ObjectId>"``.
* Legacy entries (raw base64 / data-URLs written before the migration) are
  left untouched in the document; they pass through hydration unchanged.
* The marker prefix ``GRIDFS_PREFIX`` is the single convention that
  distinguishes the two kinds of entry everywhere in the codebase.
* email_service.py and export_service.py receive a **hydrated** worker dict
  (all ``gridfs:`` refs replaced with base64 data-URLs) so they require
  zero changes to their internal logic.

Public API
----------
  upload_image(bucket, data_url, metadata)  -> "gridfs:<id>" reference string
  hydrate_images(bucket, image_list)        -> list with refs replaced by b64
  hydrate_worker(bucket, worker_dict)       -> worker dict with all 3 fields hydrated
  store_images(bucket, image_list)          -> list of "gridfs:<id>" strings
                                             (uploads only new non-ref entries)
"""

import base64
import logging
from typing import List, Optional

from motor.motor_asyncio import AsyncIOMotorGridFSBucket
from bson import ObjectId

logger = logging.getLogger(__name__)

GRIDFS_PREFIX = "gridfs:"
# Image fields stored on every worker document.
IMAGE_FIELDS = ("portfolio_images", "aadhar_images", "employment_proof_images")


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _is_ref(value: str) -> bool:
    """Return True if this string is a GridFS reference, not raw base64."""
    return isinstance(value, str) and value.startswith(GRIDFS_PREFIX)


def _ref_to_id(ref: str) -> ObjectId:
    return ObjectId(ref[len(GRIDFS_PREFIX):])


def _to_ref(file_id: ObjectId) -> str:
    return f"{GRIDFS_PREFIX}{file_id}"


def _extract_b64(data_url: str) -> Optional[bytes]:
    """Decode a data-URL or raw base64 string to bytes."""
    if not data_url:
        return None
    try:
        b64 = data_url.split(",", 1)[1] if "," in data_url else data_url
        return base64.b64decode(b64)
    except Exception as exc:
        logger.warning("Could not decode base64 image: %s", exc)
        return None


def _to_data_url(raw_bytes: bytes, content_type: str = "image/jpeg") -> str:
    return f"data:{content_type};base64,{base64.b64encode(raw_bytes).decode()}"


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def upload_image(
    bucket: AsyncIOMotorGridFSBucket,
    data_url: str,
    metadata: Optional[dict] = None,
) -> Optional[str]:
    """Upload a single base64 data-URL to GridFS.

    Returns a ``"gridfs:<id>"`` reference string, or ``None`` on failure.
    If *data_url* is already a ``gridfs:`` reference it is returned as-is.
    """
    if _is_ref(data_url):
        return data_url  # already stored, nothing to do
    raw = _extract_b64(data_url)
    if not raw:
        return None
    try:
        file_id = await bucket.upload_from_stream(
            "worker_image",
            raw,
            metadata=metadata or {},
        )
        return _to_ref(file_id)
    except Exception as exc:
        logger.error("GridFS upload failed: %s", exc)
        return None


async def store_images(
    bucket: AsyncIOMotorGridFSBucket,
    images: List[str],
    metadata: Optional[dict] = None,
) -> List[str]:
    """Upload every entry in *images* that is not already a ``gridfs:`` ref.

    Entries that fail to upload are dropped with a warning (rather than
    crashing the entire profile save).  Returns the list of references.
    """
    results: List[str] = []
    for entry in images or []:
        if _is_ref(entry):
            results.append(entry)
            continue
        ref = await upload_image(bucket, entry, metadata=metadata)
        if ref:
            results.append(ref)
        else:
            logger.warning("Dropping unuploadable image entry (first 80 chars): %.80s", entry)
    return results


async def hydrate_images(
    bucket: AsyncIOMotorGridFSBucket,
    images: List[str],
) -> List[str]:
    """Replace every ``gridfs:<id>`` reference in *images* with a base64
    data-URL.  Raw base64 / legacy entries pass through unchanged.
    """
    out: List[str] = []
    for entry in images or []:
        if not _is_ref(entry):
            out.append(entry)  # legacy raw base64 — pass through
            continue
        try:
            stream = await bucket.open_download_stream(_ref_to_id(entry))
            raw = await stream.read()
            # GridFS doesn't store MIME type by default; JPEG is a safe
            # fallback since all client uploads are photos.
            content_type = stream.metadata.get("content_type", "image/jpeg") if stream.metadata else "image/jpeg"
            out.append(_to_data_url(raw, content_type))
        except Exception as exc:
            logger.error("GridFS download failed for ref %s: %s", entry, exc)
            # Return an empty string so the caller still gets a slot — the
            # PDF/XLSX renderer will skip falsy entries gracefully.
            out.append("")
    return out


async def hydrate_worker(
    bucket: AsyncIOMotorGridFSBucket,
    worker: dict,
) -> dict:
    """Return a *copy* of *worker* with all three image fields hydrated.

    The original dict is not mutated.  Any field that is absent or empty
    is left as-is.
    """
    w = dict(worker)
    for field in IMAGE_FIELDS:
        if w.get(field):
            w[field] = await hydrate_images(bucket, w[field])
    return w


async def delete_worker_images(
    bucket: AsyncIOMotorGridFSBucket,
    worker: dict,
) -> None:
    """Delete all GridFS files referenced in a worker document.

    Called when a worker profile is permanently deleted so orphaned files
    don't accumulate in GridFS.  Non-ref (legacy) entries are ignored.
    """
    for field in IMAGE_FIELDS:
        for entry in worker.get(field) or []:
            if _is_ref(entry):
                try:
                    await bucket.delete(_ref_to_id(entry))
                except Exception as exc:
                    logger.warning("Could not delete GridFS file %s: %s", entry, exc)
