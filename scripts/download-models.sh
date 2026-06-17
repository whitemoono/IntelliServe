#!/bin/bash
# =============================================================================
# Download AI Models for IntelliServe IT Suite
# =============================================================================
set -e

OLLAMA_URL="${OLLAMA_BASE_URL:-http://localhost:11434}"
CHAT_MODEL="${OLLAMA_CHAT_MODEL:-qwen2.5:7b-instruct-q4_K_M}"
EMBED_MODEL="${OLLAMA_EMBED_MODEL:-bge-large-zh-v1.5}"

echo "Waiting for Ollama to be ready..."
until curl -sf "$OLLAMA_URL/api/tags" > /dev/null 2>&1; do
    echo "  Ollama not ready, retrying in 5s..."
    sleep 5
done
echo "Ollama is ready."

echo "Pulling chat model: $CHAT_MODEL"
ollama pull "$CHAT_MODEL"

echo "Pulling embedding model: $EMBED_MODEL"
ollama pull "$EMBED_MODEL"

echo "All models downloaded successfully."
