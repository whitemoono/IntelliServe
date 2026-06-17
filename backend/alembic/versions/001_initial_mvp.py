"""Initial MVP migration - create core tables.

Revision ID: 001_initial_mvp
Revises:
Create Date: 2025-01-01 00:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

# revision identifiers, used by Alembic.
revision: str = "001_initial_mvp"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create initial MVP tables."""

    # Enable UUID generation extension
    op.execute('CREATE EXTENSION IF NOT EXISTS "pgcrypto"')

    # =========================================================================
    # Users table
    # =========================================================================
    op.create_table(
        "users",
        sa.Column("id", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("employee_id", sa.String(32), unique=True, nullable=False, index=True),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("email", sa.String(256), unique=True),
        sa.Column("hashed_password", sa.String(256)),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("is_verified", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("role", sa.String(32), server_default="user", nullable=False),
        sa.Column("dingtalk_id", sa.String(128), index=True),
        sa.Column("wechat_work_id", sa.String(128)),
        sa.Column("position", sa.String(128)),
        sa.Column("engineer_skills", JSONB, server_default="[]"),
        sa.Column("current_workload", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # =========================================================================
    # Knowledge Base articles table
    # =========================================================================
    op.create_table(
        "knowledge_base",
        sa.Column("id", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("title", sa.String(512), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("category", sa.String(128), index=True),
        sa.Column("tags", JSONB, server_default="[]"),
        sa.Column("source_type", sa.String(32), server_default="manual", nullable=False),
        sa.Column("source_ticket_id", UUID(as_uuid=True)),
        sa.Column("version", sa.Integer(), server_default=sa.text("1"), nullable=False),
        sa.Column("is_published", sa.Boolean(), server_default=sa.text("false"), nullable=False, index=True),
        sa.Column("embedding_model", sa.String(128)),
        sa.Column("chunk_count", sa.Integer()),
        sa.Column("view_count", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("helpful_count", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("not_helpful_count", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # =========================================================================
    # Knowledge Base revisions table
    # =========================================================================
    op.create_table(
        "kb_revisions",
        sa.Column("id", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("article_id", UUID(as_uuid=True), sa.ForeignKey("knowledge_base.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(512), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("change_summary", sa.String(256)),
        sa.Column("changed_by", UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("article_id", "version", name="uq_kb_revision_version"),
    )

    # =========================================================================
    # Chat messages table
    # =========================================================================
    op.create_table(
        "chat_messages",
        sa.Column("id", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column("platform", sa.String(32), nullable=False),
        sa.Column("conversation_id", sa.String(128), nullable=False, index=True),
        sa.Column("role", sa.String(16), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("intent", sa.String(32)),
        sa.Column("intent_confidence", sa.Numeric(3, 2)),
        sa.Column("routing_tier", sa.String(4)),
        sa.Column("related_ticket_id", UUID(as_uuid=True)),
        sa.Column("related_kb_ids", JSONB, server_default="[]"),
        sa.Column("latency_ms", sa.Integer()),
        sa.Column("raw_payload", JSONB, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # Create indexes for common queries
    op.create_index("ix_chat_messages_created_at", "chat_messages", ["created_at"])
    op.create_index("ix_knowledge_base_created_at", "knowledge_base", ["created_at"])


def downgrade() -> None:
    """Drop all MVP tables."""
    op.drop_table("chat_messages")
    op.drop_table("kb_revisions")
    op.drop_table("knowledge_base")
    op.drop_table("users")
