from __future__ import annotations

import re
from typing import Any

from fastapi import APIRouter, HTTPException

from ....contracts import ConversationCreate, ConversationMessageCreate, DashboardSave, PublicationCreate
from ....services.persistence_client import persistence_status, private_request

router = APIRouter()
UUID_PATTERN = re.compile(r"^[0-9a-fA-F-]{36}$")


@router.get("/persistence/status")
async def get_persistence_status() -> dict[str, Any]:
    return await persistence_status()


@router.get("/conversations")
async def get_conversations() -> Any:
    return await private_request("GET", "/v1/private/conversations")


@router.post("/conversations", status_code=201)
async def create_conversation(request: ConversationCreate) -> Any:
    return await private_request("POST", "/v1/private/conversations", request.model_dump())


@router.get("/conversations/{conversation_id}")
async def get_conversation(conversation_id: str) -> Any:
    if not UUID_PATTERN.fullmatch(conversation_id):
        raise HTTPException(status_code=404, detail="Conversation not found")
    return await private_request("GET", f"/v1/private/conversations/{conversation_id}")


@router.post("/conversations/{conversation_id}/messages", status_code=201)
async def add_conversation_message(conversation_id: str, request: ConversationMessageCreate) -> Any:
    if not UUID_PATTERN.fullmatch(conversation_id):
        raise HTTPException(status_code=404, detail="Conversation not found")
    return await private_request("POST", f"/v1/private/conversations/{conversation_id}/messages", request.model_dump())


@router.delete("/conversations/{conversation_id}")
async def remove_conversation(conversation_id: str) -> Any:
    if not UUID_PATTERN.fullmatch(conversation_id):
        raise HTTPException(status_code=404, detail="Conversation not found")
    return await private_request("DELETE", f"/v1/private/conversations/{conversation_id}")


@router.get("/dashboards")
async def get_dashboards() -> Any:
    return await private_request("GET", "/v1/private/dashboards")


@router.get("/dashboards/{dashboard_id}")
async def get_dashboard(dashboard_id: str) -> Any:
    if not UUID_PATTERN.fullmatch(dashboard_id):
        raise HTTPException(status_code=404, detail="Dashboard not found")
    return await private_request("GET", f"/v1/private/dashboards/{dashboard_id}")


@router.put("/dashboards/{dashboard_id}")
async def save_dashboard(dashboard_id: str, request: DashboardSave) -> Any:
    if not UUID_PATTERN.fullmatch(dashboard_id) or request.id != dashboard_id:
        raise HTTPException(status_code=422, detail="Dashboard identifiers do not match")
    return await private_request("PUT", f"/v1/private/dashboards/{dashboard_id}", request.model_dump())


@router.post("/publications", status_code=201)
async def create_publication(request: PublicationCreate) -> Any:
    return await private_request("POST", "/v1/private/publications", {
        "shareId": request.share_id,
        "dashboardId": request.dashboard_id,
        "revision": request.revision,
        "visibility": request.visibility,
        "snapshot": request.snapshot,
        "expiresAt": request.expires_at,
    })


@router.delete("/publications/{share_id}")
async def revoke_publication(share_id: str) -> Any:
    if not UUID_PATTERN.fullmatch(share_id):
        raise HTTPException(status_code=404, detail="Publication not found")
    return await private_request("DELETE", f"/v1/private/publications/{share_id}")


@router.get("/share/{share_id}")
async def get_publication(share_id: str) -> Any:
    if not UUID_PATTERN.fullmatch(share_id):
        raise HTTPException(status_code=404, detail="Shared dashboard not found")
    return await private_request("GET", f"/v1/share/{share_id}")
