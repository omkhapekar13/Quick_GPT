import re
import time
import uuid
import logging
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

from openai import OpenAI
from ..configs.settings import GEMINI_API_KEY
from ..configs.vector_db import (
    get_vector_index,
    get_room_namespace,
    get_user_namespace,
    is_vector_db_configured,
)
from .embedding_service import generate_embedding

logger = logging.getLogger("rag_service.core")

# OpenAI-compatible Gemini client (same pattern as Node server/configs/openai.js)
_llm_client: Optional[OpenAI] = None
if GEMINI_API_KEY:
    _llm_client = OpenAI(
        api_key=GEMINI_API_KEY,
        base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
    )


def _normalize_gemini_model(model_name: Optional[str]) -> str:
    """Normalize model names for the OpenAI-compatible Gemini endpoint."""
    name = (model_name or "gemini-2.5-flash").strip()
    if name.startswith("models/"):
        name = name[len("models/"):]
    return name or "gemini-2.5-flash"



def clean_user_query(query: str) -> str:
    """
    Clean user query by stripping @ai trigger tags and extra whitespace for clean semantic search.
    """
    if not query or not isinstance(query, str):
        return ""
    # Strip @ai (case-insensitive with word boundary)
    cleaned = re.sub(r"(?:^|\s)@ai\b", "", query, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


def index_message(
    message_id: Optional[str],
    room_id: str,
    sender_name: str,
    sender_type: str = "user",
    content: str = "",
    created_at: Optional[Any] = None,
    is_image: bool = False,
) -> bool:
    """
    Index a single room message into Vector DB (Pinecone) under the room's namespace.
    """
    if is_image or not content or not isinstance(content, str) or not content.strip() or not room_id:
        return False

    if not is_vector_db_configured():
        return False

    try:
        formatted_text = f"[{sender_name or 'User'}]: {content.strip()}"
        embedding = generate_embedding(formatted_text)

        if not embedding or not isinstance(embedding, list):
            return False

        index = get_vector_index()
        if not index:
            return False

        namespace = get_room_namespace(room_id)
        record_id = (
            str(message_id)
            if message_id
            else f"msg_{int(time.time() * 1000)}_{uuid.uuid4().hex[:6]}"
        )

        # Convert created_at to ISO string
        if isinstance(created_at, datetime):
            timestamp_str = created_at.isoformat()
        elif created_at:
            timestamp_str = str(created_at)
        else:
            timestamp_str = datetime.now(timezone.utc).isoformat()

        record = {
            "id": record_id,
            "values": embedding,
            "metadata": {
                "messageId": str(message_id) if message_id else "",
                "roomId": str(room_id),
                "senderName": sender_name or "User",
                "senderType": sender_type or "user",
                "content": content[:1500],  # Store snippet in metadata for fast recall
                "timestamp": timestamp_str,
            },
        }

        index.upsert(vectors=[record], namespace=namespace)
        logger.info(f"Indexed room message {record_id} in namespace '{namespace}'")
        return True
    except Exception as error:
        logger.error(f"RAG indexing error for message {message_id}: {error}")
        return False


def retrieve_context(
    query: str,
    room_id: str,
    top_k: int = 5,
    min_score: float = 0.35,
) -> List[Dict[str, Any]]:
    """
    Retrieve the most semantically relevant messages for a query within a room.
    """
    if not query or not room_id or not is_vector_db_configured():
        return []

    cleaned_query = clean_user_query(query) or query

    try:
        query_embedding = generate_embedding(cleaned_query)
        if not query_embedding:
            return []

        index = get_vector_index()
        if not index:
            return []

        namespace = get_room_namespace(room_id)
        query_response = index.query(
            vector=query_embedding,
            top_k=max(1, int(top_k)),
            include_metadata=True,
            namespace=namespace,
        )

        matches = getattr(query_response, "matches", []) or []
        results = []

        for match in matches:
            # Handle match as dict or object
            score = getattr(match, "score", None)
            if score is None and isinstance(match, dict):
                score = match.get("score", 0.0)
            score = score if score is not None else 0.0

            metadata = getattr(match, "metadata", None)
            if metadata is None and isinstance(match, dict):
                metadata = match.get("metadata", {})
            metadata = metadata or {}

            if score >= min_score and metadata:
                match_id = getattr(match, "id", None) or (match.get("id") if isinstance(match, dict) else "")
                results.append({
                    "messageId": metadata.get("messageId") or match_id or "",
                    "senderName": metadata.get("senderName") or "Unknown",
                    "senderType": metadata.get("senderType") or "user",
                    "content": metadata.get("content") or "",
                    "timestamp": metadata.get("timestamp") or "",
                    "score": float(score),
                })

        return results
    except Exception as error:
        logger.error(f"RAG context retrieval error in room {room_id}: {error}")
        return []


def build_rag_prompt(
    query: str,
    retrieved_docs: Optional[List[Dict[str, Any]]] = None,
    recent_history: Optional[List[Dict[str, Any]]] = None,
    room_name: str = "Chat Room",
    participants: Optional[List[Any]] = None,
) -> List[Dict[str, str]]:
    """
    Assemble an optimized RAG prompt combining retrieved semantic context and recent chat memory.
    Deduplicates semantic docs that are already present in immediate recent history.
    """
    retrieved_docs = retrieved_docs or []
    recent_history = recent_history or []
    participants = participants or []

    # Normalize participant names
    participant_names = []
    for p in participants:
        if isinstance(p, dict):
            name = p.get("userName") or p.get("name")
            if name:
                participant_names.append(str(name))
        elif p:
            participant_names.append(str(p))

    participant_list = ", ".join(participant_names) if participant_names else "Multiple Participants"

    system_prompt = (
        f'You are an AI assistant in a collaborative group chat room called "{room_name}".\n'
        f"The active participants are: {participant_list}.\n"
        "Respond helpfully, accurately, and concisely. Address the user who mentioned you."
    )

    # Filter out retrievedDocs that already exist in recentHistory by ID or exact content
    recent_ids = set()
    recent_contents = set()
    for m in recent_history:
        mid = m.get("_id") or m.get("messageId") or m.get("id")
        if mid:
            recent_ids.add(str(mid))
        content = m.get("content")
        if content and isinstance(content, str):
            recent_contents.add(content.strip())

    unique_retrieved_docs = [
        doc for doc in retrieved_docs
        if (not doc.get("messageId") or str(doc.get("messageId")) not in recent_ids)
        and (not doc.get("content") or doc.get("content").strip() not in recent_contents)
    ]

    # If we have relevant long-term memories / retrieved context, add them to system knowledge
    if unique_retrieved_docs:
        memory_lines = []
        for doc in unique_retrieved_docs:
            timestamp_str = doc.get("timestamp")
            time_display = f" ({timestamp_str[:10]})" if timestamp_str else ""
            sender = doc.get("senderName") or "User"
            content = doc.get("content") or ""
            memory_lines.append(f'- [{sender}{time_display}]: "{content}"')

        memory_context = "\n".join(memory_lines)
        system_prompt += (
            f"\n\n--- RELEVANT PAST CONVERSATION CONTEXT (Retrieved from Long-Term Memory) ---\n"
            f"{memory_context}\n"
            f"--- Use the context above to inform your answer if relevant to the conversation. ---"
        )

    messages_payload: List[Dict[str, str]] = [
        {"role": "system", "content": system_prompt}
    ]

    # Append immediate chronological recent history (e.g. last 3-5 messages)
    for m in recent_history:
        sender_type = m.get("senderType") or m.get("role") or "user"
        role = "assistant" if sender_type in ["ai", "assistant"] else "user"
        speaker = m.get("senderName") or ("AI Assistant" if role == "assistant" else "User")
        content = m.get("content") or ""
        messages_payload.append({
            "role": role,
            "content": f"[{speaker}]: {content}",
        })

    # If query is not in recent history, append it
    last_history_msg = recent_history[-1] if recent_history else None
    last_content = last_history_msg.get("content", "").strip() if last_history_msg else ""
    if not last_history_msg or last_content != query.strip():
        messages_payload.append({
            "role": "user",
            "content": query,
        })

    return messages_payload
 
 
def generate_room_rag_response(
    room_id: str,
    query: str,
    recent_history: Optional[List[Dict[str, Any]]] = None,
    room_name: str = "Chat Room",
    participants: Optional[List[Any]] = None,
    top_k: int = 6,
    min_score: float = 0.35,
    model_name: str = "gemini-2.5-flash",
) -> Dict[str, Any]:
    """
    Phase 3: Real-Time Room Chat RAG Pipeline in Python.
    1. Strips @ai trigger tags from query.
    2. Performs semantic similarity search on room's Pinecone vector index.
    3. Merges retrieved context chunks with immediate recent history buffer (deduplicated).
    4. Generates AI assistant response using Gemini LLM (OpenAI-compatible API).
    5. Returns answer, retrieved sources, and resilience/fallback metadata.
    """
    recent_history = recent_history or []
    participants = participants or []
    cleaned_query = clean_user_query(query) or query

    retrieved_docs: List[Dict[str, Any]] = []
    is_fallback = False

    # 1. Semantic Retrieval with Graceful Fallback
    try:
        retrieved_docs = retrieve_context(
            query=cleaned_query,
            room_id=room_id,
            top_k=top_k,
            min_score=min_score,
        )
    except Exception as ret_err:
        logger.warning(f"Room RAG retrieval fallback triggered for room {room_id}: {ret_err}")
        is_fallback = True
        retrieved_docs = []

    # 2. Assemble Deduplicated RAG Prompt
    messages_payload = build_rag_prompt(
        query=query,
        retrieved_docs=retrieved_docs,
        recent_history=recent_history,
        room_name=room_name,
        participants=participants,
    )

    # 3. Generate AI Response with Gemini via OpenAI-compatible endpoint
    if not _llm_client:
        logger.error("Gemini LLM client is not configured (missing GEMINI_API_KEY).")
        return {
            "success": False,
            "error": "GEMINI_API_KEY is not configured",
            "ai_response": "I encountered an issue processing that room query. Please try again.",
            "retrieved_docs": retrieved_docs,
            "is_fallback": True,
            "sources_count": len(retrieved_docs),
        }

    try:
        response = _llm_client.chat.completions.create(
            model=_normalize_gemini_model(model_name),
            messages=messages_payload,
        )
        ai_response_text = (
            response.choices[0].message.content.strip()
            if response and response.choices and response.choices[0].message.content
            else "I am here to help."
        )

        return {
            "success": True,
            "ai_response": ai_response_text,
            "retrieved_docs": retrieved_docs,
            "is_fallback": is_fallback or len(retrieved_docs) == 0,
            "sources_count": len(retrieved_docs),
        }
    except Exception as gen_err:
        logger.error(f"Gemini LLM generation failed in Python RAG service: {gen_err}")
        return {
            "success": False,
            "error": str(gen_err),
            "ai_response": "I encountered an issue processing that room query. Please try again.",
            "retrieved_docs": retrieved_docs,
            "is_fallback": True,
            "sources_count": len(retrieved_docs),
        }


# ==========================================
# 1-on-1 User Private Chat RAG Functions
# ==========================================

def index_user_message(
    user_id: str,
    chat_id: Optional[str] = None,
    chat_name: str = "Chat",
    role: str = "user",
    content: str = "",
    timestamp: Optional[Any] = None,
    is_image: bool = False,
) -> bool:
    """
    Index a 1-on-1 private chat message into user-specific vector namespace.
    """
    if is_image or not content or not isinstance(content, str) or not content.strip() or not user_id:
        return False

    if not is_vector_db_configured():
        return False

    try:
        formatted_text = f"[{'Assistant' if role == 'assistant' else 'User'}]: {content.strip()}"
        embedding = generate_embedding(formatted_text)

        if not embedding or not isinstance(embedding, list):
            return False

        index = get_vector_index()
        if not index:
            return False

        namespace = get_user_namespace(user_id)
        record_id = f"user_{user_id}_chat_{chat_id or 'global'}_{int(time.time() * 1000)}_{uuid.uuid4().hex[:6]}"

        if isinstance(timestamp, datetime):
            timestamp_str = timestamp.isoformat()
        elif timestamp:
            timestamp_str = str(timestamp)
        else:
            timestamp_str = datetime.now(timezone.utc).isoformat()

        record = {
            "id": record_id,
            "values": embedding,
            "metadata": {
                "userId": str(user_id),
                "chatId": str(chat_id) if chat_id else "",
                "chatName": chat_name or "Chat",
                "role": role or "user",
                "content": content[:1500],
                "timestamp": timestamp_str,
            },
        }

        index.upsert(vectors=[record], namespace=namespace)
        logger.info(f"Indexed user message {record_id} in namespace '{namespace}'")
        return True
    except Exception as error:
        logger.error(f"User RAG indexing error for user {user_id}: {error}")
        return False


def retrieve_user_context(
    query: str,
    user_id: str,
    exclude_chat_id: Optional[str] = None,
    top_k: int = 4,
    min_score: float = 0.35,
) -> List[Dict[str, Any]]:
    """
    Retrieve relevant cross-session context for a user in 1-on-1 chats.
    """
    if not query or not user_id or not is_vector_db_configured():
        return []

    try:
        query_embedding = generate_embedding(query.strip())
        if not query_embedding:
            return []

        index = get_vector_index()
        if not index:
            return []

        namespace = get_user_namespace(user_id)
        query_response = index.query(
            vector=query_embedding,
            top_k=max(1, int(top_k)),
            include_metadata=True,
            namespace=namespace,
        )

        matches = getattr(query_response, "matches", []) or []
        exclude_chat_str = str(exclude_chat_id) if exclude_chat_id else None
        results = []

        for match in matches:
            score = getattr(match, "score", None)
            if score is None and isinstance(match, dict):
                score = match.get("score", 0.0)
            score = score if score is not None else 0.0

            metadata = getattr(match, "metadata", None)
            if metadata is None and isinstance(match, dict):
                metadata = match.get("metadata", {})
            metadata = metadata or {}

            if score < min_score:
                continue

            if exclude_chat_str and metadata.get("chatId") == exclude_chat_str:
                continue

            results.append({
                "chatId": metadata.get("chatId") or "",
                "chatName": metadata.get("chatName") or "Past Chat",
                "role": metadata.get("role") or "user",
                "content": metadata.get("content") or "",
                "timestamp": metadata.get("timestamp") or "",
                "score": float(score),
            })

        return results
    except Exception as error:
        logger.error(f"User RAG retrieval error for user {user_id}: {error}")
        return []


def build_user_rag_prompt(
    query: str,
    user_name: str = "User",
    retrieved_docs: Optional[List[Dict[str, Any]]] = None,
    recent_history: Optional[List[Dict[str, Any]]] = None,
) -> List[Dict[str, str]]:
    """
    Assemble optimized RAG prompt for 1-on-1 private chat with cross-session memory.
    """
    retrieved_docs = retrieved_docs or []
    recent_history = recent_history or []

    system_prompt = (
        f"You are a helpful, intelligent AI assistant in a 1-on-1 private conversation with {user_name}.\n"
        "Respond thoughtfully, concisely, and accurately."
    )

    recent_contents = set()
    for m in recent_history:
        content = m.get("content")
        if content and isinstance(content, str):
            recent_contents.add(content.strip())

    unique_retrieved_docs = [
        doc for doc in retrieved_docs
        if not doc.get("content") or doc.get("content").strip() not in recent_contents
    ]

    if unique_retrieved_docs:
        memory_lines = []
        for doc in unique_retrieved_docs:
            timestamp_str = doc.get("timestamp")
            time_display = f" ({timestamp_str[:10]})" if timestamp_str else ""
            chat_label = f'Chat "{doc.get("chatName")}"' if doc.get("chatName") else "Past Conversation"
            speaker = "AI" if doc.get("role") == "assistant" else user_name
            memory_lines.append(f'- [{chat_label}{time_display} - {speaker}]: "{doc.get("content", "")}"')

        memory_context = "\n".join(memory_lines)
        system_prompt += (
            f"\n\n--- RELEVANT PAST CONVERSATIONS / USER PREFERENCES (Retrieved from Long-Term Memory) ---\n"
            f"{memory_context}\n"
            f"--- Use the memories above to personalize your responses and recall user preferences when relevant. ---"
        )

    messages_payload: List[Dict[str, str]] = [
        {"role": "system", "content": system_prompt}
    ]

    for m in recent_history:
        content = m.get("content")
        if content and isinstance(content, str):
            role = "assistant" if m.get("role") == "assistant" else "user"
            messages_payload.append({
                "role": role,
                "content": content,
            })

    last_history_msg = recent_history[-1] if recent_history else None
    last_content = last_history_msg.get("content", "").strip() if last_history_msg else ""
    if not last_history_msg or last_content != query.strip():
        messages_payload.append({
            "role": "user",
            "content": query,
        })

    return messages_payload
