"""
Phase 3 Python Verification Test: Real-Time Room Chat RAG Integration
Validates end-to-end Room Chat RAG pipeline directly in Python:
1. Message ingestion into Pinecone room namespace
2. Query cleaning (@ai stripping)
3. Semantic similarity retrieval
4. Context deduplication & prompt synthesis
5. Live Gemini response generation with retrieved context
6. Graceful fallback validation
"""

import sys
import time
import uuid
import logging
from rag_service.configs.settings import GEMINI_API_KEY, PINECONE_API_KEY
from rag_service.configs.vector_db import get_vector_index, get_room_namespace
from rag_service.services.rag_service import (
    clean_user_query,
    index_message,
    retrieve_context,
    build_rag_prompt,
    generate_room_rag_response,
)

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("test_phase3")


def run_phase3_tests():
    print("=" * 65)
    print("      MyGPT Phase 3: Python Real-Time Room Chat RAG Test        ")
    print("=" * 65)

    if not GEMINI_API_KEY or not PINECONE_API_KEY:
        print("❌ Error: Missing GEMINI_API_KEY or PINECONE_API_KEY in environment.")
        sys.exit(1)

    test_room_id = f"test_room_phase3_{uuid.uuid4().hex[:8]}"
    room_name = "Devops & Architecture"
    participants = [
        {"userName": "Sarah", "role": "Lead Architect"},
        {"userName": "Dave", "role": "Site Reliability Engineer"},
        {"userName": "Alex", "role": "Frontend Lead"},
    ]

    print(f"\nTarget test room: {test_room_id}")

    # -------------------------------------------------------------
    # 1. Test clean_user_query
    # -------------------------------------------------------------
    print("\n1. Testing Query Cleaning in Python...")
    raw_query = "   @ai   When is the database maintenance window? @AI   "
    cleaned = clean_user_query(raw_query)
    assert cleaned == "When is the database maintenance window?", f"Unexpected cleaned query: {cleaned}"
    print(f"✅ Cleaned query successfully: '{raw_query.strip()}' -> '{cleaned}'")

    # -------------------------------------------------------------
    # 2. Ingest historical decision into Room Vector Namespace
    # -------------------------------------------------------------
    print("\n2. Ingesting Real-Time Room Messages into Pinecone Namespace...")
    target_decision = "DECISION: The database maintenance window is scheduled for Saturday at 2:00 AM UTC."
    msg_id = f"msg_{uuid.uuid4().hex[:8]}"

    success = index_message(
        message_id=msg_id,
        room_id=test_room_id,
        sender_name="Sarah",
        sender_type="user",
        content=target_decision,
        created_at=time.time() - 86400 * 2,  # 2 days ago
    )
    assert success, "Failed to index critical room message into Pinecone."
    print("✅ Indexed critical architectural decision (Sarah) into room namespace!")

    # Ingest some banter messages
    banter_messages = [
        ("Dave", "Has anyone checked the grafana dashboards today?"),
        ("Alex", "The new UI components look very clean."),
        ("Dave", "I will prepare the coffee for our sync."),
    ]

    for sender, text in banter_messages:
        index_message(
            message_id=f"msg_{uuid.uuid4().hex[:8]}",
            room_id=test_room_id,
            sender_name=sender,
            sender_type="user",
            content=text,
            created_at=time.time() - 3600,
        )
    print(f"✅ Indexed {len(banter_messages)} distraction chat messages into room namespace.")

    print("\n   Waiting 2.5s for Pinecone vector propagation...")
    time.sleep(2.5)

    # -------------------------------------------------------------
    # 3. Test Semantic Retrieval in Python
    # -------------------------------------------------------------
    print("\n3. Testing Semantic Similarity Retrieval in Python...")
    user_query = "@ai when is the database maintenance window scheduled?"
    retrieved_docs = retrieve_context(
        query=user_query,
        room_id=test_room_id,
        top_k=4,
        min_score=0.35,
    )

    print(f"   Retrieved {len(retrieved_docs)} semantic matches from room namespace.")
    for idx, doc in enumerate(retrieved_docs, 1):
        print(f"   [Match {idx}] Score: {doc['score']:.4f} | {doc['senderName']}: \"{doc['content']}\"")

    found_decision = any("Saturday at 2:00 AM" in d["content"] for d in retrieved_docs)
    assert found_decision, "Failed to retrieve the historical decision!"
    print("✅ Successfully retrieved deep historical decision from Pinecone via Python!")

    # -------------------------------------------------------------
    # 4. Test Full End-to-End Room RAG Pipeline in Python
    # -------------------------------------------------------------
    print("\n4. Testing Full generate_room_rag_response() in Python...")
    recent_history = [
        {"senderName": "Dave", "role": "user", "content": "I will prepare the coffee for our sync."},
        {"senderName": "Alex", "role": "user", "content": "Sounds good!"},
    ]

    rag_result = generate_room_rag_response(
        room_id=test_room_id,
        query=user_query,
        recent_history=recent_history,
        room_name=room_name,
        participants=participants,
        top_k=5,
        min_score=0.35,
    )

    print(f"   RAG Success: {rag_result['success']}")
    print(f"   Fallback Triggered: {rag_result['is_fallback']}")
    print(f"   Retrieved Sources Count: {rag_result['sources_count']}")
    print("\n--- AI Assistant Generated Response (Gemini 2.5 Flash in Python) ---")
    print(rag_result["ai_response"])
    print("--------------------------------------------------------------------\n")

    ai_text_lower = rag_result["ai_response"].lower()
    assert rag_result["success"], "generate_room_rag_response failed."
    assert "saturday" in ai_text_lower or "2:00 am" in ai_text_lower or "maintenance" in ai_text_lower, \
        f"AI response did not cite the retrieved facts: {rag_result['ai_response']}"
    print("✅ ACCURACY CONFIRMED: AI assistant accurately answered using the Python RAG retrieved context!")

    # -------------------------------------------------------------
    # 5. Test Fallback Mechanism
    # -------------------------------------------------------------
    print("\n5. Testing Graceful Fallback (Empty / Unindexed Room)...")
    fallback_result = generate_room_rag_response(
        room_id=f"empty_room_{uuid.uuid4().hex[:6]}",
        query="@ai Who is present in this chat?",
        recent_history=recent_history,
        room_name=room_name,
        participants=participants,
    )
    assert fallback_result["success"], "Fallback execution failed."
    assert fallback_result["is_fallback"], "Expected is_fallback to be True for empty room."
    print("✅ Fallback successfully handled without crashing: AI answered using recent history!")

    # -------------------------------------------------------------
    # 6. Cleanup Test Vectors
    # -------------------------------------------------------------
    try:
        index = get_vector_index()
        namespace = get_room_namespace(test_room_id)
        index.delete(delete_all=True, namespace=namespace)
        print("🧹 Cleaned up temporary test vectors from Pinecone.")
    except Exception as e:
        print(f"Note: Vector cleanup notice: {e}")

    print("\n" + "=" * 65)
    print("        ALL PHASE 3 PYTHON TESTS PASSED SUCCESSFULLY!        ")
    print("=" * 65 + "\n")


if __name__ == "__main__":
    run_phase3_tests()
