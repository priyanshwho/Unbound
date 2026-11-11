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


class JoinPreviewRequest(BaseModel):
    left_dataset_id: str = Field(pattern=r"^[0-9a-f]{32}$")
    left_column: str = Field(min_length=1, max_length=256)
    right_dataset_id: str = Field(pattern=r"^[0-9a-f]{32}$")
    right_column: str = Field(min_length=1, max_length=256)


class JoinPreview(BaseModel):
    left_rows: int = Field(ge=0)
    right_rows: int = Field(ge=0)
    matched_left_rows: int = Field(ge=0)
    unmatched_left_rows: int = Field(ge=0)
    matched_keys: int = Field(ge=0)
    joined_rows: int = Field(ge=0)
    duplicate_left_keys: int = Field(ge=0)
    duplicate_right_keys: int = Field(ge=0)


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
