"""
Knowledge Base service - article CRUD, semantic search, reindexing.
"""

import time
from math import ceil
from uuid import UUID, uuid4

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.common.llm_client import get_llm_client
from api.common.qdrant_client import get_qdrant_client
from api.core.exceptions import NotFoundException
from api.modules.knowledge.models import KbRevision, KnowledgeBase
from api.modules.knowledge.schemas import (
    ArticleCreate,
    ArticleUpdate,
    ChunkResult,
)


class KnowledgeService:
    """Service for knowledge base operations."""

    async def create_article(
        self, data: ArticleCreate, user_id: UUID, db: AsyncSession
    ) -> KnowledgeBase:
        """Create a new article and trigger embedding via Celery."""
        article = KnowledgeBase(
            title=data.title,
            content=data.content,
            category=data.category,
            tags=data.tags,
            source_type="manual",
            is_published=data.is_published,
            created_by=user_id,
        )
        db.add(article)
        await db.flush()

        # Create initial revision
        revision = KbRevision(
            article_id=article.id,
            version=1,
            title=data.title,
            content=data.content,
            change_summary="初始创建",
            changed_by=user_id,
        )
        db.add(revision)
        await db.flush()
        await db.refresh(article)

        if article.is_published:
            # Commit before dispatching so the worker can read and update the row.
            await db.commit()
            await db.refresh(article)
            self._dispatch_index(article)

        return article

    async def mark_indexed(
        self,
        article_id: UUID,
        embedding_model: str,
        chunk_count: int,
        db: AsyncSession,
    ) -> KnowledgeBase:
        """Persist indexing metadata after the worker upserts vectors."""
        article = await self.get_article(article_id, db)
        article.embedding_model = embedding_model
        article.chunk_count = chunk_count
        await db.flush()
        await db.refresh(article)
        return article

    async def get_article(
        self, article_id: UUID, db: AsyncSession, increment_view: bool = False
    ) -> KnowledgeBase:
        """Get article by ID. Raises NotFoundException if not found."""
        result = await db.execute(
            select(KnowledgeBase).where(KnowledgeBase.id == article_id)
        )
        article = result.scalar_one_or_none()
        if article is None:
            raise NotFoundException("文章", str(article_id))

        if increment_view:
            article.view_count += 1
            await db.flush()

        return article

    async def list_articles(
        self,
        page: int = 1,
        page_size: int = 20,
        category: str | None = None,
        tag: str | None = None,
        q: str | None = None,
        published: bool | None = None,
        db: AsyncSession = None,
    ) -> tuple[list[KnowledgeBase], int]:
        """List articles with pagination and filters."""
        query = select(KnowledgeBase)

        if category:
            query = query.where(KnowledgeBase.category == category)
        if published is not None:
            query = query.where(KnowledgeBase.is_published == published)
        if q:
            query = query.where(KnowledgeBase.title.ilike(f"%{q}%"))
        if tag:
            query = query.where(KnowledgeBase.tags.contains([tag]))

        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total = (await db.execute(count_query)).scalar()

        # Apply pagination
        query = query.order_by(KnowledgeBase.updated_at.desc())
        query = query.offset((page - 1) * page_size).limit(page_size)

        result = await db.execute(query)
        articles = list(result.scalars().all())

        return articles, total

    async def update_article(
        self, article_id: UUID, data: ArticleUpdate, user_id: UUID, db: AsyncSession
    ) -> KnowledgeBase:
        """Update article fields, create revision, trigger re-embedding."""
        article = await self.get_article(article_id, db)

        update_data = data.model_dump(exclude_unset=True)
        change_summary = update_data.pop("change_summary", "内容更新")

        # Track if vector-affecting fields changed for re-embedding
        content_changed = any(
            field in update_data for field in ("title", "content", "category", "tags")
        )
        publish_changed = update_data.get("is_published") is True

        for field, value in update_data.items():
            setattr(article, field, value)

        # Increment version and create revision
        article.version += 1
        revision = KbRevision(
            article_id=article.id,
            version=article.version,
            title=article.title,
            content=article.content,
            change_summary=change_summary,
            changed_by=user_id,
        )
        db.add(revision)
        await db.flush()
        await db.refresh(article)

        if (content_changed or publish_changed) and article.is_published:
            # Commit before dispatching so the worker never races an uncommitted row.
            await db.commit()
            await db.refresh(article)
            self._dispatch_index(article)

        return article

    async def delete_article(self, article_id: UUID, db: AsyncSession) -> None:
        """Delete article and its vectors from Qdrant."""
        article = await self.get_article(article_id, db)

        # Delete vectors from Qdrant
        try:
            qdrant = get_qdrant_client()
            await qdrant.delete_by_article_id(str(article_id))
        except Exception:
            pass  # Log but don't fail if Qdrant is unavailable

        await db.delete(article)
        await db.flush()

    async def semantic_search(
        self,
        query: str,
        top_k: int = 5,
        category: str | None = None,
        score_threshold: float = 0.65,
    ) -> list[ChunkResult]:
        """Semantic search via embedding + Qdrant vector search."""
        start_time = time.time()

        # Embed the query
        llm = get_llm_client()
        qdrant = get_qdrant_client()

        embedding_prefix = "为这句话生成表示向量以用于检索相关文章："
        vectors = await llm.embed([f"{embedding_prefix}{query}"])
        query_vector = vectors[0]

        # Search Qdrant
        results = await qdrant.search(
            vector=query_vector,
            top_k=top_k,
            score_threshold=score_threshold,
            category_filter=category,
        )

        # Convert to ChunkResult
        chunks = []
        for r in results:
            payload = r.get("payload", {})
            chunks.append(
                ChunkResult(
                    article_id=UUID(payload.get("kb_article_id", "00000000-0000-0000-0000-000000000000")),
                    title=payload.get("title", ""),
                    chunk_index=payload.get("chunk_index", 0),
                    content=payload.get("content", ""),
                    score=r.get("score", 0.0),
                    category=payload.get("category"),
                    tags=payload.get("tags", []),
                )
            )

        return chunks

    async def reindex_article(
        self, article_id: UUID, db: AsyncSession
    ) -> KnowledgeBase:
        """Force re-embed an article."""
        article = await self.get_article(article_id, db)
        self._dispatch_index(article)
        return article

    def _dispatch_index(self, article: KnowledgeBase) -> None:
        """Dispatch Celery task to index article (chunk + embed + upsert to Qdrant)."""
        try:
            from api.modules.knowledge.tasks import dispatch_index_article

            dispatch_index_article(
                article_id=str(article.id),
                title=article.title,
                content=article.content,
                category=article.category or "",
                tags=article.tags or [],
            )
        except Exception:
            # Celery not available in dev mode - log and continue
            pass


# Module-level singleton
knowledge_service = KnowledgeService()
