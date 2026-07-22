"""
Run this ONCE, BEFORE deploying the new server.py, to give every
existing worker a 5-digit worker_id, oldest registration = 00001.

Usage:
    python backfill_worker_ids.py
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

    workers = await db.workers.find(
        {"worker_id": {"$exists": False}}
    ).sort("created_at", 1).to_list(length=None)

    seq = 0
    counter = await db.counters.find_one({"_id": "worker_id"})
    if counter:
        seq = counter["seq"]

    for w in workers:
        seq += 1
        await db.workers.update_one(
            {"_id": w["_id"]},
            {"$set": {"worker_id": str(seq).zfill(5)}},
        )

    await db.counters.update_one(
        {"_id": "worker_id"}, {"$set": {"seq": seq}}, upsert=True
    )
    print(f"Assigned IDs to {len(workers)} workers. Counter now at {seq}.")


if __name__ == "__main__":
    asyncio.run(main())
