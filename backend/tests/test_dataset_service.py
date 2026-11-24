from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.db import duckdb as duckdb_adapter
from app.contracts import AnalysisPlan
from app.services.analysis_service import complete_plan, execute_analysis, format_answer, run_analysis
from app.services import dataset_service
from app.main import app


class DatasetPersistenceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.csv_dir = self.root / "datasets"
        self.csv_dir.mkdir()
        self.database = self.root / "unbound.duckdb"
        self.patches = [
            patch.object(duckdb_adapter, "DUCKDB_PATH", self.database),
            patch.object(duckdb_adapter, "DATA_DIR", self.root),
            patch.object(dataset_service, "UPLOAD_DIR", self.csv_dir),
        ]
        for item in self.patches:
            item.start()

    def tearDown(self) -> None:
        for item in reversed(self.patches):
            item.stop()
        self.temp.cleanup()

    def write_csv(self, dataset_id: str, content: str) -> Path:
        path = self.csv_dir / f"{dataset_id}.csv"
        path.write_text(content, encoding="utf-8")
        return path

    def test_csv_is_saved_as_duckdb_table_and_profile_survives_reopen(self) -> None:
        dataset_id = "a" * 32
        path = self.write_csv(dataset_id, "product,sales\nMug,12\nBook,25\n")
        profile = dataset_service.profile_csv(path, dataset_id, "sales.csv")

        self.assertEqual(profile["rows"], 2)
        self.assertEqual([column["name"] for column in profile["columns"]], ["product", "sales"])
        self.assertTrue(self.database.is_file())
        self.assertEqual(dataset_service.list_datasets()[0]["name"], "sales.csv")

    def test_join_preview_reports_duplicate_multiplication(self) -> None:
        left_id, right_id = "b" * 32, "c" * 32
        with patch.object(dataset_service, "MAX_DATASETS", 2):
            dataset_service.profile_csv(self.write_csv(left_id, "sku\na\na\nb\n"), left_id, "orders.csv")
            dataset_service.profile_csv(self.write_csv(right_id, "sku,name\na,Mug\nb,Book\n"), right_id, "products.csv")

        result = dataset_service.preview_join(left_id, "sku", right_id, "sku")

        self.assertEqual(result["matched_left_rows"], 3)
        self.assertEqual(result["joined_rows"], 3)
        self.assertEqual(result["duplicate_left_keys"], 1)

    def test_delete_removes_file_table_and_metadata(self) -> None:
        dataset_id = "d" * 32
        path = self.write_csv(dataset_id, "value\n1\n")
        dataset_service.profile_csv(path, dataset_id, "values.csv")

        dataset_service.delete_dataset(dataset_id)

        self.assertFalse(path.exists())
        self.assertEqual(dataset_service.list_datasets(), [])

    def test_validated_plan_calculates_values_in_duckdb(self) -> None:
        dataset_id = "e" * 32
        dataset_service.profile_csv(
            self.write_csv(dataset_id, "product,sales\nMug,12\nBook,25\nMug,8\n"),
            dataset_id,
            "sales.csv",
        )
        plan = AnalysisPlan(aggregation="sum", measure="sales", group_by="product", title="Sales by product")

        result = run_analysis(dataset_id, plan)

        self.assertEqual(result, [{"category": "Book", "value": 25}, {"category": "Mug", "value": 20}])

    def test_filtered_timeline_uses_bound_values_and_reports_highest_month(self) -> None:
        dataset_id = "4" * 32
        dataset_service.profile_csv(
            self.write_csv(dataset_id, "date,region,sales\n2026-01-01,O'Fallon,10\n2026-02-01,O'Fallon,35\n2026-02-01,East,100\n"),
            dataset_id,
            "sales.csv",
        )
        plan = AnalysisPlan(
            aggregation="sum", measure="sales", group_by="date", date_column="date",
            date_grain="month", chart_type="line", title="Monthly Sales",
            filters=[{"column": "region", "value": "O'Fallon"}],
        )
        rows, sql, parameters = execute_analysis(dataset_id, plan)
        self.assertEqual([row["value"] for row in rows], [10, 35])
        self.assertIn('CAST("region" AS VARCHAR) = ?', sql)
        self.assertNotIn("O'Fallon", sql)
        self.assertEqual(parameters, ["O'Fallon"])
        self.assertIn("35 for 2026-02", format_answer(plan, rows))

    def test_ask_route_passes_context_and_returns_follow_up_calculation(self) -> None:
        with TestClient(app, base_url="http://127.0.0.1:8000") as client:
            upload = client.post(
                "/api/v1/datasets/upload",
                files={"file": ("sales.csv", b"region,sales\nWest,12\nWest,8\nEast,25\n", "text/csv")},
            )
            self.assertEqual(upload.status_code, 200, upload.text)
            dataset_id = upload.json()["id"]
            initial = AnalysisPlan(aggregation="sum", measure="sales", group_by="region", title="Sales by region")
            follow_up = AnalysisPlan(
                aggregation="sum", measure="sales", title="West sales",
                filters=[{"column": "region", "value": "West"}],
            )
            with patch("app.api.v1.endpoints.analysis.propose_plan", side_effect=[initial, follow_up]) as planner:
                first = client.post("/api/v1/analysis/ask", json={"dataset_id": dataset_id, "question": "Show sales by region"})
                self.assertEqual(first.status_code, 200, first.text)
                self.assertEqual(first.json()["rows"], [{"category": "East", "value": 25}, {"category": "West", "value": 20}])
                second = client.post("/api/v1/analysis/ask", json={
                    "dataset_id": dataset_id,
                    "question": "What about only West?",
                    "context": [{"question": "Show sales by region", "plan": first.json()["plan"]}],
                })
                self.assertEqual(second.status_code, 200, second.text)
                self.assertEqual(second.json()["rows"], [{"value": 20}])
                self.assertEqual(second.json()["parameters"], ["West"])
                self.assertEqual(planner.call_args.args[2][0].plan.group_by, "region")

    def test_invalid_column_is_rejected_before_query(self) -> None:
        dataset_id = "f" * 32
        dataset_service.profile_csv(self.write_csv(dataset_id, "sales\n10\n"), dataset_id, "sales.csv")
        plan = AnalysisPlan(aggregation="sum", measure="sales; DROP TABLE unbound_datasets", title="Unsafe")

        with self.assertRaises(Exception) as raised:
            run_analysis(dataset_id, plan)

        self.assertIn("not in this dataset", str(raised.exception))

    def test_plan_completion_uses_a_question_named_numeric_measure(self) -> None:
        plan = AnalysisPlan(aggregation="sum", title="Sales by product")
        columns = [{"name": "product", "type": "VARCHAR"}, {"name": "sales", "type": "DOUBLE"}]

        completed = complete_plan(plan, "Which product had highest sales?", columns)

        self.assertEqual(completed.measure, "sales")

    def test_plan_completion_rejects_ambiguous_measure(self) -> None:
        plan = AnalysisPlan(aggregation="sum", title="Highest value")
        columns = [{"name": "sales", "type": "DOUBLE"}, {"name": "profit", "type": "DOUBLE"}]

        with self.assertRaises(Exception):
            complete_plan(plan, "Which is highest?", columns)


if __name__ == "__main__":
    unittest.main()
