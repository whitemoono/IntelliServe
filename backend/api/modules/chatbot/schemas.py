"""
Pydantic schemas for Chatbot module.
"""

from uuid import UUID

from pydantic import BaseModel


class UnifiedMessage(BaseModel):
    """Unified message format across all IM platforms."""

    platform: str  # dingtalk/wecom/web
    user_id: str | None = None
    platform_user_id: str
    text: str
    conversation_id: str
    message_type: str = "text"  # text/image/file
    images: list[str] = []
    timestamp: int


class ChatbotRequest(BaseModel):
    """Schema for internal chatbot test endpoint."""

    message: str
    platform: str = "web"
    user_id: UUID | None = None


class ChatbotResponse(BaseModel):
    """Schema for chatbot response."""

    intent: str
    confidence: float
    routing: str
    reply: str
    suggested_actions: list[dict] = []
    knowledge_sources: list[dict] = []
