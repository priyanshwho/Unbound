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
    return connection


def quote_identifier(value: str) -> str:
    return '"' + value.replace('"', '""') + '"'


def dataset_table(dataset_id: str) -> str:
    return quote_identifier(f"dataset_{dataset_id}")
