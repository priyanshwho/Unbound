from __future__ import annotations

import unittest
from unittest.mock import AsyncMock, patch

from app.services.persistence_client import sync_dataset


class PersistenceClientTests(unittest.IsolatedAsyncioTestCase):
    async def test_dataset_sync_excludes_sample_values(self) -> None:
        profile = {
            "id": "a" * 32,
            "name": "sales.csv",
            "rows": 5,
            "size": 120,
            "columns": [{"name": "sales", "type": "DOUBLE", "samples": ["99.99"]}],
        }
        with patch("app.services.persistence_client.PERSISTENCE_API_TOKEN", "test-token"), patch(
            "app.services.persistence_client.private_request", new_callable=AsyncMock
        ) as request:
            await sync_dataset(profile)

        request.assert_awaited_once()
        body = request.await_args.args[2]
        self.assertEqual(body["columns"], [{"name": "sales", "type": "DOUBLE"}])
        self.assertNotIn("samples", body["columns"][0])
