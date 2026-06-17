"""
Qdrant vector database client for knowledge base semantic search.
Uses httpx to call the Qdrant REST API directly.
"""

import logging
from typing import Any

import httpx

from api.core.config import settings

logger = logging.getLogger(__name__)


class QdrantClient:
    """Async HTTP client for Qdrant REST API."""

    def __init__(self, base_url: str, collection_name: str):
        self.base_url = base_url
        self.collection_name = collection_name
        self._client = httpx.AsyncClient(
            base_url=base_url,
            timeout=httpx.Timeout(30.0, connect=10.0),
        )

    async def ensure_collection(self) -> None:
        """Create collection if it doesn't exist. Called on app startup.

        Config: vectors size=settings.QDRANT_VECTOR_SIZE, distance=Cosine.
        """
        # Check if collection exists
        resp = await self._client.get(f"/collections/{self.collection_name}")
        if resp.status_code == 200:
            logger.info(f"Qdrant collection '{self.collection_name}' already exists")
            return

        # Create collection with HNSW index
        create_body = {
            "vectors": {
                "size": settings.QDRANT_VECTOR_SIZE,
                "distance": "Cosine",
                "on_disk": True,
            },
            "optimizers_config": {
                "indexing_threshold": 20000,
            },
            "on_disk_payload": True,
        }
        resp = await self._client.put(
            f"/collections/{self.collection_name}",
            json=create_body,
        )
        resp.raise_for_status()
        logger.info(f"Created Qdrant collection '{self.collection_name}'")

        # Create payload indexes for filtering
        indexes = [
            ("kb_article_id", "keyword"),
            ("category", "keyword"),
            ("tags", "keyword"),
            ("chunk_index", "integer"),
            ("created_at", "datetime"),
        ]
        for field_name, field_type in indexes:
            index_body = {
                "field_name": field_name,
                "field_schema": field_type,
            }
            resp = await self._client.put(
                f"/collections/{self.collection_name}/index",
                json=index_body,
            )
            if resp.status_code in (200, 201):
                logger.debug(f"Created payload index on '{field_name}'")

    async def upsert_points(self, points: list[dict]) -> None:
        """Batch upsert points to the collection.

        Each point must have 'id', 'vector', and 'payload' keys.
        """
        if not points:
            return

        body = {
            "points": [
                {"id": p["id"], "vector": p["vector"], "payload": p["payload"]}
                for p in points
            ]
        }
        resp = await self._client.put(
            f"/collections/{self.collection_name}/points",
            json=body,
        )
        resp.raise_for_status()
        logger.info(f"Upserted {len(points)} points to '{self.collection_name}'")

    async def search(
        self,
        vector: list[float],
        top_k: int = 5,
        score_threshold: float = 0.65,
        category_filter: str | None = None,
    ) -> list[dict]:
        """Search for similar vectors.

        Returns list of dicts with 'id', 'score', and 'payload' keys.
        """
        search_body: dict[str, Any] = {
            "vector": vector,
            "limit": top_k,
            "score_threshold": score_threshold,
            "with_payload": True,
        }

        # Add category filter if specified
        if category_filter:
            search_body["filter"] = {
                "must": [{"key": "category", "match": {"value": category_filter}}]
            }

        resp = await self._client.post(
            f"/collections/{self.collection_name}/points/search",
            json=search_body,
        )
        resp.raise_for_status()
        return resp.json().get("result", [])

    async def delete_by_article_id(self, article_id: str) -> None:
        """Delete all points belonging to a specific article."""
        body = {
            "filter": {
                "must": [
                    {"key": "kb_article_id", "match": {"value": article_id}}
                ]
            }
        }
        resp = await self._client.post(
            f"/collections/{self.collection_name}/points/delete",
            json=body,
        )
        resp.raise_for_status()
        logger.info(f"Deleted vectors for article {article_id}")

    async def close(self) -> None:
        """Close the underlying HTTP client."""
        await self._client.aclose()


# Module-level singleton
_qdrant_client: QdrantClient | None = None


def get_qdrant_client() -> QdrantClient:
    """Get or create the Qdrant client singleton."""
    global _qdrant_client
    if _qdrant_client is None:
        _qdrant_client = QdrantClient(
            base_url=settings.QDRANT_URL,
            collection_name=settings.QDRANT_COLLECTION,
        )
    return _qdrant_client


async def close_qdrant_client() -> None:
    """Close the Qdrant client singleton."""
    global _qdrant_client
    if _qdrant_client is not None:
        await _qdrant_client.close()
        _qdrant_client = None
