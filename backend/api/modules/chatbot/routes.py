"""
Chatbot API routes - internal test endpoint and webhook placeholders.
"""

from fastapi import APIRouter, Depends

from api.core.dependencies import get_current_user
from api.modules.chatbot.schemas import ChatbotRequest, ChatbotResponse
from api.modules.chatbot.service import get_chatbot_service

router = APIRouter(prefix="/chatbot", tags=["智能助手"])


@router.post(
    "/message",
    response_model=ChatbotResponse,
    summary="发送消息 (测试端点)",
)
async def send_message(
    request: ChatbotRequest,
    _user=Depends(get_current_user),
):
    """Process a message through the full chatbot pipeline.

    This is an internal test endpoint for development and debugging.
    In production, messages come through DingTalk Stream Mode.
    """
    service = get_chatbot_service()
    return await service.process_message(request)


@router.post(
    "/webhook/dingtalk",
    summary="钉钉回调 (占位)",
)
async def dingtalk_webhook():
    """Placeholder for DingTalk card action callbacks.

    Stream Mode handles message receiving via WebSocket.
    This endpoint is for card button action callbacks only.
    """
    return {"status": "ok", "message": "DingTalk webhook placeholder"}
