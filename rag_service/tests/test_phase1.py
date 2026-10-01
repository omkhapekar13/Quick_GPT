import sys
from pathlib import Path

# Ensure UTF-8 output on Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# Add project root to sys.path so rag_service can be imported directly
root_dir = Path(__file__).resolve().parent.parent.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from rag_service.configs.settings import (
    GEMINI_API_KEY,
    PINECONE_API_KEY,
    PINECONE_INDEX_NAME,
    DEFAULT_EMBEDDING_MODEL,
    EMBEDDING_DIMENSION,
)
from rag_service.configs.vector_db import (
    get_pinecone_client,
    get_vector_index,
    is_vector_db_configured,
)
from rag_service.services.embedding_service import (
    generate_embedding,
    generate_batch_embeddings,
)


def run_phase1_diagnostic():
    print("=========================================")
    print("   MyGPT - Python RAG Phase 1 Diagnostic ")
    print("=========================================\n")

    # 1. Test Embedding Generation
    print(f"1. Testing Embedding Generation (Model: {DEFAULT_EMBEDDING_MODEL})...")
    if not GEMINI_API_KEY:
        print("❌ GEMINI_API_KEY is not set in environment or server/.env")
    else:
        sample_text = "Hello, testing Python RAG vector embedding for MyGPT."
        try:
            embedding = generate_embedding(sample_text)
            if embedding and isinstance(embedding, list):
                print("✅ Embedding generated successfully in Python!")
                print(f"   Dimensions: {len(embedding)} (Expected: {EMBEDDING_DIMENSION})")
                preview = [f"{n:.4f}" for n in embedding[:5]]
                print(f"   Sample vector slice: [{', '.join(preview)}...]")
            else:
                print("❌ Failed to generate embedding vector.")
        except Exception as err:
            print(f"❌ Embedding generation error: {err}")

    # 2. Test Batch Embeddings
    print("\n2. Testing Batch Embedding Generation...")
    batch_samples = [
        "First message for indexing in Python",
        "Second message with important project context",
        "Third message to check batch order and integrity",
    ]
    try:
        batch_embeddings = generate_batch_embeddings(batch_samples)
        if len(batch_embeddings) == 3 and all(e is not None and len(e) == EMBEDDING_DIMENSION for e in batch_embeddings):
            print(f"✅ Batch embeddings generated successfully ({len(batch_embeddings)} vectors, {EMBEDDING_DIMENSION} dims each)!")
        else:
            print("⚠️ Batch embeddings returned incomplete vectors.")
    except Exception as err:
        print(f"❌ Batch embedding error: {err}")

    # 3. Check Pinecone Vector DB Configuration
    print("\n3. Checking Pinecone Vector DB Configuration in Python...")
    if not is_vector_db_configured():
        print("⚠️ PINECONE_API_KEY is not configured in environment or server/.env")
        print("   (Pinecone can be added when ready; embedding service is fully operational)")
    elif not PINECONE_INDEX_NAME:
        print("⚠️ PINECONE_INDEX_NAME is missing in environment or server/.env")
    else:
        try:
            client = get_pinecone_client()
            if not client:
                print("❌ Failed to create Pinecone client instance.")
            else:
                print("✅ Pinecone client initialized in Python.")
                print(f"   Connecting to index: '{PINECONE_INDEX_NAME}'...")
                index = get_vector_index()
                if index:
                    stats = index.describe_index_stats()
                    stats_dict = stats.to_dict() if hasattr(stats, "to_dict") else dict(stats)
                    total_count = stats_dict.get("total_vector_count", stats_dict.get("total_record_count", 0))
                    dim = stats_dict.get("dimension", EMBEDDING_DIMENSION)
                    print("✅ Pinecone index connected successfully!")
                    print(f"   Total vector count: {total_count}")
                    print(f"   Dimension: {dim}")
                else:
                    print("❌ Could not get handle to Pinecone index.")
        except Exception as err:
            print(f"❌ Pinecone connection error: {err}")

    print("\n=========================================")
    print("Python RAG Phase 1 Diagnostic Completed.")
    print("=========================================\n")


if __name__ == "__main__":
    run_phase1_diagnostic()
