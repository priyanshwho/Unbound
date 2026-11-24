from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException
from starlette.concurrency import run_in_threadpool

from ....contracts import AnalysisPlan, AnalysisRequest, AnalysisResponse, DashboardGenerateRequest, GeneratedDashboard, OllamaStatus
from ....services.analysis_service import complete_plan, execute_analysis, format_answer
from ....services.dataset_service import list_datasets
from ....services.ollama_client import get_status, propose_plan

router = APIRouter()


def _dashboard_result(dataset_id: str, plan: AnalysisPlan, issues: list[dict]) -> dict:
    rows, sql, parameters = execute_analysis(dataset_id, plan)
    used_columns = {plan.measure, plan.group_by, plan.date_column} | {item.column for item in plan.filters}
    relevant_issues = [issue for issue in issues if issue.get("kind") == "duplicate_rows" or issue.get("column") in used_columns]
    return {"dataset_id": dataset_id, "answer": format_answer(plan, rows), "plan": plan, "rows": rows, "sql": sql, "parameters": parameters, "quality_issues": relevant_issues}


@router.get("/ollama/status", response_model=OllamaStatus)
async def ollama_status() -> dict:
    return await get_status()


@router.post("/analysis/ask", response_model=AnalysisResponse)
async def ask_question(request: AnalysisRequest) -> dict:
    datasets = await run_in_threadpool(list_datasets)
    dataset = next((item for item in datasets if item["id"] == request.dataset_id), None)
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    plan = await propose_plan(request.question, dataset["columns"], request.context)
    plan = complete_plan(plan, request.question, dataset["columns"])
    return await run_in_threadpool(_dashboard_result, request.dataset_id, plan, dataset.get("quality_issues", []))


@router.post("/analysis/dashboard", response_model=GeneratedDashboard)
def generate_dashboard(request: DashboardGenerateRequest) -> dict:
    datasets = list_datasets()
    dataset = next((item for item in datasets if item["id"] == request.dataset_id), None)
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    columns = dataset["columns"]
    numeric = [item["name"] for item in columns if any(token in item["type"].upper() for token in ("INT", "FLOAT", "DOUBLE", "DECIMAL", "REAL"))]
    date = next((item["name"] for item in columns if any(token in item["type"].upper() for token in ("DATE", "TIME"))), None)
    measure = next((name for word in ("sales", "revenue", "amount", "profit") for name in numeric if word in name.lower() and "id" not in name.lower()), None)
    measure = measure or next((name for name in numeric if "id" not in name.lower() and "year" not in name.lower()), None)
    categories = [item for item in columns if item["name"] != date and not any(token in item["type"].upper() for token in ("INT", "FLOAT", "DOUBLE", "DECIMAL", "REAL")) and "id" not in item["name"].lower() and 2 <= item["distinct"] <= 100]
    kpis = [
        _dashboard_result(request.dataset_id, AnalysisPlan(measure=measure, aggregation="sum" if measure else "count", title=f"Total {measure}" if measure else "Rows analyzed"), dataset.get("quality_issues", [])),
    ]
    if measure:
        kpis.append(_dashboard_result(request.dataset_id, AnalysisPlan(measure=None, aggregation="count", title="Rows analyzed"), dataset.get("quality_issues", [])))
        kpis.append(_dashboard_result(request.dataset_id, AnalysisPlan(measure=measure, aggregation="average", title=f"Average {measure}"), dataset.get("quality_issues", [])))
    charts = []
    if date and measure:
        charts.append(_dashboard_result(request.dataset_id, AnalysisPlan(measure=measure, group_by=date, aggregation="sum", date_column=date, date_grain="month", chart_type="line", title=f"Monthly {measure}"), dataset.get("quality_issues", [])))
    used_categories: set[str] = set()
    for terms in (("product", "sku", "item"), ("category", "department", "brand"), ("store", "region", "city", "channel")):
        category = next((item["name"] for word in terms for item in categories if word in item["name"].lower() and item["name"] not in used_categories), None)
        if category and measure:
            used_categories.add(category)
            charts.append(_dashboard_result(request.dataset_id, AnalysisPlan(measure=measure, group_by=category, aggregation="sum", chart_type="horizontal_bar", title=f"{measure} by {category}"), dataset.get("quality_issues", [])))
    if measure and not charts:
        category = categories[0]["name"] if categories else None
        if category:
            charts.append(_dashboard_result(request.dataset_id, AnalysisPlan(measure=measure, group_by=category, aggregation="sum", chart_type="horizontal_bar", title=f"{measure} by {category}"), dataset.get("quality_issues", [])))
    return {"dataset_id": request.dataset_id, "title": f"{Path(dataset['name']).stem} overview", "kpis": kpis, "charts": charts}
