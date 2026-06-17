"""
Pydantic schemas for Knowledge Base module.
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ArticleCreate(BaseModel):
    """Schema for creating a knowledge base article."""

    title: str
    content: str
    category: str | None = None
    tags: list[str] = []
    is_published: bool = False


class ArticleUpdate(BaseModel):
    """Schema for updating a knowledge base article."""

    title: str | None = None
    content: str | None = None
    category: str | None = None
    tags: list[str] | None = None
    is_published: bool | None = None
    change_summary: str | None = None


class ArticleResponse(BaseModel):
    """Schema for article response."""

    id: UUID
    title: str
    content: str
    category: str | None
    tags: list
    source_type: str
    version: int
    is_published: bool
    embedding_model: str | None
    chunk_count: int | None
    view_count: int
    helpful_count: int
    not_helpful_count: int
    created_by: UUID | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ArticleListResponse(BaseModel):
    """Schema for article list item (without content)."""

    id: UUID
    title: str
    category: str | None
    tags: list
    source_type: str
    version: int
    is_published: bool
    embedding_model: str | None
    chunk_count: int | None
    view_count: int
    helpful_count: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SearchRequest(BaseModel):
    """Schema for semantic search request."""

    query: str
    top_k: int = 5
    category_filter: str | None = None
    score_threshold: float = 0.5


class ChunkResult(BaseModel):
    """Schema for a single search result chunk."""

    article_id: UUID
    title: str
    chunk_index: int
    content: str
    score: float
    category: str | None
    tags: list


class SearchResponse(BaseModel):
    """Schema for semantic search response."""

    results: list[ChunkResult]
    query_time_ms: int


class SeedRequest(BaseModel):
    """Schema for importing built-in knowledge documents."""

    scope: str = "ops"


class SeedResponse(BaseModel):
    """Schema for seed import result."""

    imported: int
    published: int
    index_tasks: int
    skipped: list[str]


class RevisionResponse(BaseModel):
    """Schema for article revision."""

    id: UUID
    article_id: UUID
    version: int
    title: str
    content: str
    change_summary: str | None
    changed_by: UUID | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
