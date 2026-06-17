"""
Abstract base class for IM platform adapters (DingTalk, WeCom, etc.).
"""

from abc import ABC, abstractmethod


class IMAdapter(ABC):
    """Abstract base class for IM platform adapters."""

    @abstractmethod
    async def start(self) -> None:
        """Start the platform connection."""
        ...

    @abstractmethod
    async def send_text(self, conversation_id: str, text: str) -> None:
        """Send a plain text message."""
        ...

    @abstractmethod
    async def send_markdown(
        self, conversation_id: str, title: str, md: str
    ) -> None:
        """Send a Markdown-formatted message."""
        ...

    @abstractmethod
    async def send_card(self, conversation_id: str, card: dict) -> None:
        """Send an interactive card message."""
        ...
