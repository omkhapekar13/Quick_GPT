import re
import time
import logging
from typing import List, Optional
from openai import OpenAI
from ..configs.settings import (
    GEMINI_API_KEY,
    DEFAULT_EMBEDDING_MODEL,
    MAX_INPUT_CHARS,
)

logger = logging.getLogger("rag_service.embedding")

# Initialize OpenAI client configured with Google Gemini endpoint
_openai_client = None


def get_embedding_client() -> Optional[OpenAI]:
    """Returns singleton client for Gemini embedding generation."""
    global _openai_client
    if not GEMINI_API_KEY:
        return None
    if _openai_client is None:
        _openai_client = OpenAI(
            api_key=GEMINI_API_KEY,
            base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
        )
    return _openai_client


def sanitize_text(text: any) -> str:
    """
    Clean, sanitize, and truncate text for embedding generation.
    Removes null bytes, normalizes whitespace, and caps length safely.
    """
    if text is None:
        return ""
    if not isinstance(text, str):
        text = str(text)

    # Normalize whitespace, remove null bytes, and trim
    cleaned = text.replace("\0", "")
    cleaned = re.sub(r"\s+", " ", cleaned).strip()

    if len(cleaned) > MAX_INPUT_CHARS:
        return cleaned[:MAX_INPUT_CHARS]
    return cleaned


def generate_embedding(
    text: str,
    model: str = DEFAULT_EMBEDDING_MODEL,
    retries: int = 2,
) -> Optional[List[float]]:
    """
    Generate vector embedding for a single text string with retry logic.
    Returns 3072-dim list of floats or None.
    """
    cleaned = sanitize_text(text)
    if not cleaned:
        return None

    client = get_embedding_client()
    if not client:
        logger.error("GEMINI_API_KEY is not configured.")
        return None

    for attempt in range(retries + 1):
        try:
            response = client.embeddings.create(
                model=model,
                input=cleaned,
            )
            if response and response.data and len(response.data) > 0:
                return response.data[0].embedding
            raise ValueError("Invalid embedding response structure")
        except Exception as error:
            status_code = getattr(error, "status_code", None)
            if attempt < retries and (status_code == 429 or (status_code and status_code >= 500)):
                sleep_sec = 0.5 * (2 ** attempt)
                logger.warning(f"Embedding rate limit / temporary error ({error}). Retrying in {sleep_sec}s...")
                time.sleep(sleep_sec)
                continue

            logger.error(f"Embedding generation error on attempt {attempt + 1}: {error}")
            return None

    return None


def generate_batch_embeddings(
    texts: List[str],
    batch_size: int = 20,
    model: str = DEFAULT_EMBEDDING_MODEL,
) -> List[Optional[List[float]]]:
    """
    Generate vector embeddings for a list of texts in chunks.
    Preserves exact input order and returns None for failed/empty items.
    """
    if not isinstance(texts, list) or len(texts) == 0:
        return []

    client = get_embedding_client()
    if not client:
        return [None] * len(texts)

    results: List[Optional[List[float]]] = []

    for i in range(0, len(texts), batch_size):
        chunk = texts[i : i + batch_size]
        cleaned_chunk = [sanitize_text(t) for t in chunk]
        valid_inputs = [t for t in cleaned_chunk if len(t) > 0]

        if not valid_inputs:
            results.extend([None] * len(chunk))
            continue

        try:
            response = client.embeddings.create(
                model=model,
                input=valid_inputs,
            )

            vector_idx = 0
            for item in cleaned_chunk:
                if item and response and response.data and vector_idx < len(response.data):
                    results.append(response.data[vector_idx].embedding)
                    vector_idx += 1
                else:
                    results.append(None)
        except Exception as error:
            logger.error(f"Error embedding batch {i} - {i + batch_size}: {error}")
            results.extend([None] * len(chunk))

    return results
