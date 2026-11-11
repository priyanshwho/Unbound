from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: Literal["ok"]
    service: Literal["local"]


class ColumnProfile(BaseModel):
    name: str
    type: str
    nulls: int = Field(ge=0)
    distinct: int = Field(ge=0)
    samples: list[str] = Field(default_factory=list, max_length=5)


class DatasetProfile(BaseModel):
    id: str
    name: str
    rows: int = Field(ge=0)
    columns: list[ColumnProfile]
    size: int = Field(ge=0)


class AnalysisPlan(BaseModel):
    measure: str | None = None
    group_by: str | None = None
    aggregation: Literal["sum", "average", "count", "min", "max"] = "count"
    granularity: Literal["month", "year", "day"] | None = None
    chart_type: Literal["line", "bar"] = "bar"
    title: str = "Analysis"


class ChartSpec(BaseModel):
    title: str
    chart_type: Literal["line", "bar"]
    x_key: str
    y_key: str
    data: list[dict[str, Any]]


class DashboardSpec(BaseModel):
    id: str
    title: str
    version: int = Field(ge=1)
    charts: list[ChartSpec]


class PublicationSpec(BaseModel):
    dashboard_id: str
    version: int = Field(ge=1)
    visibility: Literal["public", "unlisted", "private"]
    expires_at: str | None = None
    charts: list[ChartSpec]
