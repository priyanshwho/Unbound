from __future__ import annotations

import re
import uuid
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile

from ....contracts import DatasetProfile, JoinPreview, JoinPreviewRequest
from ....core.config import MAX_UPLOAD_BYTES, UPLOAD_DIR
from ....services.dataset_service import (
    DatasetLimitError,
    DatasetNotFoundError,
    delete_dataset,
    list_datasets,
    preview_join,
    profile_csv,
)

router = APIRouter(prefix="/datasets")


@router.get("", response_model=list[DatasetProfile])
def get_datasets() -> list[dict]:
    return list_datasets()


@router.post("/upload", response_model=DatasetProfile)
async def upload_csv(file: UploadFile = File(...)) -> dict:
    if not file.filename or Path(file.filename).suffix.lower() != ".csv":
        raise HTTPException(status_code=400, detail="Choose a .csv file")
    content = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="CSV files must be 50 MB or smaller")
    if not content:
        raise HTTPException(status_code=400, detail="The selected CSV is empty")

    dataset_id = uuid.uuid4().hex
    path = UPLOAD_DIR / f"{dataset_id}.csv"
    path.write_bytes(content)
    safe_name = re.sub(r"[\\/\x00-\x1f]", "_", Path(file.filename).name)[:180]
    try:
        return profile_csv(path, dataset_id, safe_name)
    except DatasetLimitError as exc:
        path.unlink(missing_ok=True)
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except Exception as exc:
        path.unlink(missing_ok=True)
        if isinstance(exc, HTTPException):
            raise
        raise HTTPException(status_code=400, detail="Could not read this CSV. Check its format and column headers.") from exc


@router.delete("/{dataset_id}")
def remove_dataset(dataset_id: str) -> dict[str, bool]:
    if not re.fullmatch(r"[0-9a-f]{32}", dataset_id):
        raise HTTPException(status_code=404, detail="Dataset not found")
    try:
        delete_dataset(dataset_id)
    except DatasetNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Dataset not found") from exc
    return {"deleted": True}


@router.post("/join-preview", response_model=JoinPreview)
def get_join_preview(request: JoinPreviewRequest) -> dict[str, int]:
    try:
        return preview_join(request.left_dataset_id, request.left_column, request.right_dataset_id, request.right_column)
    except DatasetNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Could not preview this join. Check the selected columns and CSV files.") from exc
