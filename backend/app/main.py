from __future__ import annotations

import os
import re
import uuid
from pathlib import Path
from typing import Any

import duckdb
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from .contracts import DatasetProfile, HealthResponse, JoinPreview, JoinPreviewRequest

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
    allow_methods=["GET", "POST", "DELETE"],
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


@app.delete("/api/v1/datasets/{dataset_id}")
def delete_dataset(dataset_id: str) -> dict[str, bool]:
    if not re.fullmatch(r"[0-9a-f]{32}", dataset_id):
        raise HTTPException(status_code=404, detail="Dataset not found")
    path = UPLOAD_DIR / (dataset_id + ".csv")
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Dataset not found")
    path.unlink()
    return {"deleted": True}


@app.post("/api/v1/datasets/join-preview", response_model=JoinPreview)
def preview_join(request: JoinPreviewRequest) -> dict[str, int]:
    left_path = UPLOAD_DIR / (request.left_dataset_id + ".csv")
    right_path = UPLOAD_DIR / (request.right_dataset_id + ".csv")
    if request.left_dataset_id == request.right_dataset_id:
        raise HTTPException(status_code=422, detail="Choose two different datasets")
    if not left_path.is_file() or not right_path.is_file():
        raise HTTPException(status_code=404, detail="One of the selected files is no longer available")

    connection = duckdb.connect(database=":memory:")
    left_source = "read_csv_auto(?, header=true, all_varchar=true, sample_size=10000)"
    right_source = "read_csv_auto(?, header=true, all_varchar=true, sample_size=10000)"
    try:
        left_columns = {str(row[0]) for row in connection.execute("DESCRIBE SELECT * FROM " + left_source, [str(left_path)]).fetchall()}
        right_columns = {str(row[0]) for row in connection.execute("DESCRIBE SELECT * FROM " + right_source, [str(right_path)]).fetchall()}
        if request.left_column not in left_columns or request.right_column not in right_columns:
            raise HTTPException(status_code=422, detail="Choose a column that exists in each selected file")

        left_rows = int(connection.execute("SELECT COUNT(*) FROM " + left_source, [str(left_path)]).fetchone()[0])
        right_rows = int(connection.execute("SELECT COUNT(*) FROM " + right_source, [str(right_path)]).fetchone()[0])
        left_key = quote_identifier(request.left_column)
        right_key = quote_identifier(request.right_column)
        query = f"""
            WITH left_keys AS (
                SELECT CAST({left_key} AS VARCHAR) AS join_key, COUNT(*) AS row_count
                FROM {left_source} WHERE {left_key} IS NOT NULL GROUP BY 1
            ), right_keys AS (
                SELECT CAST({right_key} AS VARCHAR) AS join_key, COUNT(*) AS row_count
                FROM {right_source} WHERE {right_key} IS NOT NULL GROUP BY 1
            )
            SELECT COUNT(*) AS matched_keys,
                   COALESCE(SUM(left_keys.row_count), 0) AS matched_left_rows,
                   COALESCE(SUM(left_keys.row_count * right_keys.row_count), 0) AS joined_rows,
                   COUNT(*) FILTER (WHERE left_keys.row_count > 1) AS duplicate_left_keys,
                   COUNT(*) FILTER (WHERE right_keys.row_count > 1) AS duplicate_right_keys
            FROM left_keys INNER JOIN right_keys USING (join_key)
        """
        values = connection.execute(query, [str(left_path), str(right_path)]).fetchone()
        matched_keys, matched_left_rows, joined_rows, duplicate_left, duplicate_right = map(int, values)
        return {
            "left_rows": left_rows,
            "right_rows": right_rows,
            "matched_left_rows": matched_left_rows,
            "unmatched_left_rows": left_rows - matched_left_rows,
            "matched_keys": matched_keys,
            "joined_rows": joined_rows,
            "duplicate_left_keys": duplicate_left,
            "duplicate_right_keys": duplicate_right,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Could not preview this join. Check the selected columns and CSV files.") from exc
    finally:
        connection.close()
