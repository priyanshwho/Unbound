from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


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
    model_config = ConfigDict(extra="forbid")

    measure: str | None = None
    group_by: str | None = None
    aggregation: Literal["sum", "average", "count", "min", "max"]
    date_column: str | None = None
    period: Literal["all_time", "last_month", "last_30_days", "this_month", "this_year"] = "all_time"
    date_grain: Literal["day", "month", "year"] | None = None
    chart_type: Literal["line", "bar", "horizontal_bar", "pie", "table"] = "bar"
    title: str = Field(min_length=1, max_length=120)


class AnalysisRequest(BaseModel):
    dataset_id: str = Field(pattern=r"^[0-9a-f]{32}$")
    question: str = Field(min_length=3, max_length=1000)


class AnalysisResponse(BaseModel):
    dataset_id: str
    answer: str
    plan: AnalysisPlan
    rows: list[dict[str, Any]]


class OllamaStatus(BaseModel):
    available: bool
    model: str
    models: list[str] = Field(default_factory=list)
    detail: str | None = None


class ConversationCreate(BaseModel):
    id: str = Field(min_length=36, max_length=36)
    title: str = Field(min_length=1, max_length=180)


class ConversationMessageCreate(BaseModel):
    id: str = Field(min_length=36, max_length=36)
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=20_000)
    result: dict[str, Any] | None = None


class DashboardSave(BaseModel):
    id: str = Field(min_length=36, max_length=36)
    title: str = Field(min_length=1, max_length=180)
    spec: dict[str, Any]


class PublicationCreate(BaseModel):
    share_id: str = Field(min_length=36, max_length=36)
    dashboard_id: str = Field(min_length=36, max_length=36)
    revision: int = Field(ge=1)
    visibility: Literal["public", "unlisted"]
    snapshot: dict[str, Any]
    expires_at: str | None = None


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
