from fastapi import APIRouter

from ....contracts import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return {"status": "ok", "service": "local"}
