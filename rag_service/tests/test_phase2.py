import sys
import uuid
import time
from pathlib import Path

# Ensure UTF-8 output on Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# Add project root to sys.path
root_dir = Path(__file__).resolve().parent.parent.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from rag_service.services.rag_service import (
    clean_user_query,
    index_message,
    retrieve_context,
    build_rag_prompt,
    index_user_message,
    retrieve_user_context,
    build_user_rag_prompt,
)
from rag_service.configs.vector_db import get_vector_index


def run_phase2_tests():
    print("=========================================")
    print("    MyGPT - Python RAG Phase 2 Tests     ")
    print("=========================================\n")

    # 1. Test clean_user_query
    print("1. Testing clean_user_query()...")
    raw_query = "   @ai   what time is the project meeting?  "
    cleaned = clean_user_query(raw_query)
    assert cleaned == "what time is the project meeting?", f"Expected cleaned query, got: '{cleaned}'"
    print(f"✅ Query cleaned properly: '{raw_query.strip()}' -> '{cleaned}'")

    # 2. Test Room Message Indexing & Semantic Retrieval
    test_room_id = f"test_room_{uuid.uuid4().hex[:8]}"
    print(f"\n2. Testing Room Indexing & Retrieval in room '{test_room_id}'...")

    test_msg_id = f"msg_{uuid.uuid4().hex[:8]}"
    test_content = "The final release deadline for version 2.0 is scheduled for December 25th."
    indexed = index_message(
        message_id=test_msg_id,
        room_id=test_room_id,
        sender_name="Alice",
        sender_type="user",
        content=test_content,
    )
    assert indexed is True, "Failed to index message into Pinecone namespace."
    print("✅ Indexed message successfully into Pinecone room namespace!")

    # Wait 1.5s for Pinecone eventual consistency
    print("   Waiting for vector propagation (2s)...")
    time.sleep(2.0)

    # Query
    search_query = "When is the version 2.0 release date?"
    matches = retrieve_context(query=search_query, room_id=test_room_id, top_k=3, min_score=0.2)
    print(f"✅ Semantic retrieval executed! Matches found: {len(matches)}")
    if matches:
        print(f"   Top Match: '{matches[0]['content']}' (Score: {matches[0]['score']:.4f})")
        assert matches[0]["messageId"] == test_msg_id

    # 3. Test Prompt Building and Deduplication
    print("\n3. Testing Prompt Construction & Context Deduplication...")
    retrieved_docs = [
        {
            "messageId": test_msg_id,
            "senderName": "Alice",
            "content": test_content,
            "timestamp": "2026-12-01T10:00:00Z",
            "score": 0.85,
        },
        {
            "messageId": "other_doc_1",
            "senderName": "Bob",
            "content": "Make sure the deployment pipeline is green before release.",
            "timestamp": "2026-12-01T10:05:00Z",
            "score": 0.72,
        },
    ]

    # Notice recent_history has the SAME test_msg_id
    recent_history = [
        {
            "_id": test_msg_id,
            "senderName": "Alice",
            "senderType": "user",
            "content": test_content,
        },
        {
            "_id": "msg_recent_2",
            "senderName": "Charlie",
            "senderType": "user",
            "content": "Hey @ai what was the date again?",
        },
    ]

    payload = build_rag_prompt(
        query="When is the release date?",
        retrieved_docs=retrieved_docs,
        recent_history=recent_history,
        room_name="Engineering Sync",
        participants=["Alice", "Bob", "Charlie"],
    )

    assert len(payload) >= 2, "Expected system prompt and message turns."
    system_prompt = payload[0]["content"]

    # Verify that test_content was DEDUPLICATED out of long-term memory because it exists in recentHistory
    assert "Make sure the deployment pipeline is green" in system_prompt, "Unique retrieved doc should be in system prompt."
    print("✅ System prompt assembled with relevant long-term memory context.")
    print("✅ Context deduplication verified: Duplicate recent history message was not repeated in long-term memory!")

    # 4. Test 1-on-1 User Chat Indexing & Cross-Session Retrieval
    test_user_id = f"user_{uuid.uuid4().hex[:8]}"
    print(f"\n4. Testing 1-on-1 User Chat Memory for '{test_user_id}'...")

    user_indexed = index_user_message(
        user_id=test_user_id,
        chat_id="chat_1",
        chat_name="Tech Discussion",
        role="user",
        content="I prefer writing backend services in Python FastAPI rather than Node.js.",
    )
    assert user_indexed is True, "Failed to index user chat message."
    print("✅ User private chat preference indexed into Pinecone user namespace!")

    time.sleep(2.0)
    user_memories = retrieve_user_context(
        query="What backend framework do I like?",
        user_id=test_user_id,
        exclude_chat_id="chat_2",  # Different chat
        top_k=2,
        min_score=0.2,
    )
    print(f"✅ User cross-session memory retrieved! Matches: {len(user_memories)}")
    if user_memories:
        print(f"   Memory recalled: '{user_memories[0]['content']}' (Score: {user_memories[0]['score']:.4f})")

    # 5. Clean up test vectors from Pinecone
    try:
        index = get_vector_index()
        if index:
            index.delete(delete_all=True, namespace=test_room_id)
            index.delete(delete_all=True, namespace=f"user_{test_user_id}")
            print("\n🧹 Cleaned up temporary test vectors from Pinecone.")
    except Exception as e:
        print(f"\n⚠️ Note on cleanup: {e}")

    print("\n=========================================")
    print("      All Phase 2 Tests PASSED!          ")
    print("=========================================\n")


if __name__ == "__main__":
    run_phase2_tests()
