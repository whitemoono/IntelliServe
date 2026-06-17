"""
Celery tasks for knowledge base indexing and vector operations.
"""

import asyncio
import contextlib
import logging

import httpx

from worker.celery_app import celery_app

logger = logging.getLogger(__name__)


def _run_async(coro):
    """Helper to run async code in synchronous Celery tasks."""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    finally:
        async def _cleanup():
            with contextlib.suppress(Exception):
                from api.common.llm_client import close_llm_client

                await close_llm_client()
            with contextlib.suppress(Exception):
                from api.common.qdrant_client import close_qdrant_client

                await close_qdrant_client()
            with contextlib.suppress(Exception):
                from api.core.database import engine

                await engine.dispose()

        with contextlib.suppress(Exception):
            loop.run_until_complete(_cleanup())
        asyncio.set_event_loop(None)
        loop.close()


async def _embed_with_retries(llm, embed_texts: list[str]) -> list[list[float]]:
    """Embed text chunks in small batches with a single-item fallback."""
    vectors: list[list[float]] = []
    batch_size = 8

    for start in range(0, len(embed_texts), batch_size):
        batch = embed_texts[start : start + batch_size]
        try:
            vectors.extend(await llm.embed(batch))
            continue
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code != 400:
                raise
            logger.warning(
                "Batch embedding rejected by provider; retrying %s chunks individually",
                len(batch),
            )

        for text in batch:
            try:
                vectors.extend(await llm.embed([text]))
            except httpx.HTTPStatusError as exc:
                if exc.response.status_code != 400:
                    raise
                shortened = text[:6000]
                logger.warning(
                    "Single chunk embedding rejected; retrying truncated chunk "
                    "(original_chars=%s, truncated_chars=%s)",
                    len(text),
                    len(shortened),
                )
                vectors.extend(await llm.embed([shortened]))

    return vectors


@celery_app.task(
    bind=True,
    name="kb_tasks.index_article",
    queue="kb",
    max_retries=2,
    default_retry_delay=30,
)
def index_article(
    self,
    article_id: str,
    title: str,
    content: str,
    category: str,
    tags: list[str],
) -> dict:
    """Chunk article content, embed chunks, and upsert to Qdrant.

    This task runs synchronously in the Celery worker process.
    """
    try:
        from api.common.embedding import build_embed_texts, build_qdrant_points, chunk_text
        from api.common.llm_client import get_llm_client
        from api.common.qdrant_client import get_qdrant_client

        async def _index():
            # Step 1: Chunk the article content
            chunks = chunk_text(content)
            if not chunks:
                logger.warning(f"No chunks generated for article {article_id}")
                return {"status": "empty", "article_id": article_id}

            logger.info(f"Article {article_id}: {len(chunks)} chunks generated")

            # Step 2: Generate embeddings
            llm = get_llm_client()
            embed_texts = build_embed_texts(chunks)
            vectors = await _embed_with_retries(llm, embed_texts)
            logger.info(f"Article {article_id}: {len(vectors)} embeddings generated")

            # Step 3: Build Qdrant points
            points = build_qdrant_points(
                article_id=article_id,
                title=title,
                category=category,
                tags=tags,
                chunks=chunks,
                vectors=vectors,
            )

            # Step 4: Upsert to Qdrant
            qdrant = get_qdrant_client()
            await qdrant.ensure_collection()
            await qdrant.delete_by_article_id(article_id)
            await qdrant.upsert_points(points)
            logger.info(f"Article {article_id}: {len(points)} points upserted to Qdrant")

            # Step 5: Persist article indexing metadata
            from uuid import UUID

            from api.core.database import async_session_factory
            from api.modules.auth.models import User  # noqa: F401
            from api.modules.knowledge.service import knowledge_service

            async with async_session_factory() as db:
                await knowledge_service.mark_indexed(
                    article_id=UUID(article_id),
                    embedding_model=llm.embed_model,
                    chunk_count=len(chunks),
                    db=db,
                )
                await db.commit()

            return {
                "status": "success",
                "article_id": article_id,
                "chunk_count": len(chunks),
                "embedding_model": llm.embed_model,
            }

        return _run_async(_index())

    except Exception as exc:
        logger.error(f"index_article failed for {article_id}: {exc}", exc_info=True)
        raise self.retry(exc=exc)


@celery_app.task(
    bind=True,
    name="kb_tasks.delete_article_vectors",
    queue="kb",
    max_retries=2,
    default_retry_delay=10,
)
def delete_article_vectors(self, article_id: str) -> dict:
    """Delete all vectors for an article from Qdrant."""
    try:
        from api.common.qdrant_client import get_qdrant_client

        async def _delete():
            qdrant = get_qdrant_client()
            await qdrant.delete_by_article_id(article_id)
            logger.info(f"Deleted vectors for article {article_id}")
            return {"status": "success", "article_id": article_id}

        return _run_async(_delete())

    except Exception as exc:
        logger.error(f"delete_article_vectors failed for {article_id}: {exc}", exc_info=True)
        raise self.retry(exc=exc)
