"""
Chatbot service - orchestrates DingTalk adapter and intent router.
"""

import logging
import threading
import time
from uuid import uuid4

from api.modules.chatbot.dingtalk_adapter import DingTalkAdapter
from api.modules.chatbot.intent_router import IntentRouter
from api.modules.chatbot.message_formatter import format_text_reply
from api.modules.chatbot.schemas import ChatbotRequest, ChatbotResponse, UnifiedMessage

logger = logging.getLogger(__name__)


class ChatbotService:
    """Service that orchestrates the chatbot pipeline."""

    def __init__(
        self,
        intent_router: IntentRouter,
        dingtalk_adapter: DingTalkAdapter | None = None,
    ):
        self.intent_router = intent_router
        self.dingtalk_adapter = dingtalk_adapter

    async def process_message(
        self, request: ChatbotRequest
    ) -> ChatbotResponse:
        """Process a message through the full chatbot pipeline.

        Used by the internal test endpoint.
        """
        message = UnifiedMessage(
            platform=request.platform,
            platform_user_id=str(request.user_id) if request.user_id else "test-user",
            text=request.message,
            conversation_id=f"test-{uuid4()}",
            message_type="text",
            timestamp=int(time.time()),
        )
        return await self.intent_router.route(message)

    async def handle_dingtalk_message(
        self, message: UnifiedMessage
    ) -> ChatbotResponse:
        """Handle an incoming DingTalk message.

        Called by the DingTalk adapter's message handler.
        """
        return await self.intent_router.route(message)

    def start_dingtalk(self) -> None:
        """Start DingTalk Stream connection in background thread."""
        if self.dingtalk_adapter:
            try:
                import asyncio

                loop = asyncio.new_event_loop()

                def _run():
                    asyncio.set_event_loop(loop)
                    loop.run_until_complete(self.dingtalk_adapter.start())

                thread = threading.Thread(
                    target=_run, daemon=True, name="dingtalk-startup"
                )
                thread.start()
                logger.info("DingTalk adapter startup initiated")
            except Exception as e:
                logger.error(f"Failed to start DingTalk adapter: {e}")


# Module-level singleton
_chatbot_service: ChatbotService | None = None


def get_chatbot_service() -> ChatbotService:
    """Get or create the chatbot service singleton."""
    global _chatbot_service
    if _chatbot_service is None:
        from api.core.config import settings
        from api.core.database import async_session_factory
        from api.modules.knowledge.service import knowledge_service

        # Create intent router
        intent_router = IntentRouter(
            knowledge_service=knowledge_service,
            db_session_factory=async_session_factory,
        )

        # Create DingTalk adapter if credentials are configured
        dingtalk_adapter = None
        if settings.DINGTALK_CLIENT_ID and settings.DINGTALK_CLIENT_SECRET:
            dingtalk_adapter = DingTalkAdapter(
                client_id=settings.DINGTALK_CLIENT_ID,
                client_secret=settings.DINGTALK_CLIENT_SECRET,
                message_handler=lambda msg: intent_router.route(msg),
            )

        _chatbot_service = ChatbotService(
            intent_router=intent_router,
            dingtalk_adapter=dingtalk_adapter,
        )

    return _chatbot_service
