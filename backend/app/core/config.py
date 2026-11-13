from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parents[2]
load_dotenv(BACKEND_DIR / ".env")

DATA_DIR = Path(os.environ.get("UNBOUND_DATA_DIR", BACKEND_DIR / "data")).expanduser().resolve()
UPLOAD_DIR = DATA_DIR / "datasets"
DUCKDB_PATH = DATA_DIR / "unbound.duckdb"
MAX_UPLOAD_BYTES = 50 * 1024 * 1024
MAX_DATASETS = 1
MAX_ROWS = 1_000_000
MAX_COLUMNS = 500
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434").rstrip("/")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "gemma3:4b")
PERSISTENCE_API_URL = os.environ.get("PERSISTENCE_API_URL", "http://127.0.0.1:8100").rstrip("/")
PERSISTENCE_API_TOKEN = os.environ.get("UNBOUND_SERVICE_TOKEN", "")

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
