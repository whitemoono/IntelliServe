"""
Intent classification and routing for the chatbot.

Routes incoming messages to appropriate handlers based on classified intent:
- greeting: canned reply, no LLM needed
- knowledge_query: RAG retrieval + LLM answer
- fault_report: severity assessment + automation/ticket
- service_request: create ticket, assign engineer
- feedback: record feedback, notify admin
"""

import json
import logging
import re
import time

from api.common.llm_client import get_llm_client
from api.common.prompts import load_prompt
from api.modules.chatbot.schemas import ChatbotResponse, UnifiedMessage

logger = logging.getLogger(__name__)

# Simple greeting patterns for rule-based classification
_GREETING_PATTERNS = re.compile(
    r"^(你好|hi|hello|hey|嗨|在吗|在不在|早上好|下午好|晚上好|早|晚安)[\s!！.。]?$",
    re.IGNORECASE,
)
_KNOWLEDGE_QUERY_PATTERNS = re.compile(
    r"(怎么|怎样|如何|怎么办|怎么处理|如何处理|排查|解决方法|解决方案|操作步骤|配置|设置|连接|指南)"
)


class IntentRouter:
    """Routes user messages to appropriate handlers based on intent classification."""

    def __init__(self, knowledge_service=None, db_session_factory=None):
        self.knowledge_service = knowledge_service
        self.db_session_factory = db_session_factory

    async def route(self, message: UnifiedMessage) -> ChatbotResponse:
        """Main entry point: classify intent, dispatch to handler, log result.

        Args:
            message: Unified message from any IM platform.

        Returns:
            ChatbotResponse with intent, reply, and metadata.
        """
        start_time = time.time()

        # Step 1: Classify intent
        intent, confidence = await self._classify_intent(message.text)

        # Step 2: Dispatch to handler
        if intent == "greeting":
            response = self._handle_greeting()
        elif intent == "knowledge_query":
            response = await self._handle_knowledge_query(message.text)
        elif intent == "fault_report":
            response = await self._handle_fault_report(message.text)
        elif intent == "service_request":
            response = self._handle_service_request(message.text)
        else:
            response = self._handle_feedback(message.text)

        # Step 3: Calculate latency
        latency_ms = int((time.time() - start_time) * 1000)
        response.intent = intent
        response.confidence = confidence
        response.routing = "L1" if intent in ("greeting", "knowledge_query") else "L2"

        # Step 4: Log to database (async, fire-and-forget)
        try:
            await self._log_message(message, response, latency_ms)
        except Exception as e:
            logger.warning(f"Failed to log message: {e}")

        return response

    async def _classify_intent(self, text: str) -> tuple[str, float]:
        """Classify user intent using rule-based pre-filter + LLM.

        Returns:
            Tuple of (intent, confidence).
        """
        # Rule-based pre-filter for greetings (fast, no LLM needed)
        normalized = text.strip()
        if _GREETING_PATTERNS.match(normalized):
            return "greeting", 0.99
        if _KNOWLEDGE_QUERY_PATTERNS.search(normalized):
            return "knowledge_query", 0.9

        # LLM-based classification for everything else
        try:
            llm = get_llm_client()
            prompt_template = load_prompt("intent_classify_v1.txt")
            prompt = prompt_template.replace("{user_text}", text)

            result = await llm.chat(
                messages=[
                    {"role": "system", "content": "你是一个意图分类器，请直接输出 JSON。"},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.1,
            )

            # Parse JSON response
            # Try to extract JSON from the response
            json_match = re.search(r"\{[^}]+\}", result)
            if json_match:
                data = json.loads(json_match.group())
                intent = data.get("intent", "knowledge_query")
                confidence = float(data.get("confidence", 0.5))

                # Validate intent
                valid_intents = {
                    "greeting",
                    "knowledge_query",
                    "fault_report",
                    "service_request",
                    "feedback",
                }
                if intent not in valid_intents:
                    intent = "knowledge_query"

                return intent, confidence

        except Exception as e:
            logger.warning(f"Intent classification failed: {e}")

        # Fallback: assume knowledge query
        return "knowledge_query", 0.5

    def _handle_greeting(self) -> ChatbotResponse:
        """Handle greeting messages with a canned reply."""
        return ChatbotResponse(
            intent="greeting",
            confidence=0.99,
            routing="L1",
            reply=(
                "你好！👋 我是 IntelliServe IT 智能助手。\n\n"
                "我可以帮你：\n"
                "1. 解答 IT 常见问题（如网络、打印机、VPN 等）\n"
                "2. 报告设备故障\n"
                "3. 提交 IT 服务请求\n\n"
                "请问有什么可以帮你的？"
            ),
        )

    async def _handle_knowledge_query(self, query: str) -> ChatbotResponse:
        """Handle knowledge queries using RAG pipeline.

        Pipeline: semantic search -> build context -> LLM generate answer.
        """
        try:
            # Step 1: Semantic search in knowledge base
            if self.knowledge_service:
                search_results = await self.knowledge_service.semantic_search(
                    query=query, top_k=5, score_threshold=0.5
                )
            else:
                search_results = []

            # Step 2: Build context from search results
            if search_results:
                context_parts = []
                for r in search_results:
                    context_parts.append(f"[来源: {r.title}]\n{r.content}")
                context = "\n\n---\n\n".join(context_parts)
            else:
                context = "（知识库中暂无相关内容）"

            # Step 3: Generate answer using LLM
            llm = get_llm_client()
            prompt_template = load_prompt("rag_qa_v1.txt")
            system_prompt = prompt_template.replace("{context}", context).replace(
                "{user_question}", query
            )

            reply = await llm.chat(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": query},
                ],
                temperature=0.3,
            )

            # Step 4: Build response with sources
            sources = [
                {
                    "article_id": str(r.article_id),
                    "title": r.title,
                    "score": round(r.score, 3),
                }
                for r in search_results[:3]
            ]

            return ChatbotResponse(
                intent="knowledge_query",
                confidence=0.8,
                routing="L1",
                reply=reply,
                knowledge_sources=sources,
            )

        except Exception as e:
            logger.error(f"Knowledge query handler failed: {e}", exc_info=True)
            return ChatbotResponse(
                intent="knowledge_query",
                confidence=0.5,
                routing="L2",
                reply=(
                    "抱歉，处理您的问题时遇到了错误。"
                    "请稍后再试，或联系 IT 工程师获取帮助。"
                ),
            )

    async def _handle_fault_report(self, text: str) -> ChatbotResponse:
        """Handle fault reports with basic response (full diagnosis in Phase 2)."""
        return ChatbotResponse(
            intent="fault_report",
            confidence=0.8,
            routing="L2",
            reply=(
                f"已收到您的故障报告：「{text}」\n\n"
                "我将为您创建一个工单，IT 工程师会尽快处理。\n"
                "如果是紧急问题，请直接拨打 IT 热线。"
            ),
            suggested_actions=[
                {"action": "create_ticket", "label": "创建工单"},
                {"action": "contact_engineer", "label": "联系工程师"},
            ],
        )

    def _handle_service_request(self, text: str) -> ChatbotResponse:
        """Handle IT service requests."""
        return ChatbotResponse(
            intent="service_request",
            confidence=0.8,
            routing="L2",
            reply=(
                f"已收到您的服务请求：「{text}」\n\n"
                "我将为您创建一个服务工单，请等待 IT 工程师处理。\n"
                "您可以在钉钉中查看工单进度。"
            ),
            suggested_actions=[
                {"action": "create_ticket", "label": "创建服务工单"},
            ],
        )

    def _handle_feedback(self, text: str) -> ChatbotResponse:
        """Handle feedback messages."""
        return ChatbotResponse(
            intent="feedback",
            confidence=0.7,
            routing="L1",
            reply="感谢您的反馈！🙏 我们会认真对待每一条建议，持续改进 IT 服务质量。",
        )

    async def _log_message(
        self,
        message: UnifiedMessage,
        response: ChatbotResponse,
        latency_ms: int,
    ) -> None:
        """Log chat message to database."""
        if self.db_session_factory is None:
            return

        try:
            from api.modules.chatbot.models import ChatMessage

            async with self.db_session_factory() as db:
                # Log user message
                user_msg = ChatMessage(
                    platform=message.platform,
                    conversation_id=message.conversation_id,
                    role="user",
                    content=message.text,
                    intent=response.intent,
                    intent_confidence=response.confidence,
                    routing_tier=response.routing,
                    latency_ms=latency_ms,
                    raw_payload={"platform_user_id": message.platform_user_id},
                )
                db.add(user_msg)

                # Log assistant reply
                assistant_msg = ChatMessage(
                    platform=message.platform,
                    conversation_id=message.conversation_id,
                    role="assistant",
                    content=response.reply,
                    intent=response.intent,
                    intent_confidence=response.confidence,
                    routing_tier=response.routing,
                    related_kb_ids=[
                        s.get("article_id") for s in response.knowledge_sources
                    ],
                )
                db.add(assistant_msg)

                await db.commit()
        except Exception as e:
            logger.warning(f"Failed to log chat message: {e}")
