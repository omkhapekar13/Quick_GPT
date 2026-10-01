import sys
import logging
from pathlib import Path
from datetime import datetime, timezone
from pymongo import MongoClient

# Ensure UTF-8 output on Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# Add project root to sys.path
root_dir = Path(__file__).resolve().parent.parent.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from rag_service.configs.settings import (
    MONGODB_URI,
    PINECONE_INDEX_NAME,
)
from rag_service.configs.vector_db import (
    get_vector_index,
    get_room_namespace,
    get_user_namespace,
    is_vector_db_configured,
)
from rag_service.services.embedding_service import generate_batch_embeddings

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("backfill")


def get_db():
    if not MONGODB_URI:
        logger.error("MONGODB_URI is not set in environment or server/.env")
        return None
    try:
        client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
        # Check if database specified in URI or use 'mygpt'
        db = client["mygpt"]
        return db
    except Exception as err:
        logger.error(f"Failed to connect to MongoDB: {err}")
        return None


def backfill_room_messages(db, index):
    print("\n--- 1. Backfilling Room Messages ---")
    collection = db["roommessages"]
    base_query = {
        "isVectorIndexed": {"$ne": True},
        "isImage": {"$ne": True},
        "content": {"$exists": True, "$ne": ""},
    }

    try:
        total_count = collection.count_documents(base_query)
    except Exception as err:
        logger.error(f"Error querying roommessages: {err}")
        return

    print(f"Found {total_count} un-indexed room messages.")
    if total_count == 0:
        print("✨ All room messages are already indexed!\n")
        return

    BATCH_SIZE = 20
    processed = 0
    successful = 0
    last_id = None

    while True:
        page_query = dict(base_query)
        if last_id:
            page_query["_id"] = {"$gt": last_id}

        messages = list(collection.find(page_query).sort("_id", 1).limit(BATCH_SIZE))
        if not messages:
            break

        last_id = messages[-1]["_id"]
        texts_to_embed = [
            f"[{m.get('senderName', 'User')}]: {m.get('content', '')}"
            for m in messages
        ]

        embeddings = generate_batch_embeddings(texts_to_embed, batch_size=BATCH_SIZE)
        room_batches = {}
        successful_ids = []

        for i, msg in enumerate(messages):
            vector = embeddings[i] if i < len(embeddings) else None
            room_id = msg.get("roomId")
            if vector and isinstance(vector, list) and room_id:
                room_str = str(room_id)
                if room_str not in room_batches:
                    room_batches[room_str] = []

                created_at = msg.get("createdAt")
                if isinstance(created_at, datetime):
                    timestamp_str = created_at.isoformat()
                elif created_at:
                    timestamp_str = str(created_at)
                else:
                    timestamp_str = datetime.now(timezone.utc).isoformat()

                room_batches[room_str].append({
                    "id": str(msg["_id"]),
                    "values": vector,
                    "metadata": {
                        "messageId": str(msg["_id"]),
                        "roomId": room_str,
                        "senderName": msg.get("senderName", "User"),
                        "senderType": msg.get("senderType", "user"),
                        "content": (msg.get("content") or "")[:1500],
                        "timestamp": timestamp_str,
                    },
                })
                successful_ids.append(msg["_id"])

        for room_str, records in room_batches.items():
            try:
                namespace = get_room_namespace(room_str)
                index.upsert(vectors=records, namespace=namespace)
            except Exception as upsert_err:
                logger.error(f"Pinecone upsert failed for room {room_str}: {upsert_err}")

        if successful_ids:
            collection.update_many(
                {"_id": {"$in": successful_ids}},
                {"$set": {"isVectorIndexed": True}},
            )
            successful += len(successful_ids)

        processed += len(messages)
        print(f"   Indexed {processed}/{total_count} room messages ({successful} successful)...")

    print(f"✅ Completed room backfill! Processed: {processed}, Indexed: {successful}\n")


def backfill_user_chats(db, index):
    print("--- 2. Backfilling 1-on-1 User Chat Messages ---")
    collection = db["chats"]

    try:
        chats = list(collection.find({"messages": {"$exists": True, "$not": {"$size": 0}}}))
    except Exception as err:
        logger.error(f"Error querying chats: {err}")
        return

    total_messages_indexed = 0

    for chat in chats:
        user_id = chat.get("userId")
        chat_id = chat.get("_id")
        chat_name = chat.get("name", "Chat")
        messages = chat.get("messages", [])

        if not user_id or not messages:
            continue

        unindexed = [
            (idx, m) for idx, m in enumerate(messages)
            if not m.get("isVectorIndexed") and not m.get("isImage") and m.get("content")
        ]

        if not unindexed:
            continue

        texts = [
            f"[{'Assistant' if m.get('role') == 'assistant' else 'User'}]: {m.get('content', '').strip()}"
            for _, m in unindexed
        ]

        embeddings = generate_batch_embeddings(texts, batch_size=20)
        records = []
        indexed_indices = []

        for j, (orig_idx, m) in enumerate(unindexed):
            vector = embeddings[j] if j < len(embeddings) else None
            if vector and isinstance(vector, list):
                record_id = f"user_{user_id}_chat_{chat_id}_{orig_idx}_{int(datetime.now().timestamp())}"
                ts = m.get("timestamp") or datetime.now(timezone.utc).isoformat()
                records.append({
                    "id": record_id,
                    "values": vector,
                    "metadata": {
                        "userId": str(user_id),
                        "chatId": str(chat_id),
                        "chatName": chat_name,
                        "role": m.get("role", "user"),
                        "content": (m.get("content") or "")[:1500],
                        "timestamp": str(ts),
                    },
                })
                indexed_indices.append(orig_idx)

        if records:
            try:
                namespace = get_user_namespace(user_id)
                index.upsert(vectors=records, namespace=namespace)

                # Update MongoDB isVectorIndexed on subdocuments
                for idx in indexed_indices:
                    collection.update_one(
                        {"_id": chat_id},
                        {"$set": {f"messages.{idx}.isVectorIndexed": True}},
                    )
                total_messages_indexed += len(records)
            except Exception as err:
                logger.error(f"Failed to upsert user chat messages for chat {chat_id}: {err}")

    print(f"✅ Completed user chats backfill! Indexed {total_messages_indexed} messages.\n")


def run_backfill():
    print("===================================================")
    print("      MyGPT - Python Vector DB Historical Backfill  ")
    print("===================================================\n")

    if not is_vector_db_configured():
        print("❌ PINECONE_API_KEY is not configured.")
        return

    index = get_vector_index()
    if not index:
        print("❌ Could not connect to Pinecone index.")
        return

    db = get_db()
    if db is None:
        print("❌ Could not connect to MongoDB.")
        return

    print("Connected to MongoDB and Pinecone successfully.")
    backfill_room_messages(db, index)
    backfill_user_chats(db, index)

    print("===================================================")
    print("Backfill completed successfully.")
    print("===================================================\n")


if __name__ == "__main__":
    run_backfill()
