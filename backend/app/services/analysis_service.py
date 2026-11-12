from __future__ import annotations

import re
from typing import Any

from fastapi import HTTPException

from ..contracts import AnalysisPlan
from ..db.duckdb import _database_lock, connect_database, dataset_table, quote_identifier

NUMERIC_TYPES = ("INT", "UINT", "FLOAT", "DOUBLE", "DECIMAL", "HUGEINT", "REAL")
PERIOD_FILTERS = {
    "last_month": "{date} >= date_trunc('month', current_date - INTERVAL 1 MONTH) AND {date} < date_trunc('month', current_date)",
    "last_30_days": "{date} >= current_date - INTERVAL 30 DAY",
    "this_month": "{date} >= date_trunc('month', current_date)",
    "this_year": "{date} >= date_trunc('year', current_date)",
}


def complete_plan(plan: AnalysisPlan, question: str, columns: list[dict[str, Any]]) -> AnalysisPlan:
    if plan.aggregation not in {"sum", "average", "min", "max"} or plan.measure is not None:
        return plan
    numeric = [item["name"] for item in columns if any(token in item["type"].upper() for token in NUMERIC_TYPES)]
    terms = set(re.findall(r"[a-z0-9]+", question.lower()))
    mentioned = [name for name in numeric if set(re.findall(r"[a-z0-9]+", name.lower())) & terms]
    candidates = mentioned if len(mentioned) == 1 else numeric if len(numeric) == 1 else []
    if not candidates:
        raise HTTPException(status_code=422, detail="I couldn't identify one numeric measure. Please name the column to calculate.")
    return plan.model_copy(update={"measure": candidates[0]})


def run_analysis(dataset_id: str, plan: AnalysisPlan) -> list[dict[str, Any]]:
    with _database_lock:
        connection = connect_database()
        try:
            metadata = connection.execute(
                "SELECT columns_json FROM unbound_datasets WHERE id = ?", [dataset_id]
            ).fetchone()
            if not metadata:
                raise HTTPException(status_code=404, detail="Dataset not found")
            import json

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
            if plan.date_column and not any(token in column_types[plan.date_column] for token in ("DATE", "TIME")):
                raise HTTPException(status_code=422, detail="The selected date field is not typed as a date")
            if plan.aggregation in {"sum", "average", "min", "max"}:
                if plan.measure is None:
                    raise HTTPException(status_code=422, detail="Choose a numeric measure for this calculation")
                if not any(token in column_types[plan.measure] for token in NUMERIC_TYPES):
                    raise HTTPException(status_code=422, detail="This calculation requires a numeric column")

            aggregations = {"sum": "SUM", "average": "AVG", "count": "COUNT", "min": "MIN", "max": "MAX"}
            measure = "*" if plan.measure is None else quote_identifier(plan.measure)
            aggregate = f"{aggregations[plan.aggregation]}({measure})"
            where = ""
            if plan.period != "all_time":
                date = f"TRY_CAST({quote_identifier(plan.date_column or '')} AS TIMESTAMP)"
                where = " WHERE " + PERIOD_FILTERS[plan.period].format(date=date)

            group_expr = None
            if plan.group_by is not None:
                if plan.date_column == plan.group_by and plan.date_grain:
                    group_expr = f"CAST(date_trunc('{plan.date_grain}', TRY_CAST({quote_identifier(plan.group_by)} AS TIMESTAMP)) AS VARCHAR)"
                else:
                    group_expr = f"CAST({quote_identifier(plan.group_by)} AS VARCHAR)"
            if group_expr:
                order_by = "category ASC NULLS LAST" if plan.date_column == plan.group_by else "value DESC NULLS LAST"
                sql = f"SELECT {group_expr} AS category, {aggregate} AS value FROM {table}{where} GROUP BY 1 ORDER BY {order_by} LIMIT 100"
            else:
                sql = f"SELECT {aggregate} AS value FROM {table}{where}"
            result = connection.execute(sql).fetchall()
            names = [item[0] for item in connection.description]
            return [dict(zip(names, row)) for row in result]
        finally:
            connection.close()


def format_answer(plan: AnalysisPlan, rows: list[dict[str, Any]]) -> str:
    if not rows or rows[0].get("value") is None:
        return "I couldn't find matching values for that question in this dataset."
    first = rows[0]
    value = first["value"]
    if isinstance(value, float):
        rendered = f"{value:,.2f}".rstrip("0").rstrip(".")
    elif isinstance(value, int):
        rendered = f"{value:,}"
    else:
        rendered = str(value)
    if "category" in first:
        return f"{first['category']} is the top group, with {rendered} for {plan.title.lower()}."
    return f"{plan.aggregation.capitalize()} result for {plan.title.lower()} is {rendered}."
