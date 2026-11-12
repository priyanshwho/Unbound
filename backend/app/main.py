from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .api.v1.endpoints import datasets, health

LOCAL_ORIGINS = {"http://127.0.0.1:5173", "http://localhost:5173"}
LOCAL_HOSTS = {"127.0.0.1:5173", "localhost:5173", "127.0.0.1:8000", "localhost:8000"}

app = FastAPI(
    title="Unbound local API",
    version="0.2.0",
    openapi_url="/api/v1/openapi.json",
    docs_url="/api/v1/docs",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=sorted(LOCAL_ORIGINS),
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type"],
)


@app.middleware("http")
async def restrict_local_requests(request: Request, call_next):
    host = request.headers.get("host", "").lower()
    origin = request.headers.get("origin")
    if host not in LOCAL_HOSTS or (origin is not None and origin not in LOCAL_ORIGINS):
        return JSONResponse(status_code=403, content={"detail": "This local API only accepts requests from Unbound on this device."})
    return await call_next(request)


app.include_router(health.router, prefix="/api/v1")
app.include_router(datasets.router, prefix="/api/v1")
