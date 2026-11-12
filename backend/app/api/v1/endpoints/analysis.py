from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ....contracts import AnalysisRequest, AnalysisResponse, OllamaStatus
from ....services.analysis_service import complete_plan, format_answer, run_analysis
from ....services.dataset_service import list_datasets
from ....services.ollama_client import get_status, propose_plan

router = APIRouter()


@router.get("/ollama/status", response_model=OllamaStatus)
async def ollama_status() -> dict:
    return await get_status()


@router.post("/analysis/ask", response_model=AnalysisResponse)
async def ask_question(request: AnalysisRequest) -> dict:
    dataset = next((item for item in list_datasets() if item["id"] == request.dataset_id), None)
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    plan = await propose_plan(request.question, dataset["columns"])
    plan = complete_plan(plan, request.question, dataset["columns"])
    rows = run_analysis(request.dataset_id, plan)
    relevant_issues = [
        issue for issue in dataset.get("quality_issues", [])
        if issue.get("kind") == "duplicate_rows"
        or issue.get("column") in {plan.measure, plan.group_by, plan.date_column}
    ]
    return {
        "dataset_id": request.dataset_id,
        "answer": format_answer(plan, rows),
        "plan": plan,
        "rows": rows,
        "quality_issues": relevant_issues,
    }
