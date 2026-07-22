"""
Run this ONCE to give EMP_IDs to profiles that were already rejected/deleted
(archived in the `rejected_profiles` collection) BEFORE the main backfill ran.
Continues the same counter used for the `workers` collection, so IDs never clash.

Usage:
    python backfill_rejected_ids.py
"""
import asyncio
import os
from pathlib import Path
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')


async def main():
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db = client[os.environ['DB_NAME']]

    profiles = await db.rejected_profiles.find(
        {"worker_id": {"$exists": False}}
    ).sort("created_at", 1).to_list(length=None)

    counter = await db.counters.find_one({"_id": "worker_id"})
    seq = counter["seq"] if counter else 0

    for p in profiles:
        seq += 1
        await db.rejected_profiles.update_one(
            {"_id": p["_id"]},
            {"$set": {"worker_id": str(seq).zfill(5)}},
        )

    await db.counters.update_one(
        {"_id": "worker_id"}, {"$set": {"seq": seq}}, upsert=True
    )
    print(f"Assigned IDs to {len(profiles)} rejected/deleted profiles. Counter now at {seq}.")


if __name__ == "__main__":
    asyncio.run(main())
