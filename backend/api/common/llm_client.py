"""
LLM client supporting both DashScope/Bailian-compatible APIs and Ollama fallback.
Uses httpx for full control over timeouts and error handling.
"""

import logging
from abc import ABC, abstractmethod
from typing import Any

import httpx

from api.core.config import settings

logger = logging.getLogger(__name__)


class BaseLLMClient(ABC):
    """Abstract base class for LLM clients."""

    @abstractmethod
    async def embed(self, texts: list[str]) -> list[list[float]]:
        ...

    @abstractmethod
    async def chat(
        self, messages: list[dict[str, str]], model: str | None = None, **kwargs: Any
    ) -> str:
        ...

    @abstractmethod
    async def health_check(self) -> str:
        ...

    @abstractmethod
    async def close(self) -> None:
        ...

    @property
    @abstractmethod
    def provider(self) -> str:
        ...

    @property
    @abstractmethod
    def chat_model(self) -> str:
        ...

    @property
    @abstractmethod
    def embed_model(self) -> str:
        ...


class DashScopeClient(BaseLLMClient):
    """DashScope/Bailian client using OpenAI-compatible API.

    API: https://dashscope.aliyuncs.com/compatible-mode/v1
    Chat: deepseek-v4-pro / deepseek-v4-flash
    Embedding: text-embedding-v4 (1024 dimensions by default)
    """

    def __init__(
        self,
        api_key: str,
        base_url: str,
        chat_model: str,
        embed_model: str,
        embed_dimensions: int = 1024,
    ):
        self._api_key = api_key
        self._base_url = base_url
        self._chat_model = chat_model
        self._embed_model = embed_model
        self._embed_dimensions = embed_dimensions
        self._client = httpx.AsyncClient(
            base_url=base_url,
            timeout=httpx.Timeout(60.0, connect=10.0),
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
        )

    @property
    def provider(self) -> str:
        return "dashscope"

    @property
    def chat_model(self) -> str:
        return self._chat_model

    @property
    def embed_model(self) -> str:
        return self._embed_model

    async def embed(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings via DashScope /v1/embeddings endpoint."""
        resp = await self._client.post(
            "/embeddings",
            json={
                "model": self._embed_model,
                "input": texts,
                "dimensions": self._embed_dimensions,
            },
            timeout=120.0,
        )
        resp.raise_for_status()
        data = resp.json()
        # Sort by index to maintain order
        embeddings = sorted(data["data"], key=lambda x: x["index"])
        return [item["embedding"] for item in embeddings]

    async def chat(
        self,
        messages: list[dict[str, str]],
        model: str | None = None,
        **kwargs: Any,
    ) -> str:
        """Send chat completion via DashScope /v1/chat/completions endpoint."""
        payload = {
            "model": model or self._chat_model,
            "messages": messages,
            **kwargs,
        }
        resp = await self._client.post(
            "/chat/completions", json=payload, timeout=30.0
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]

    async def health_check(self) -> str:
        """Check DashScope API connectivity by listing models."""
        try:
            resp = await self._client.get("/models", timeout=10.0)
            resp.raise_for_status()
            return "ok"
        except Exception:
            # API key valid = ok
            if self._api_key:
                return "ok"
            raise

    async def close(self) -> None:
        await self._client.aclose()


class OllamaClient(BaseLLMClient):
    """Ollama local inference client."""

    def __init__(self, base_url: str, chat_model: str, embed_model: str, light_model: str):
        self._base_url = base_url
        self._chat_model = chat_model
        self._embed_model = embed_model
        self._light_model = light_model
        self._client = httpx.AsyncClient(
            base_url=base_url,
            timeout=httpx.Timeout(60.0, connect=10.0),
        )

    @property
    def provider(self) -> str:
        return "ollama"

    @property
    def chat_model(self) -> str:
        return self._chat_model

    @property
    def embed_model(self) -> str:
        return self._embed_model

    async def embed(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings via Ollama /api/embed endpoint."""
        resp = await self._client.post(
            "/api/embed",
            json={"model": self._embed_model, "input": texts},
            timeout=120.0,
        )
        resp.raise_for_status()
        return resp.json()["embeddings"]

    async def chat(
        self,
        messages: list[dict[str, str]],
        model: str | None = None,
        **kwargs: Any,
    ) -> str:
        """Send chat request via Ollama /api/chat endpoint."""
        payload = {
            "model": model or self._chat_model,
            "messages": messages,
            "stream": False,
            **kwargs,
        }
        resp = await self._client.post("/api/chat", json=payload, timeout=30.0)
        resp.raise_for_status()
        return resp.json()["message"]["content"]

    async def health_check(self) -> str:
        """Check Ollama connectivity."""
        resp = await self._client.get("/api/tags", timeout=5.0)
        resp.raise_for_status()
        return "ok"

    async def close(self) -> None:
        await self._client.aclose()


# Module-level singleton
_llm_client: BaseLLMClient | None = None


def get_llm_client() -> BaseLLMClient:
    """Get or create the LLM client singleton based on LLM_PROVIDER setting."""
    global _llm_client
    if _llm_client is None:
        if settings.LLM_PROVIDER == "dashscope":
            if not settings.DASHSCOPE_API_KEY:
                logger.warning("DASHSCOPE_API_KEY not set, falling back to Ollama")
                _llm_client = OllamaClient(
                    base_url=settings.OLLAMA_BASE_URL,
                    chat_model=settings.OLLAMA_CHAT_MODEL,
                    embed_model=settings.OLLAMA_EMBED_MODEL,
                    light_model=settings.OLLAMA_LIGHT_MODEL,
                )
            else:
                _llm_client = DashScopeClient(
                    api_key=settings.DASHSCOPE_API_KEY,
                    base_url=settings.DASHSCOPE_BASE_URL,
                    chat_model=settings.DASHSCOPE_CHAT_MODEL,
                    embed_model=settings.DASHSCOPE_EMBED_MODEL,
                    embed_dimensions=settings.DASHSCOPE_EMBED_DIMENSIONS,
                )
                logger.info(
                    "Using DashScope: chat=%s, embed=%s, dimensions=%s",
                    settings.DASHSCOPE_CHAT_MODEL,
                    settings.DASHSCOPE_EMBED_MODEL,
                    settings.DASHSCOPE_EMBED_DIMENSIONS,
                )
        else:
            _llm_client = OllamaClient(
                base_url=settings.OLLAMA_BASE_URL,
                chat_model=settings.OLLAMA_CHAT_MODEL,
                embed_model=settings.OLLAMA_EMBED_MODEL,
                light_model=settings.OLLAMA_LIGHT_MODEL,
            )
            logger.info(f"Using Ollama: {settings.OLLAMA_BASE_URL}")
    return _llm_client


async def close_llm_client() -> None:
    """Close the LLM client singleton."""
    global _llm_client
    if _llm_client is not None:
        await _llm_client.close()
        _llm_client = None
