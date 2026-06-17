"""
Chat message model for conversation logging.
"""

from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, Text, func, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from api.core.database import Base, UUIDMixin


class ChatMessage(Base, UUIDMixin):
    """Chat message log entry."""

    __tablename__ = "chat_messages"

    user_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"))
    platform: Mapped[str] = mapped_column(String(32))  # dingtalk/wecom/web
    conversation_id: Mapped[str] = mapped_column(String(128), index=True)
    role: Mapped[str] = mapped_column(String(16))  # user/assistant/system
    content: Mapped[str] = mapped_column(Text)
    intent: Mapped[str | None] = mapped_column(String(32))
    intent_confidence: Mapped[float | None] = mapped_column(Numeric(3, 2))
    routing_tier: Mapped[str | None] = mapped_column(String(4))  # L1/L2/L3
    related_ticket_id: Mapped[UUID | None]
    related_kb_ids: Mapped[list] = mapped_column(JSONB, default=list)
    latency_ms: Mapped[int | None] = mapped_column(Integer)
    raw_payload: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<ChatMessage {self.platform}:{self.role} @ {self.conversation_id[:8]}>"
