"""
Message formatting utilities for different IM platforms.
"""

from api.modules.chatbot.schemas import ChatbotResponse


def format_text_reply(response: ChatbotResponse) -> str:
    """Format a ChatbotResponse as plain text for IM platforms."""
    parts = [response.reply]

    if response.knowledge_sources:
        parts.append("\n📚 相关知识库文章：")
        for i, src in enumerate(response.knowledge_sources[:3], 1):
            score_pct = int(src.get("score", 0) * 100)
            parts.append(f"  {i}. {src.get('title', '未知')} (相关度: {score_pct}%)")

    if response.suggested_actions:
        parts.append("\n💡 建议操作：")
        for action in response.suggested_actions:
            parts.append(f"  • {action.get('label', action.get('action', ''))}")

    return "\n".join(parts)


def format_markdown_reply(response: ChatbotResponse) -> tuple[str, str]:
    """Format a ChatbotResponse as Markdown for IM platforms.

    Returns:
        Tuple of (title, markdown_content).
    """
    title = "IntelliServe IT 助手"
    parts = [response.reply]

    if response.knowledge_sources:
        parts.append("\n---\n**📚 相关知识库文章：**")
        for i, src in enumerate(response.knowledge_sources[:3], 1):
            score_pct = int(src.get("score", 0) * 100)
            parts.append(f"{i}. **{src.get('title', '未知')}** (相关度: {score_pct}%)")

    if response.suggested_actions:
        parts.append("\n**💡 建议操作：**")
        for action in response.suggested_actions:
            parts.append(f"- {action.get('label', action.get('action', ''))}")

    return title, "\n".join(parts)
