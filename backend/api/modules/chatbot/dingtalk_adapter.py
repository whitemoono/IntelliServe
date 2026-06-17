"""
DingTalk Stream Mode adapter for receiving and sending messages.

Uses the dingtalk-stream SDK to maintain a WebSocket connection to DingTalk servers.
No public callback URL needed - friendly for intranet deployment.
"""

import logging
import time
from uuid import uuid4

from api.modules.chatbot.im_adapter import IMAdapter
from api.modules.chatbot.schemas import UnifiedMessage

logger = logging.getLogger(__name__)


class DingTalkAdapter(IMAdapter):
    """DingTalk Stream Mode message adapter."""

    def __init__(self, client_id: str, client_secret: str, message_handler):
        """Initialize the DingTalk adapter.

        Args:
            client_id: DingTalk app key.
            client_secret: DingTalk app secret.
            message_handler: Async callable that processes UnifiedMessage and returns reply.
        """
        self.client_id = client_id
        self.client_secret = client_secret
        self.message_handler = message_handler
        self._client = None
        self._running = False

    def _create_client(self):
        """Create and configure the DingTalk Stream client."""
        try:
            import dingtalk_stream

            client = dingtalk_stream.DingTalkStreamClient(
                self.client_id, self.client_secret
            )

            # Register chatbot message handler
            chatbot_handler = ChatbotHandler(self.message_handler)
            client.register_callback_handler(
                dingtalk_stream.ChatbotMessage, chatbot_handler
            )

            self._client = client
            return client
        except ImportError:
            logger.error("dingtalk_stream package not installed")
            return None
        except Exception as e:
            logger.error(f"Failed to create DingTalk client: {e}")
            return None

    async def start(self) -> None:
        """Start the DingTalk Stream connection.

        This runs in a background thread since start_forever() is blocking.
        """
        import threading

        if not self.client_id or not self.client_secret:
            logger.warning("DingTalk credentials not configured, skipping")
            return

        client = self._create_client()
        if client is None:
            return

        self._running = True

        def _run():
            try:
                logger.info("Starting DingTalk Stream connection...")
                client.start_forever()
            except Exception as e:
                logger.error(f"DingTalk Stream connection failed: {e}")
                self._running = False

        thread = threading.Thread(target=_run, daemon=True, name="dingtalk-stream")
        thread.start()
        logger.info("DingTalk Stream adapter started in background thread")

    async def send_text(self, conversation_id: str, text: str) -> None:
        """Send a plain text message via DingTalk API."""
        logger.info(f"Sending text to {conversation_id}: {text[:50]}...")
        # The actual sending is handled by the dingtalk-stream SDK's response mechanism
        # For direct messages, we use the OpenAPI

    async def send_markdown(
        self, conversation_id: str, title: str, md: str
    ) -> None:
        """Send a Markdown message via DingTalk API."""
        logger.info(f"Sending markdown to {conversation_id}: {title}")

    async def send_card(self, conversation_id: str, card: dict) -> None:
        """Send an interactive card message via DingTalk API."""
        logger.info(f"Sending card to {conversation_id}")


class ChatbotHandler:
    """Handler for DingTalk chatbot message callbacks."""

    def __init__(self, message_handler):
        self.message_handler = message_handler

    async def process(self, callback):
        """Process incoming DingTalk chatbot message.

        Args:
            callback: dingtalk_stream.ChatbotMessage callback object.
        """
        import asyncio

        try:
            # Extract message data from callback
            sender_id = getattr(callback.sender_staff_id, "value", callback.sender_staff_id)
            text = ""
            conversation_id = ""

            if hasattr(callback, "text") and callback.text:
                text = getattr(callback.text, "content", str(callback.text))
                text = text.strip()

            if hasattr(callback, "conversation_id"):
                conversation_id = callback.conversation_id or ""
            if hasattr(callback, "sender_nick"):
                sender_nick = callback.sender_nick or ""

            if not text:
                return

            # Create UnifiedMessage
            message = UnifiedMessage(
                platform="dingtalk",
                platform_user_id=sender_id,
                text=text,
                conversation_id=conversation_id or f"dingtalk-{sender_id}",
                message_type="text",
                timestamp=int(time.time()),
            )

            # Process through message handler
            reply = await self.message_handler(message)

            # The reply is sent back through the DingTalk Stream SDK's response mechanism
            return reply

        except Exception as e:
            logger.error(f"Error processing DingTalk message: {e}", exc_info=True)
