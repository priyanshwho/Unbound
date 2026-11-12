from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from ..core.config import MAX_COLUMNS, MAX_DATASETS, MAX_ROWS, UPLOAD_DIR
from ..db.duckdb import _database_lock, connect_database, dataset_table, quote_identifier


class DatasetLimitError(ValueError):
    pass


class DatasetNotFoundError(LookupError):
    pass


def profile_csv(path: Path, dataset_id: str, original_name: str) -> dict[str, Any]:
    table = dataset_table(dataset_id)
    with _database_lock:
        connection = connect_database()
        try:
            existing = connection.execute("SELECT COUNT(*) FROM unbound_datasets").fetchone()[0]
            if existing >= MAX_DATASETS:
                raise DatasetLimitError(f"A workspace can contain up to {MAX_DATASETS} CSV files.")

            connection.execute(
                f"CREATE TABLE {table} AS SELECT * FROM read_csv_auto(?, header=true, sample_size=10000)",
                [str(path)],
            )
            rows = int(connection.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0])
            description = connection.execute(f"DESCRIBE SELECT * FROM {table}").fetchall()
            if rows > MAX_ROWS:
                raise DatasetLimitError(f"CSV files can contain up to {MAX_ROWS:,} rows.")
            if len(description) > MAX_COLUMNS:
                raise DatasetLimitError(f"CSV files can contain up to {MAX_COLUMNS} columns.")

            columns = []
            for name, data_type, *_ in description:
                column = quote_identifier(str(name))
                nulls, distinct = connection.execute(
                    f"SELECT COUNT(*) FILTER (WHERE {column} IS NULL), COUNT(DISTINCT {column}) FROM {table}"
                ).fetchone()
                samples = connection.execute(
                    f"SELECT DISTINCT CAST({column} AS VARCHAR) FROM {table} WHERE {column} IS NOT NULL LIMIT 5"
                ).fetchall()
                columns.append(
                    {
                        "name": str(name),
                        "type": str(data_type),
                        "nulls": int(nulls),
                        "distinct": int(distinct),
                        "samples": [str(row[0]) for row in samples],
                    }
                )
            profile = {
                "id": dataset_id,
                "name": original_name,
                "rows": rows,
                "columns": columns,
                "size": path.stat().st_size,
            }
            connection.execute(
                "INSERT INTO unbound_datasets (id, name, rows, size, columns_json) VALUES (?, ?, ?, ?, ?)",
                [dataset_id, original_name, rows, profile["size"], json.dumps(columns)],
            )
            return profile
        except Exception:
            connection.execute(f"DROP TABLE IF EXISTS {table}")
            raise
        finally:
            connection.close()


def list_datasets() -> list[dict[str, Any]]:
    with _database_lock:
        connection = connect_database()
        try:
            records = connection.execute(
                "SELECT id, name, rows, size, columns_json FROM unbound_datasets ORDER BY rowid"
            ).fetchall()
            return [
                {"id": row[0], "name": row[1], "rows": row[2], "size": row[3], "columns": json.loads(row[4])}
                for row in records
            ]
        finally:
            connection.close()


def delete_dataset(dataset_id: str) -> None:
    path = UPLOAD_DIR / f"{dataset_id}.csv"
    table = dataset_table(dataset_id)
    with _database_lock:
        connection = connect_database()
        try:
            record = connection.execute("SELECT 1 FROM unbound_datasets WHERE id = ?", [dataset_id]).fetchone()
            if not record:
                raise DatasetNotFoundError(dataset_id)
            connection.execute(f"DROP TABLE IF EXISTS {table}")
            connection.execute("DELETE FROM unbound_datasets WHERE id = ?", [dataset_id])
        finally:
            connection.close()
    path.unlink(missing_ok=True)


def preview_join(left_id: str, left_column: str, right_id: str, right_column: str) -> dict[str, int]:
    if left_id == right_id:
        raise ValueError("Choose two different datasets")
    with _database_lock:
        connection = connect_database()
        try:
            left_table, right_table = dataset_table(left_id), dataset_table(right_id)
            exists = connection.execute(
                "SELECT COUNT(*) FROM unbound_datasets WHERE id IN (?, ?)", [left_id, right_id]
            ).fetchone()[0]
            if exists != 2:
                raise DatasetNotFoundError("One of the selected files is no longer available")
            left_columns = {str(row[0]) for row in connection.execute(f"DESCRIBE SELECT * FROM {left_table}").fetchall()}
            right_columns = {str(row[0]) for row in connection.execute(f"DESCRIBE SELECT * FROM {right_table}").fetchall()}
            if left_column not in left_columns or right_column not in right_columns:
                raise ValueError("Choose a column that exists in each selected file")

            left_key, right_key = quote_identifier(left_column), quote_identifier(right_column)
            left_rows = int(connection.execute(f"SELECT COUNT(*) FROM {left_table}").fetchone()[0])
            right_rows = int(connection.execute(f"SELECT COUNT(*) FROM {right_table}").fetchone()[0])
            result = connection.execute(
                f"""
                WITH left_keys AS (
                    SELECT CAST({left_key} AS VARCHAR) AS join_key, COUNT(*) AS row_count
                    FROM {left_table} WHERE {left_key} IS NOT NULL GROUP BY 1
                ), right_keys AS (
                    SELECT CAST({right_key} AS VARCHAR) AS join_key, COUNT(*) AS row_count
                    FROM {right_table} WHERE {right_key} IS NOT NULL GROUP BY 1
                )
                SELECT COUNT(*) AS matched_keys,
                       COALESCE(SUM(left_keys.row_count), 0) AS matched_left_rows,
                       COALESCE(SUM(left_keys.row_count * right_keys.row_count), 0) AS joined_rows,
                       COUNT(*) FILTER (WHERE left_keys.row_count > 1) AS duplicate_left_keys,
                       COUNT(*) FILTER (WHERE right_keys.row_count > 1) AS duplicate_right_keys
                FROM left_keys INNER JOIN right_keys USING (join_key)
                """
            ).fetchone()
            matched_keys, matched_left_rows, joined_rows, duplicate_left, duplicate_right = map(int, result)
            return {
                "left_rows": left_rows,
                "right_rows": right_rows,
                "matched_left_rows": matched_left_rows,
                "unmatched_left_rows": left_rows - matched_left_rows,
                "matched_keys": matched_keys,
                "joined_rows": joined_rows,
                "duplicate_left_keys": duplicate_left,
                "duplicate_right_keys": duplicate_right,
            }
        finally:
            connection.close()
