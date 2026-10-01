import logging
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .configs.settings import (
    GEMINI_API_KEY,
    PINECONE_API_KEY,
    PINECONE_INDEX_NAME,
    DEFAULT_EMBEDDING_MODEL,
    EMBEDDING_DIMENSION,
    RAG_SERVICE_PORT,
    RAG_SERVICE_HOST,
)
from .configs.vector_db import (
    get_pinecone_client,
    is_vector_db_configured,
    get_vector_index,
)
from .services.embedding_service import (
    generate_embedding,
    generate_batch_embeddings,
    sanitize_text,
)
from .services.rag_service import (
    clean_user_query,
    index_message,
    retrieve_context,
    build_rag_prompt,
    generate_room_rag_response,
    index_user_message,
    retrieve_user_context,
    build_user_rag_prompt,
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("rag_service")

# Initialize FastAPI
app = FastAPI(
    title="MyGPT Python RAG Service",
    description="Python microservice handling Vector DB (Pinecone) & RAG semantic pipeline for MyGPT.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==========================================
# Request & Response Schemas
# ==========================================

class SingleEmbeddingRequest(BaseModel):
    text: str = Field(..., description="Text content to embed")
    model: Optional[str] = Field(DEFAULT_EMBEDDING_MODEL, description="Embedding model name")


class BatchEmbeddingRequest(BaseModel):
    texts: List[str] = Field(..., description="Array of text contents to embed")
    model: Optional[str] = Field(DEFAULT_EMBEDDING_MODEL, description="Embedding model name")


class EmbeddingResponse(BaseModel):
    success: bool
    dimensions: int
    embedding: Optional[List[float]] = None
    error: Optional[str] = None


class BatchEmbeddingResponse(BaseModel):
    success: bool
    count: int
    embeddings: List[Optional[List[float]]]


class CleanQueryRequest(BaseModel):
    query: str


class IndexRoomMessageRequest(BaseModel):
    message_id: Optional[str] = Field(None, alias="messageId")
    room_id: str = Field(..., alias="roomId")
    sender_name: Optional[str] = Field("User", alias="senderName")
    sender_type: Optional[str] = Field("user", alias="senderType")
    content: str
    created_at: Optional[Any] = Field(None, alias="createdAt")
    is_image: Optional[bool] = Field(False, alias="isImage")

    class Config:
        populate_by_name = True


class RetrieveRoomContextRequest(BaseModel):
    query: str
    room_id: str = Field(..., alias="roomId")
    top_k: Optional[int] = Field(5, alias="topK")
    min_score: Optional[float] = Field(0.35, alias="minScore")

    class Config:
        populate_by_name = True


class BuildRoomPromptRequest(BaseModel):
    query: str
    retrieved_docs: Optional[List[Dict[str, Any]]] = Field(default_factory=list, alias="retrievedDocs")
    recent_history: Optional[List[Dict[str, Any]]] = Field(default_factory=list, alias="recentHistory")
    room_name: Optional[str] = Field("Chat Room", alias="roomName")
    participants: Optional[List[Any]] = Field(default_factory=list)

    class Config:
        populate_by_name = True


class RoomRAGQueryRequest(BaseModel):
    room_id: str = Field(..., alias="roomId")
    query: str
    recent_history: Optional[List[Dict[str, Any]]] = Field(default_factory=list, alias="recentHistory")
    room_name: Optional[str] = Field("Chat Room", alias="roomName")
    participants: Optional[List[Any]] = Field(default_factory=list)
    top_k: Optional[int] = Field(6, alias="topK")
    min_score: Optional[float] = Field(0.35, alias="minScore")
    model: Optional[str] = Field("gemini-2.5-flash")

    class Config:
        populate_by_name = True


class RoomRAGQueryResponse(BaseModel):
    success: bool
    ai_response: str = Field(..., alias="aiResponse")
    retrieved_docs: List[Dict[str, Any]] = Field(default_factory=list, alias="retrievedDocs")
    is_fallback: bool = Field(False, alias="isFallback")
    sources_count: int = Field(0, alias="sourcesCount")
    error: Optional[str] = None

    class Config:
        populate_by_name = True
        # Allow both snake_case and camelCase serialization for Node.js bridge
        by_alias = False



class IndexUserMessageRequest(BaseModel):
    user_id: str = Field(..., alias="userId")
    chat_id: Optional[str] = Field(None, alias="chatId")
    chat_name: Optional[str] = Field("Chat", alias="chatName")
    role: Optional[str] = Field("user")
    content: str
    timestamp: Optional[Any] = None
    is_image: Optional[bool] = Field(False, alias="isImage")

    class Config:
        populate_by_name = True


class RetrieveUserContextRequest(BaseModel):
    query: str
    user_id: str = Field(..., alias="userId")
    exclude_chat_id: Optional[str] = Field(None, alias="excludeChatId")
    top_k: Optional[int] = Field(4, alias="topK")
    min_score: Optional[float] = Field(0.35, alias="minScore")

    class Config:
        populate_by_name = True


class BuildUserPromptRequest(BaseModel):
    query: str
    user_name: Optional[str] = Field("User", alias="userName")
    retrieved_docs: Optional[List[Dict[str, Any]]] = Field(default_factory=list, alias="retrievedDocs")
    recent_history: Optional[List[Dict[str, Any]]] = Field(default_factory=list, alias="recentHistory")

    class Config:
        populate_by_name = True


# ==========================================
# Phase 1 Endpoints
# ==========================================

@app.get("/")
@app.get("/health")
def health_check():
    """Health check endpoint providing status of Vector DB and Embedding configurations."""
    return {
        "status": "online",
        "service": "MyGPT Python RAG Service",
        "phase": 3,
        "features": {
            "gemini_api_configured": bool(GEMINI_API_KEY),
            "pinecone_configured": is_vector_db_configured(),
            "pinecone_index": PINECONE_INDEX_NAME,
            "embedding_model": DEFAULT_EMBEDDING_MODEL,
            "embedding_dimension": EMBEDDING_DIMENSION,
            "room_rag": True,
            "room_rag_chat": True,
            "user_rag": True,
        },
    }


@app.post("/api/rag/embed", response_model=EmbeddingResponse)
def embed_single_text(payload: SingleEmbeddingRequest):
    """Generate vector embedding for a single text."""
    if not payload.text or not payload.text.strip():
        raise HTTPException(status_code=400, detail="Text field cannot be empty.")

    embedding = generate_embedding(payload.text, model=payload.model or DEFAULT_EMBEDDING_MODEL)
    if not embedding:
        raise HTTPException(
            status_code=500, detail="Failed to generate embedding vector from Gemini API."
        )

    return EmbeddingResponse(
        success=True,
        dimensions=len(embedding),
        embedding=embedding,
    )


@app.post("/api/rag/embed-batch", response_model=BatchEmbeddingResponse)
def embed_batch_texts(payload: BatchEmbeddingRequest):
    """Generate vector embeddings for an array of texts in batches."""
    if not payload.texts or len(payload.texts) == 0:
        return BatchEmbeddingResponse(success=True, count=0, embeddings=[])

    embeddings = generate_batch_embeddings(payload.texts, model=payload.model or DEFAULT_EMBEDDING_MODEL)
    return BatchEmbeddingResponse(
        success=True,
        count=len(embeddings),
        embeddings=embeddings,
    )


@app.get("/api/rag/vector-status")
def get_vector_db_status():
    """Inspect and return Pinecone index connection and statistics."""
    if not is_vector_db_configured():
        return {
            "configured": False,
            "message": "PINECONE_API_KEY is not configured.",
        }

    try:
        index = get_vector_index()
        if not index:
            return {
                "configured": True,
                "connected": False,
                "error": f"Failed to acquire handle for index '{PINECONE_INDEX_NAME}'",
            }

        stats = index.describe_index_stats()
        stats_dict = stats.to_dict() if hasattr(stats, "to_dict") else dict(stats)

        return {
            "configured": True,
            "connected": True,
            "index_name": PINECONE_INDEX_NAME,
            "total_vector_count": stats_dict.get("total_vector_count", stats_dict.get("total_record_count", 0)),
            "dimension": stats_dict.get("dimension", EMBEDDING_DIMENSION),
            "namespaces": stats_dict.get("namespaces", {}),
        }
    except Exception as error:
        logger.error(f"Pinecone status check error: {error}")
        return {
            "configured": True,
            "connected": False,
            "error": str(error),
        }


# ==========================================
# Phase 2 Endpoints: Core RAG Engine
# ==========================================

@app.post("/api/rag/clean-query")
def api_clean_query(payload: CleanQueryRequest):
    """Strip @ai trigger and clean query whitespace."""
    return {"cleaned_query": clean_user_query(payload.query)}


@app.post("/api/rag/index-room-message")
def api_index_room_message(payload: IndexRoomMessageRequest):
    """Index a room message into Pinecone vector storage."""
    success = index_message(
        message_id=payload.message_id,
        room_id=payload.room_id,
        sender_name=payload.sender_name or "User",
        sender_type=payload.sender_type or "user",
        content=payload.content,
        created_at=payload.created_at,
        is_image=payload.is_image or False,
    )
    return {"success": success}


@app.post("/api/rag/retrieve-room-context")
def api_retrieve_room_context(payload: RetrieveRoomContextRequest):
    """Perform similarity search for top-K matching messages in a room."""
    docs = retrieve_context(
        query=payload.query,
        room_id=payload.room_id,
        top_k=payload.top_k or 5,
        min_score=payload.min_score if payload.min_score is not None else 0.35,
    )
    return {"results": docs, "count": len(docs)}


@app.post("/api/rag/build-room-prompt")
def api_build_room_prompt(payload: BuildRoomPromptRequest):
    """Assemble deduplicated RAG prompt payload for LLM."""
    messages = build_rag_prompt(
        query=payload.query,
        retrieved_docs=payload.retrieved_docs,
        recent_history=payload.recent_history,
        room_name=payload.room_name or "Chat Room",
        participants=payload.participants,
    )
    return {"messages": messages}


# ==========================================
# Phase 3 Endpoint: Live Room Chat RAG Pipeline
# ==========================================

@app.post("/api/rag/room-chat-rag")
def api_room_chat_rag(payload: RoomRAGQueryRequest):
    """
    Phase 3: Real-Time Room Chat RAG Pipeline.
    Retrieves semantic context from Vector DB, merges with recent chat buffer,
    generates response using Gemini LLM, and returns AI answer and sources.
    """
    result = generate_room_rag_response(
        room_id=payload.room_id,
        query=payload.query,
        recent_history=payload.recent_history,
        room_name=payload.room_name or "Chat Room",
        participants=payload.participants,
        top_k=payload.top_k or 6,
        min_score=payload.min_score if payload.min_score is not None else 0.35,
        model_name=payload.model or "gemini-2.5-flash",
    )
    # Emit both camelCase and snake_case for Node.js bridge compatibility
    return {
        "success": result.get("success", False),
        "aiResponse": result.get("ai_response", ""),
        "ai_response": result.get("ai_response", ""),
        "retrievedDocs": result.get("retrieved_docs", []),
        "retrieved_docs": result.get("retrieved_docs", []),
        "isFallback": result.get("is_fallback", False),
        "is_fallback": result.get("is_fallback", False),
        "sourcesCount": result.get("sources_count", 0),
        "sources_count": result.get("sources_count", 0),
        "error": result.get("error"),
    }



@app.post("/api/rag/index-user-message")
def api_index_user_message(payload: IndexUserMessageRequest):
    """Index a 1-on-1 private chat message into user namespace."""
    success = index_user_message(
        user_id=payload.user_id,
        chat_id=payload.chat_id,
        chat_name=payload.chat_name or "Chat",
        role=payload.role or "user",
        content=payload.content,
        timestamp=payload.timestamp,
        is_image=payload.is_image or False,
    )
    return {"success": success}


@app.post("/api/rag/retrieve-user-context")
def api_retrieve_user_context(payload: RetrieveUserContextRequest):
    """Retrieve long-term memory for a user across 1-on-1 chats."""
    docs = retrieve_user_context(
        query=payload.query,
        user_id=payload.user_id,
        exclude_chat_id=payload.exclude_chat_id,
        top_k=payload.top_k or 4,
        min_score=payload.min_score if payload.min_score is not None else 0.35,
    )
    return {"results": docs, "count": len(docs)}


@app.post("/api/rag/build-user-prompt")
def api_build_user_prompt(payload: BuildUserPromptRequest):
    """Assemble 1-on-1 personalized prompt with cross-session memories."""
    messages = build_user_rag_prompt(
        query=payload.query,
        user_name=payload.user_name or "User",
        retrieved_docs=payload.retrieved_docs,
        recent_history=payload.recent_history,
    )
    return {"messages": messages}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("rag_service.main:app", host=RAG_SERVICE_HOST, port=RAG_SERVICE_PORT, reload=True)
