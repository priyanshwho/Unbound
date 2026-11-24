from __future__ import annotations

import json
import re
from typing import Any

from fastapi import HTTPException

from ..contracts import AnalysisPlan
from ..db.duckdb import _database_lock, connect_analysis_database, dataset_table, quote_identifier
from ..db import duckdb as storage

NUMERIC_TYPES = ("INT", "UINT", "FLOAT", "DOUBLE", "DECIMAL", "HUGEINT", "REAL")
PERIOD_FILTERS = {
    "last_month": "{date} >= date_trunc('month', current_date - INTERVAL 1 MONTH) AND {date} < date_trunc('month', current_date)",
    "last_30_days": "{date} >= current_date - INTERVAL 30 DAY",
    "this_month": "{date} >= date_trunc('month', current_date)",
    "this_year": "{date} >= date_trunc('year', current_date)",
}


def complete_plan(plan: AnalysisPlan, question: str, columns: list[dict[str, Any]]) -> AnalysisPlan:
    terms = set(re.findall(r"[a-z0-9]+", question.lower()))
    if plan.aggregation in {"sum", "average", "min", "max"} and plan.measure is None:
        numeric = [item["name"] for item in columns if any(token in item["type"].upper() for token in NUMERIC_TYPES)]
        mentioned = [name for name in numeric if set(re.findall(r"[a-z0-9]+", name.lower())) & terms]
        candidates = mentioned if len(mentioned) == 1 else numeric if len(numeric) == 1 else []
        if not candidates:
            raise HTTPException(status_code=422, detail="I couldn't identify one numeric measure. Please name the column to calculate.")
        plan = plan.model_copy(update={"measure": candidates[0]})

    if plan.date_column and plan.date_grain and plan.group_by in {None, plan.date_column}:
        update = {"group_by": plan.date_column}
        if not terms.intersection({"bar", "table", "pie", "column"}):
            update["chart_type"] = "line"
        label = f"{plan.aggregation.capitalize()} of {plan.measure}" if plan.measure else "Row count"
        update["title"] = f"{label} by {plan.date_grain}"[:120]
        plan = plan.model_copy(update=update)
    return plan


def execute_analysis(dataset_id: str, plan: AnalysisPlan) -> tuple[list[dict[str, Any]], str, list[str]]:
    if plan.aggregation == "unsupported":
        raise HTTPException(status_code=422, detail=plan.unsupported_reason or "Please ask for a supported summary of the CSV.")

    with _database_lock:
        if not storage.DUCKDB_PATH.is_file():
            raise HTTPException(status_code=404, detail="Dataset not found")
        connection = connect_analysis_database()
        try:
            metadata = connection.execute(
                "SELECT columns_json FROM unbound_datasets WHERE id = ?", [dataset_id]
            ).fetchone()
            if not metadata:
                raise HTTPException(status_code=404, detail="Dataset not found")
            columns = json.loads(metadata[0])
            column_types = {item["name"]: item["type"].upper() for item in columns}
            table = dataset_table(dataset_id)
            if plan.measure is not None and plan.measure not in column_types:
                raise HTTPException(status_code=422, detail="The proposed measure is not in this dataset")
            if plan.group_by is not None and plan.group_by not in column_types:
                raise HTTPException(status_code=422, detail="The proposed category is not in this dataset")
            if plan.date_column is not None and plan.date_column not in column_types:
                raise HTTPException(status_code=422, detail="The proposed date field is not in this dataset")
            if plan.period != "all_time" and not plan.date_column:
                raise HTTPException(status_code=422, detail="A date column is required for this time period")
            if plan.date_column and not column_types[plan.date_column].startswith(("DATE", "TIMESTAMP")):
                raise HTTPException(status_code=422, detail="The selected date field is not typed as a date")
            if plan.aggregation in {"sum", "average", "min", "max"}:
                if plan.measure is None:
                    raise HTTPException(status_code=422, detail="Choose a numeric measure for this calculation")
                if not any(token in column_types[plan.measure] for token in NUMERIC_TYPES):
                    raise HTTPException(status_code=422, detail="This calculation requires a numeric column")

            aggregations = {"sum": "SUM", "average": "AVG", "count": "COUNT", "min": "MIN", "max": "MAX"}
            measure = "*" if plan.measure is None else quote_identifier(plan.measure)
            aggregate = f"{aggregations[plan.aggregation]}({measure})"
            conditions = []
            parameters = []
            for item in plan.filters:
                if item.column not in column_types:
                    raise HTTPException(status_code=422, detail="A proposed filter column is not in this dataset")
                conditions.append(f"CAST({quote_identifier(item.column)} AS VARCHAR) = ?")
                parameters.append(item.value)
            if plan.period != "all_time":
                date = f"TRY_CAST({quote_identifier(plan.date_column or '')} AS TIMESTAMP)"
                conditions.append(PERIOD_FILTERS[plan.period].format(date=date))
            where = " WHERE " + " AND ".join(conditions) if conditions else ""

            group_expr = None
            if plan.group_by is not None:
                if plan.date_column == plan.group_by and plan.date_grain:
                    label = {"day": "%Y-%m-%d", "month": "%Y-%m", "year": "%Y"}[plan.date_grain]
                    group_expr = f"strftime(TRY_CAST({quote_identifier(plan.group_by)} AS TIMESTAMP), '{label}')"
                else:
                    group_expr = f"CAST({quote_identifier(plan.group_by)} AS VARCHAR)"
            if group_expr:
                order_by = "category ASC NULLS LAST" if plan.date_column == plan.group_by else "value DESC NULLS LAST, category ASC NULLS LAST"
                sql = f"SELECT {group_expr} AS category, {aggregate} AS value FROM {table}{where} GROUP BY 1 ORDER BY {order_by} LIMIT 100"
            else:
                sql = f"SELECT {aggregate} AS value FROM {table}{where}"
            result = connection.execute(sql, parameters).fetchall()
            names = [item[0] for item in connection.description]
            return [dict(zip(names, row)) for row in result], sql, parameters
        finally:
            connection.close()


def run_analysis(dataset_id: str, plan: AnalysisPlan) -> list[dict[str, Any]]:
    rows, _, _ = execute_analysis(dataset_id, plan)
    return rows


def format_answer(plan: AnalysisPlan, rows: list[dict[str, Any]]) -> str:
    valid = [row for row in rows if row.get("value") is not None]
    if not valid:
        return "I couldn't find matching values for that question in this dataset."
    first = valid[0]
    if plan.group_by:
        first = max(valid, key=lambda row: row["value"])
    value = first["value"]
    if isinstance(value, float):
        rendered = f"{value:,.2f}".rstrip("0").rstrip(".")
    elif isinstance(value, int):
        rendered = f"{value:,}"
    else:
        rendered = str(value)
    if plan.group_by:
        group = first["category"] if first["category"] is not None else "(missing group)"
        return f"The highest value shown is {rendered} for {group}. The result contains {len(rows)} groups."
    return f"{plan.aggregation.capitalize()} result for {plan.title.lower()} is {rendered}."
