"""
Knowledge Base API routes - article CRUD, semantic search, reindex.
"""

from math import ceil
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from api.core.database import get_db
from api.core.dependencies import get_current_user, require_role
from api.modules.knowledge.schemas import (
    ArticleCreate,
    ArticleListResponse,
    ArticleResponse,
    ArticleUpdate,
    SeedRequest,
    SeedResponse,
    SearchRequest,
    SearchResponse,
)
from api.modules.knowledge.seed import seed_knowledge_base
from api.modules.knowledge.service import knowledge_service

router = APIRouter(prefix="/kb", tags=["知识库"])


@router.get(
    "/articles",
    summary="文章列表",
)
async def list_articles(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    category: str | None = None,
    tag: str | None = None,
    q: str | None = None,
    published: bool | None = None,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    """List knowledge base articles with pagination and filters."""
    articles, total = await knowledge_service.list_articles(
        page=page,
        page_size=page_size,
        category=category,
        tag=tag,
        q=q,
        published=published,
        db=db,
    )
    return {
        "items": [ArticleListResponse.model_validate(a) for a in articles],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": ceil(total / page_size) if total > 0 else 0,
    }


@router.post(
    "/seed",
    response_model=SeedResponse,
    summary="导入运维知识库文档",
)
async def seed_articles(
    data: SeedRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    """Import built-in operations docs, publish them, and enqueue indexing."""
    result = await seed_knowledge_base(
        db=db,
        scope=data.scope,
        actor_id=current_user.id,
    )
    return SeedResponse(
        imported=result.imported,
        published=result.published,
        index_tasks=result.index_tasks,
        skipped=result.skipped,
    )


@router.post(
    "/articles",
    response_model=ArticleResponse,
    status_code=201,
    summary="创建文章",
)
async def create_article(
    data: ArticleCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin", "engineer")),
):
    """Create a new knowledge base article. Triggers embedding if published."""
    article = await knowledge_service.create_article(data, current_user.id, db)
    return ArticleResponse.model_validate(article)


@router.get(
    "/articles/{article_id}",
    response_model=ArticleResponse,
    summary="文章详情",
)
async def get_article(
    article_id: str,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    """Get article detail by ID."""
    article = await knowledge_service.get_article(UUID(article_id), db)
    return ArticleResponse.model_validate(article)


@router.put(
    "/articles/{article_id}",
    response_model=ArticleResponse,
    summary="更新文章",
)
async def update_article(
    article_id: str,
    data: ArticleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin", "engineer")),
):
    """Update article. Triggers re-embedding if content changed."""
    article = await knowledge_service.update_article(
        UUID(article_id), data, current_user.id, db
    )
    return ArticleResponse.model_validate(article)


@router.delete(
    "/articles/{article_id}",
    status_code=204,
    summary="删除文章",
)
async def delete_article(
    article_id: str,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_role("admin")),
):
    """Delete article and its vectors. Admin only."""
    await knowledge_service.delete_article(UUID(article_id), db)


@router.post(
    "/search",
    response_model=SearchResponse,
    summary="语义搜索",
)
async def semantic_search(
    data: SearchRequest,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    """Semantic search across knowledge base using vector similarity."""
    import time

    start = time.time()
    results = await knowledge_service.semantic_search(
        query=data.query,
        top_k=data.top_k,
        category=data.category_filter,
        score_threshold=data.score_threshold,
    )
    elapsed_ms = int((time.time() - start) * 1000)

    return SearchResponse(results=results, query_time_ms=elapsed_ms)


@router.post(
    "/articles/{article_id}/reindex",
    response_model=ArticleResponse,
    summary="重新索引文章",
)
async def reindex_article(
    article_id: str,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_role("admin")),
):
    """Force re-embed and reindex an article. Admin only."""
    article = await knowledge_service.reindex_article(UUID(article_id), db)
    return ArticleResponse.model_validate(article)
