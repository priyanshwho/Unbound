from __future__ import annotations

import json
import os
import re
import uuid
from pathlib import Path
from typing import Any
from urllib.error import URLError
from urllib.request import Request, urlopen

import duckdb
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = Path(os.getenv("DASHTIDE_DATA_DIR", str(ROOT / "data")))
UPLOAD_DIR = DATA_DIR / "datasets"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "gemma3:4b")
MAX_UPLOAD = 50 * 1024 * 1024

app = FastAPI(title="Unbound Local API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


class ChatRequest(BaseModel):
    dataset_id: str
    question: str = Field(min_length=1, max_length=1000)


def db_for(path: Path) -> duckdb.DuckDBPyConnection:
    con = duckdb.connect(database=":memory:")
    # read_csv_auto receives a bound parameter. It never interprets uploaded values as SQL.
    con.execute("CREATE VIEW uploaded AS SELECT * FROM read_csv_auto(?, header=true, sample_size=-1)", [str(path)])
    return con


def dataset_path(dataset_id: str) -> Path:
    if not re.fullmatch(r"[0-9a-f]{32}", dataset_id):
        raise HTTPException(404, "Dataset not found")
    path = UPLOAD_DIR / f"{dataset_id}.csv"
    if not path.is_file():
        raise HTTPException(404, "Dataset not found")
    return path


def profile(path: Path, dataset_id: str) -> dict[str, Any]:
    try:
        con = db_for(path)
        rows = int(con.execute("SELECT COUNT(*) FROM uploaded").fetchone()[0])
        desc = con.execute("DESCRIBE uploaded").fetchall()
        columns: list[dict[str, Any]] = []
        for name, dtype, *_ in desc:
            qname = '"' + str(name).replace('"', '""') + '"'
            nulls, distinct = con.execute(f"SELECT COUNT(*) FILTER (WHERE {qname} IS NULL), COUNT(DISTINCT {qname}) FROM uploaded").fetchone()
            columns.append({"name": str(name), "type": str(dtype), "nulls": int(nulls), "distinct": int(distinct)})
        con.close()
        return {"id": dataset_id, "name": path.name.removesuffix(f"-{dataset_id}.csv"), "rows": rows, "columns": columns, "size": path.stat().st_size}
    except Exception as exc:
        raise HTTPException(400, f"Could not read CSV: {exc}") from exc


def ollama_plan(question: str, columns: list[dict[str, Any]]) -> dict[str, Any]:
    schema = [{"name": c["name"], "type": c["type"], "distinct": c["distinct"]} for c in columns]
    prompt = f"""Choose a simple analysis plan for a CSV question. Return ONLY JSON with keys: measure (column name or null), group_by (column name or null), aggregation (sum, average, count, min, max), granularity (month, year, day, or null), chart_type (line or bar), title (short string), answer_hint (short string). Use only exact column names in this schema. Never invent columns. If unclear, choose the most relevant numeric column and explain your interpretation in answer_hint.\nSCHEMA: {json.dumps(schema, ensure_ascii=False)}\nQUESTION: {question}"""
    body = json.dumps({"model": OLLAMA_MODEL, "stream": False, "format": "json", "options": {"temperature": 0}, "messages": [{"role": "user", "content": prompt}]}).encode()
    request = Request(f"{OLLAMA_URL}/api/chat", data=body, headers={"Content-Type": "application/json"})
    try:
        with urlopen(request, timeout=90) as response:
            result = json.loads(response.read())
        plan = json.loads(result["message"]["content"])
    except (URLError, TimeoutError) as exc:
        raise HTTPException(503, "Ollama is not reachable. Keep `ollama serve` running and retry.") from exc
    except (KeyError, ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(502, "The local model returned an invalid analysis plan. Please rephrase the question.") from exc
    allowed = {c["name"] for c in columns}
    if plan.get("measure") not in allowed:
        plan["measure"] = None
    if plan.get("group_by") not in allowed:
        plan["group_by"] = None
    if plan.get("aggregation") not in {"sum", "average", "count", "min", "max"}:
        plan["aggregation"] = "count" if plan.get("measure") is None else "sum"
    if plan.get("granularity") not in {"month", "year", "day", None}:
        plan["granularity"] = None
    if plan.get("chart_type") not in {"line", "bar"}:
        plan["chart_type"] = "bar"
    return plan


def run_plan(path: Path, plan: dict[str, Any]) -> tuple[list[dict[str, Any]], str, str]:
    group = plan.get("group_by")
    measure = plan.get("measure")
    agg = plan["aggregation"]
    qgroup = '"' + group.replace('"', '""') + '"' if group else None
    qmeasure = '"' + measure.replace('"', '""') + '"' if measure else None
    xkey = "group" if group else "result"
    ykey = "value"
    if not measure or agg == "count":
        expr = "COUNT(*)"
    else:
        op = {"sum": "SUM", "average": "AVG", "min": "MIN", "max": "MAX"}[agg]
        expr = f"{op}(TRY_CAST({qmeasure} AS DOUBLE))"
    if group:
        if plan.get("granularity") and re.search(r"date|time", group, re.I):
            unit = plan["granularity"]
            group_expr = f"STRFTIME(TRY_CAST({qgroup} AS TIMESTAMP), '%Y-%m' )" if unit == "month" else (f"STRFTIME(TRY_CAST({qgroup} AS TIMESTAMP), '%Y')" if unit == "year" else f"STRFTIME(TRY_CAST({qgroup} AS TIMESTAMP), '%Y-%m-%d')")
        else:
            group_expr = f"CAST({qgroup} AS VARCHAR)"
        sql = f"SELECT {group_expr} AS group, {expr} AS value FROM read_csv_auto(?, header=true, sample_size=-1) GROUP BY group HAVING group IS NOT NULL ORDER BY value DESC LIMIT 100"
        try:
            con = duckdb.connect(database=":memory:")
            rows = con.execute(sql, [str(path)]).fetchall()
            con.close()
        except Exception as exc:
            raise HTTPException(400, f"Could not calculate that result: {exc}") from exc
        data = [{xkey: str(x), ykey: float(y or 0)} for x, y in rows]
        if plan.get("granularity") and re.search(r"date|time", group, re.I):
            data.reverse()
    else:
        sql = f"SELECT {expr} FROM read_csv_auto(?, header=true, sample_size=-1)"
        con = duckdb.connect(database=":memory:")
        value = con.execute(sql, [str(path)]).fetchone()[0]
        con.close()
        data = [{xkey: "All rows", ykey: float(value or 0)}]
    return data, xkey, ykey


@app.get("/api/health")
def health() -> dict[str, str]:
    try:
        req = Request(f"{OLLAMA_URL}/api/version")
        with urlopen(req, timeout=2) as response:
            ollama = "connected" if response.status == 200 else "offline"
    except Exception:
        ollama = "offline"
    return {"status": "ok", "ollama": ollama, "model": OLLAMA_MODEL}


@app.post("/api/datasets/upload")
async def upload_csv(file: UploadFile = File(...)) -> dict[str, Any]:
    if not file.filename or Path(file.filename).suffix.lower() != ".csv":
        raise HTTPException(400, "Choose a .csv file")
    content = await file.read(MAX_UPLOAD + 1)
    if len(content) > MAX_UPLOAD:
        raise HTTPException(413, "CSV files must be 50 MB or smaller")
    if not content:
        raise HTTPException(400, "The selected CSV is empty")
    dataset_id = uuid.uuid4().hex
    safe_stem = re.sub(r"[^A-Za-z0-9._-]+", "_", Path(file.filename).stem).strip("._-") or "dataset"
    path = UPLOAD_DIR / f"{safe_stem}-{dataset_id}.csv"
    path.write_bytes(content)
    result = profile(path, dataset_id)
    result["name"] = Path(file.filename).name
    return result


@app.post("/api/chat")
def chat(payload: ChatRequest) -> dict[str, Any]:
    path = dataset_path(payload.dataset_id)
    meta = profile(path, payload.dataset_id)
    plan = ollama_plan(payload.question, meta["columns"])
    data, xkey, ykey = run_plan(path, plan)
    best = max(data, key=lambda row: row[ykey]) if data else None
    metric = plan.get("measure") or "rows"
    aggregation = {"sum": "total", "average": "average", "count": "count", "min": "minimum", "max": "maximum"}[plan["aggregation"]]
    if plan.get("group_by") and best:
        answer = f"{plan.get('title') or 'Analysis'}: the highest {aggregation} {metric} is {best[xkey]} ({best[ykey]:,.2f}). I grouped by {plan['group_by']}" + (f" by {plan['granularity']}" if plan.get("granularity") else "") + "."
    elif best:
        answer = f"The {aggregation} {metric} is {best[ykey]:,.2f}."
    else:
        answer = "I couldn't find matching values for that question. Try another measure or grouping."
    if plan.get("answer_hint"):
        answer += f" Interpretation: {str(plan['answer_hint'])[:240]}"
    return {"answer": answer, "chart": {"title": plan.get("title") or "Result", "chart_type": plan["chart_type"], "x_key": xkey, "y_key": ykey, "data": data}, "plan": plan}


@app.get("/api/dashboard/{dataset_id}")
def dashboard(dataset_id: str) -> dict[str, Any]:
    path = dataset_path(dataset_id)
    meta = profile(path, dataset_id)
    numeric = [c for c in meta["columns"] if any(t in c["type"].upper() for t in ("INT", "DOUBLE", "FLOAT", "DECIMAL", "HUGEINT", "BIGINT"))]
    dates = [c for c in meta["columns"] if re.search(r"date|time", c["name"], re.I) or "DATE" in c["type"].upper()]
    textcols = [c for c in meta["columns"] if c not in numeric and c not in dates and 1 < c["distinct"] <= 30]
    kpis = [{"label": "ROWS ANALYZED", "value": f"{meta['rows']:,}", "hint": "Records in this file"}, {"label": "COLUMNS", "value": str(len(meta["columns"])), "hint": "Detected fields"}, {"label": "NUMERIC FIELDS", "value": str(len(numeric)), "hint": "Potential measures"}, {"label": "DATA COMPLETENESS", "value": f"{100 - (sum(c['nulls'] for c in meta['columns']) / max(1, meta['rows'] * len(meta['columns'])) * 100):.1f}%", "hint": "Non-empty cells"}]
    charts: list[dict[str, Any]] = []
    con = duckdb.connect(database=":memory:")
    if numeric and dates:
        date_col = dates[0]["name"].replace('"', '""')
        num_col = numeric[0]["name"].replace('"', '""')
        try:
            rows = con.execute(f"SELECT STRFTIME(TRY_CAST(\"{date_col}\" AS TIMESTAMP), '%Y-%m') AS period, SUM(TRY_CAST(\"{num_col}\" AS DOUBLE)) AS amount FROM read_csv_auto(?, header=true, sample_size=-1) GROUP BY period HAVING period IS NOT NULL ORDER BY period LIMIT 120", [str(path)]).fetchall()
            if rows:
                charts.append({"title": f"{numeric[0]['name']} over time", "chart_type": "line", "x_key": "period", "y_key": "amount", "data": [{"period": str(x), "amount": float(y or 0)} for x, y in rows]})
        except Exception:
            pass
    if numeric and textcols:
        cat = textcols[0]["name"].replace('"', '""')
        num_col = numeric[0]["name"].replace('"', '""')
        try:
            rows = con.execute(f"SELECT CAST(\"{cat}\" AS VARCHAR), SUM(TRY_CAST(\"{num_col}\" AS DOUBLE)) AS amount FROM read_csv_auto(?, header=true, sample_size=-1) GROUP BY 1 ORDER BY amount DESC LIMIT 10", [str(path)]).fetchall()
            if rows:
                charts.append({"title": f"{numeric[0]['name']} by {textcols[0]['name']}", "chart_type": "bar", "x_key": "category", "y_key": "amount", "data": [{"category": str(x), "amount": float(y or 0)} for x, y in rows]})
        except Exception:
            pass
    if numeric and not charts:
        num_col = numeric[0]["name"].replace('"', '""')
        rows = con.execute(f"SELECT CAST(FLOOR(TRY_CAST(\"{num_col}\" AS DOUBLE)/10)*10 AS VARCHAR), COUNT(*) FROM read_csv_auto(?, header=true, sample_size=-1) GROUP BY 1 ORDER BY 1 LIMIT 12", [str(path)]).fetchall()
        charts.append({"title": f"Distribution of {numeric[0]['name']}", "chart_type": "bar", "x_key": "bucket", "y_key": "count", "data": [{"bucket": str(x), "count": int(y)} for x, y in rows]})
    if not charts and textcols:
        category = textcols[0]["name"].replace('"', '""')
        rows = con.execute(f"SELECT CAST(\"{category}\" AS VARCHAR), COUNT(*) AS row_count FROM read_csv_auto(?, header=true, sample_size=-1) WHERE \"{category}\" IS NOT NULL GROUP BY 1 ORDER BY row_count DESC LIMIT 10", [str(path)]).fetchall()
        if rows:
            charts.append({"title": f"Records by {textcols[0]['name']}", "chart_type": "bar", "x_key": "category", "y_key": "count", "data": [{"category": str(x), "count": int(y)} for x, y in rows]})
    con.close()
    return {"dataset": meta, "kpis": kpis, "charts": charts, "generated_at": "local"}
