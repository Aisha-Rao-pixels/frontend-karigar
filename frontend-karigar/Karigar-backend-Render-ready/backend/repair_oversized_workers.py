#!/usr/bin/env python3
"""repair_oversized_workers.py
One-off repair for worker documents that already exceed (or are close to)
MongoDB's 16 MB BSON hard limit due to image data stored inside history
snapshots.

What it does
------------
1. Finds all worker documents with BSON size > 8 MB (configurable).
2. For each such document, strips every image field from every history
   snapshot entry.  The current top-level image arrays are NOT touched
   (they belong to the live profile).
3. Writes the cleaned history back with a single $set — it does NOT push
   any new snapshot, so it won't bloat the document further.
4. Reports before/after sizes.

This is a surgical fix for the stuck documents.  It does not migrate images
to GridFS retroactively — that happens naturally the next time a worker edits
their profile through the updated server.py.

Usage
-----
  pip install motor pymongo python-dotenv --break-system-packages
  python repair_oversized_workers.py [--dry-run] [--threshold-mb 8]

Environment
-----------
  Reads MONGO_URL and DB_NAME from .env (same as server.py).
"""

import argparse
import asyncio
import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# Image field names that must never appear in a history snapshot.
IMAGE_FIELDS_IN_SNAPSHOT = {
    "portfolio_images",
    "aadhar_images",
    "employment_proof_images",
}


def _strip_images_from_snapshot(snap: dict) -> dict:
    """Return a copy of *snap* with all image fields removed."""
    return {k: v for k, v in snap.items() if k not in IMAGE_FIELDS_IN_SNAPSHOT}


def _estimate_size(obj) -> int:
    """Very rough BSON-size estimate via JSON serialisation length.
    Good enough to decide whether a document needs attention."""
    import json
    try:
        return len(json.dumps(obj, default=str).encode())
    except Exception:
        return 0


async def repair(dry_run: bool, threshold_bytes: int):
    mongo_url = os.environ["MONGO_URL"]
    db_name = os.environ["DB_NAME"]
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    logger.info("Connected to MongoDB. DB=%s  threshold=%d MB  dry_run=%s",
                db_name, threshold_bytes // 1_000_000, dry_run)

    # Use the Atlas $bsonSize aggregation to find candidates efficiently.
    pipeline = [
        {"$project": {"id": 1, "full_name": 1, "phone": 1, "history": 1,
                      "size": {"$bsonSize": "$$ROOT"}}},
        {"$match": {"size": {"$gt": threshold_bytes}}},
        {"$sort": {"size": -1}},
    ]
    candidates = await db.workers.aggregate(pipeline).to_list(None)

    if not candidates:
        logger.info("No documents found above threshold. Nothing to do.")
        client.close()
        return

    logger.info("Found %d candidate document(s) above threshold.", len(candidates))

    for doc in candidates:
        worker_id = doc.get("id") or str(doc["_id"])
        full_name = doc.get("full_name", "unknown")
        before_size = doc.get("size", 0)
        history = doc.get("history") or []

        cleaned_history = [_strip_images_from_snapshot(snap) for snap in history]
        after_size_estimate = before_size - sum(
            _estimate_size(snap) - _estimate_size(c)
            for snap, c in zip(history, cleaned_history)
        )

        snaps_with_images = sum(
            1 for snap in history
            if any(snap.get(f) for f in IMAGE_FIELDS_IN_SNAPSHOT)
        )

        logger.info(
            "Worker %-36s  %-20s  before=%7.2f MB  history_entries=%d  "
            "entries_with_images=%d  estimated_after=%.2f MB",
            worker_id, full_name,
            before_size / 1_000_000, len(history),
            snaps_with_images, after_size_estimate / 1_000_000,
        )

        if snaps_with_images == 0:
            logger.info("  → No image data found in history snapshots for this document. Skipping.")
            continue

        if dry_run:
            logger.info("  → DRY RUN: would strip images from %d snapshot(s).", snaps_with_images)
            continue

        result = await db.workers.update_one(
            {"id": worker_id},
            {"$set": {"history": cleaned_history}},
        )
        logger.info("  → Repaired. matched=%d  modified=%d",
                    result.matched_count, result.modified_count)

        # Verify new size
        verify = await db.workers.aggregate([
            {"$match": {"id": worker_id}},
            {"$project": {"size": {"$bsonSize": "$$ROOT"}}},
        ]).to_list(1)
        if verify:
            new_size = verify[0].get("size", 0)
            logger.info("  → New BSON size: %.2f MB (was %.2f MB).",
                        new_size / 1_000_000, before_size / 1_000_000)
            if new_size > 16_000_000:
                logger.warning(
                    "  ⚠ Document is STILL over 16 MB after repair! "
                    "The top-level image arrays themselves may be too large. "
                    "Consider removing some images from the live profile via "
                    "the admin edit UI, then re-running this script."
                )

    client.close()
    logger.info("Done.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Repair oversized worker documents")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print what would be done without making any changes")
    parser.add_argument("--threshold-mb", type=float, default=8.0,
                        help="Only inspect documents larger than this many MB (default: 8)")
    args = parser.parse_args()
    asyncio.run(repair(
        dry_run=args.dry_run,
        threshold_bytes=int(args.threshold_mb * 1_000_000),
    ))
