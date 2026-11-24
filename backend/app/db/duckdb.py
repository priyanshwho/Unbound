from __future__ import annotations

import threading

import duckdb

from ..core.config import DATA_DIR, DUCKDB_PATH

_database_lock = threading.RLock()


def connect_database() -> duckdb.DuckDBPyConnection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    connection = duckdb.connect(str(DUCKDB_PATH))
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS unbound_datasets (
            id VARCHAR PRIMARY KEY,
            name VARCHAR NOT NULL,
            rows BIGINT NOT NULL,
            size BIGINT NOT NULL,
            columns_json VARCHAR NOT NULL
        )
        """
    )
    connection.execute(
        "ALTER TABLE unbound_datasets ADD COLUMN IF NOT EXISTS quality_issues_json VARCHAR DEFAULT '[]'"
    )
    return connection


def connect_analysis_database() -> duckdb.DuckDBPyConnection:
    return duckdb.connect(str(DUCKDB_PATH), read_only=True, config={"enable_external_access": "false"})


def quote_identifier(value: str) -> str:
    return '"' + value.replace('"', '""') + '"'


def dataset_table(dataset_id: str) -> str:
    return quote_identifier(f"dataset_{dataset_id}")
