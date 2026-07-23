#!/usr/bin/env python3
"""One-time script: shrinks all existing worker photos already in storage."""

import asyncio
import base64
import io
import os
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorGridFSBucket
from bson import ObjectId
from PIL import Image

import gridfs_images

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

TARGET_SIZES = {
    "portfolio_images": 60,
    "aadhar_images": 100,
    "employment_proof_images": 100,
}


def shrink_bytes(raw: bytes, target_kb: int) -> bytes:
    img = Image.open(io.BytesIO(raw)).convert("RGB")
    width = 900
    quality = 50
    for _ in range(4):
        w_percent = width / float(img.size[0])
        h_size = int(img.size[1] * w_percent)
        resized = img.resize((width, h_size))
        buf = io.BytesIO()
        resized.save(buf, format="JPEG", quality=quality)
        data = buf.getvalue()
        if len(data) / 1024 <= target_kb:
            return data
        width = int(width * 0.7)
        quality = max(30, quality - 10)
    return data


async def main():
    mongo_url = os.environ["MONGO_URL"]
    db_name = os.environ["DB_NAME"]
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    bucket = AsyncIOMotorGridFSBucket(db, bucket_name="worker_images")

    workers = await db.workers.find({}).to_list(None)
    print(f"Found {len(workers)} worker(s).")

    total_freed_kb = 0
    for worker in workers:
        changed = False
        for field, target_kb in TARGET_SIZES.items():
            entries = worker.get(field) or []
            new_entries = []
            for entry in entries:
                if entry.startswith("gridfs:"):
                    try:
                        file_id = ObjectId(entry[len("gridfs:"):])
                        stream = await bucket.open_download_stream(file_id)
                        raw = await stream.read()
                        # Skip images already small enough — avoids pointless
                        # re-compression (and quality loss) on photos that
                        # were already uploaded small.
                        if len(raw) / 1024 <= target_kb:
                            new_entries.append(entry)
                            continue
                        small = shrink_bytes(raw, target_kb)
                        new_id = await bucket.upload_from_stream("worker_image", small)
                        await bucket.delete(file_id)
                        new_entries.append(f"gridfs:{new_id}")
                        total_freed_kb += (len(raw) - len(small)) / 1024
                        changed = True
                    except Exception as exc:
                        print(f"  (skipped, error) {entry}: {exc}")
                        new_entries.append(entry)
                else:
                    new_entries.append(entry)
            worker[field] = new_entries

        if changed:
            await db.workers.update_one({"id": worker["id"]}, {"$set": {
                "portfolio_images": worker["portfolio_images"],
                "aadhar_images": worker["aadhar_images"],
                "employment_proof_images": worker["employment_proof_images"],
            }})
            print(f"Shrunk photos for {worker.get('full_name', worker['id'])}")

    client.close()
    print(f"Done. Freed approximately {total_freed_kb / 1024:.1f} MB.")


if __name__ == "__main__":
    asyncio.run(main())
