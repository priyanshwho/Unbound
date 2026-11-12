from __future__ import annotations

from typing import Any

import httpx
from fastapi import HTTPException

from ..core.config import PERSISTENCE_API_TOKEN, PERSISTENCE_API_URL


def is_configured() -> bool:
    return bool(PERSISTENCE_API_TOKEN)


async def persistence_status() -> dict[str, Any]:
    configured = is_configured()
    if not configured:
        return {"configured": False, "available": False, "detail": "Neon persistence is not configured."}
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            response = await client.get(f"{PERSISTENCE_API_URL}/health")
            response.raise_for_status()
        health = response.json()
        return {"configured": True, "available": health.get("databaseConfigured") is True, "detail": None}
    except (httpx.HTTPError, ValueError) as exc:
        return {"configured": True, "available": False, "detail": str(exc)}


async def private_request(method: str, path: str, body: dict[str, Any] | None = None) -> Any:
    if not is_configured():
        raise HTTPException(status_code=503, detail="Neon persistence is not configured yet.")
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.request(
                method,
                f"{PERSISTENCE_API_URL}{path}",
                json=body,
                headers={"x-unbound-service-token": PERSISTENCE_API_TOKEN},
            )
        if response.is_error:
            try:
                detail = response.json().get("detail")
            except ValueError:
                detail = None
            raise HTTPException(status_code=response.status_code, detail=detail or "Persistence request failed.")
        if response.status_code == 204 or not response.content:
            return None
        return response.json()
    except httpx.TimeoutException as exc:
        raise HTTPException(status_code=504, detail="Neon persistence took too long to respond.") from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="The persistence API could not be reached.") from exc


async def sync_dataset(profile: dict[str, Any]) -> None:
    if not is_configured():
        return
    body = {
        "id": profile["id"],
        "name": profile["name"],
        "rows": profile["rows"],
        "size": profile["size"],
        "columns": [{"name": column["name"], "type": column["type"]} for column in profile["columns"]],
    }
    await private_request("PUT", f"/v1/private/datasets/{profile['id']}", body)
