import os
from pathlib import Path
from dotenv import load_dotenv

# Base directory for the Python RAG service
BASE_DIR = Path(__file__).resolve().parent.parent
SERVER_DIR = BASE_DIR.parent / "server"

# Load environment variables (prefer rag_service/.env if present, otherwise server/.env)
local_env = BASE_DIR / ".env"
server_env = SERVER_DIR / ".env"

if local_env.exists():
    load_dotenv(dotenv_path=local_env)
if server_env.exists():
    load_dotenv(dotenv_path=server_env)

# Configuration settings
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY", "")
PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX_NAME", "mygpt-index")
RAG_SERVICE_PORT = int(os.getenv("RAG_SERVICE_PORT", "8000"))
RAG_SERVICE_HOST = os.getenv("RAG_SERVICE_HOST", "0.0.0.0")

# Database settings
MONGODB_URI = os.getenv("MONGODB_URI", "")

# Default Embedding Model & Parameters
DEFAULT_EMBEDDING_MODEL = "gemini-embedding-001"
MAX_INPUT_CHARS = 8000
EMBEDDING_DIMENSION = 3072

