import logging
from typing import Optional
from pinecone import Pinecone
from .settings import PINECONE_API_KEY, PINECONE_INDEX_NAME

logger = logging.getLogger("rag_service.vector_db")

_pinecone_client: Optional[Pinecone] = None


def get_pinecone_client() -> Optional[Pinecone]:
    """
    Initializes and returns the Pinecone client singleton.
    Returns None if PINECONE_API_KEY is not configured.
    """
    global _pinecone_client

    if not PINECONE_API_KEY:
        return None

    if _pinecone_client is None:
        try:
            _pinecone_client = Pinecone(api_key=PINECONE_API_KEY)
            logger.info("Pinecone client initialized successfully.")
        except Exception as err:
            logger.error(f"Failed to initialize Pinecone client: {err}")
            return None

    return _pinecone_client


def is_vector_db_configured() -> bool:
    """Check if Vector DB (Pinecone) API key is configured."""
    return bool(PINECONE_API_KEY)


def get_vector_index(custom_index_name: Optional[str] = None):
    """
    Get index handle for Pinecone.
    """
    client = get_pinecone_client()
    if not client:
        return None

    index_name = custom_index_name or PINECONE_INDEX_NAME or "mygpt-index"
    try:
        return client.Index(index_name)
    except Exception as error:
        logger.error(f"Error accessing Pinecone index '{index_name}': {error}")
        return None


def get_room_namespace(namespace: any) -> str:
    """
    Normalizes and returns the namespace string for a room.
    e.g. roomId string.
    """
    if not namespace:
        return ""
    return str(namespace).strip()


def get_user_namespace(user_id: any) -> str:
    """
    Normalizes and returns the namespace string for 1-on-1 private chat memory.
    e.g. 'user_{user_id}'
    """
    if not user_id:
        return ""
    return f"user_{str(user_id).strip()}"
