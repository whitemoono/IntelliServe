"""
Knowledge Base models - articles and version history.
"""

from datetime import datetime
from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text, UniqueConstraint, func, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from api.core.database import Base, TimestampMixin, UUIDMixin


class KnowledgeBase(Base, UUIDMixin, TimestampMixin):
    """Knowledge base article."""

    __tablename__ = "knowledge_base"

    title: Mapped[str] = mapped_column(String(512), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)  # Markdown format
    category: Mapped[str | None] = mapped_column(String(128), index=True)
    tags: Mapped[list] = mapped_column(JSONB, default=list)
    source_type: Mapped[str] = mapped_column(
        String(32), default="manual"
    )  # manual/ai_generated/ticket_extracted
    source_ticket_id: Mapped[UUID | None] = mapped_column(nullable=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    is_published: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    embedding_model: Mapped[str | None] = mapped_column(String(128))
    chunk_count: Mapped[int | None] = mapped_column(Integer)
    view_count: Mapped[int] = mapped_column(Integer, default=0)
    helpful_count: Mapped[int] = mapped_column(Integer, default=0)
    not_helpful_count: Mapped[int] = mapped_column(Integer, default=0)
    created_by: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"))

    # Relationships
    revisions: Mapped[list["KbRevision"]] = relationship(
        back_populates="article", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<KnowledgeBase {self.title[:30]}>"


class KbRevision(Base):
    """Version history for knowledge base articles."""

    __tablename__ = "kb_revisions"
    __table_args__ = (
        UniqueConstraint("article_id", "version", name="uq_kb_revision_version"),
    )

    id: Mapped[UUID] = mapped_column(
        primary_key=True, server_default=text("gen_random_uuid()")
    )
    article_id: Mapped[UUID] = mapped_column(
        ForeignKey("knowledge_base.id", ondelete="CASCADE"), nullable=False, index=True
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    change_summary: Mapped[str | None] = mapped_column(String(256))
    changed_by: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), nullable=False
    )

    # Relationships
    article: Mapped["KnowledgeBase"] = relationship(back_populates="revisions")

    def __repr__(self) -> str:
        return f"<KbRevision article={self.article_id} v{self.version}>"
