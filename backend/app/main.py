from __future__ import annotations

import os
import re
import uuid
from pathlib import Path
from typing import Any

import duckdb
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from .contracts import DatasetProfile, HealthResponse

BACKEND_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = Path(os.environ.get("UNBOUND_DATA_DIR", BACKEND_DIR / "data"))
UPLOAD_DIR = DATA_DIR / "datasets"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
MAX_UPLOAD_BYTES = 50 * 1024 * 1024

app = FastAPI(
    title="Unbound local API",
    version="0.1.0",
    openapi_url="/api/v1/openapi.json",
    docs_url="/api/v1/docs",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


def quote_identifier(value: str) -> str:
    return '"' + value.replace('"', '""') + '"'


def profile_csv(path: Path, dataset_id: str, original_name: str) -> dict[str, Any]:
    connection = duckdb.connect(database=":memory:")
    source = "read_csv_auto(?, header=true, sample_size=10000)"
    try:
        rows = int(connection.execute("SELECT COUNT(*) FROM " + source, [str(path)]).fetchone()[0])
        description = connection.execute("DESCRIBE SELECT * FROM " + source, [str(path)]).fetchall()
        columns = []
        for name, data_type, *_ in description:
            quoted = quote_identifier(str(name))
            nulls, distinct = connection.execute(
                "SELECT COUNT(*) FILTER (WHERE {0} IS NULL), COUNT(DISTINCT {0}) FROM {1}".format(quoted, source),
                [str(path)],
            ).fetchone()
            samples = connection.execute(
                "SELECT DISTINCT {0} FROM {1} WHERE {0} IS NOT NULL LIMIT 5".format(quoted, source),
                [str(path)],
            ).fetchall()
            columns.append(
                {
                    "name": str(name),
                    "type": str(data_type),
                    "nulls": int(nulls),
                    "distinct": int(distinct),
                    "samples": [str(row[0]) for row in samples],
                }
            )
        return {
            "id": dataset_id,
            "name": original_name,
            "rows": rows,
            "columns": columns,
            "size": path.stat().st_size,
        }
    except Exception as exc:
        path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="Could not read CSV: " + str(exc)) from exc
    finally:
        connection.close()


@app.get("/api/v1/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return {"status": "ok", "service": "local"}


@app.post("/api/v1/datasets/upload", response_model=DatasetProfile)
async def upload_csv(file: UploadFile = File(...)) -> dict[str, Any]:
    if not file.filename or Path(file.filename).suffix.lower() != ".csv":
        raise HTTPException(status_code=400, detail="Choose a .csv file")
    content = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="CSV files must be 50 MB or smaller")
    if not content:
        raise HTTPException(status_code=400, detail="The selected CSV is empty")
    dataset_id = uuid.uuid4().hex
    path = UPLOAD_DIR / (dataset_id + ".csv")
    path.write_bytes(content)
    safe_name = re.sub(r"[\\/\x00-\x1f]", "_", Path(file.filename).name)[:180]
    return profile_csv(path, dataset_id, safe_name)
