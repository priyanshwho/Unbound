from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from app.db import duckdb as duckdb_adapter
from app.services import dataset_service


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


if __name__ == "__main__":
    unittest.main()
