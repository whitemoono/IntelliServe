"""
Text chunking and embedding pipeline for knowledge base indexing.
"""

import re
from datetime import datetime, timezone
from uuid import uuid4


def chunk_text(
    text: str,
    chunk_size: int = 512,
    overlap: int = 50,
) -> list[str]:
    """Split text into chunks of approximately chunk_size tokens.

    Uses paragraph and H2 heading boundaries where possible.
    For Chinese text, approximate 1 token ≈ 2 characters.

    Args:
        text: Markdown text to chunk.
        chunk_size: Target chunk size in tokens (~2 chars per token for Chinese).
        overlap: Number of tokens to overlap between consecutive chunks.

    Returns:
        List of text chunks.
    """
    if not text or not text.strip():
        return []

    # Approximate character limits
    char_limit = chunk_size * 2  # ~2 Chinese chars per token
    overlap_chars = overlap * 2

    # Step 1: Split by H2 headings (## )
    sections = re.split(r"(?=^## )", text, flags=re.MULTILINE)

    chunks = []
    for section in sections:
        section = section.strip()
        if not section:
            continue

        # Step 2: Split by paragraphs within each section
        paragraphs = re.split(r"\n\s*\n", section)

        current_chunk = ""
        for para in paragraphs:
            para = para.strip()
            if not para:
                continue

            # If adding this paragraph exceeds limit, save current and start new
            if current_chunk and len(current_chunk) + len(para) > char_limit:
                chunks.append(current_chunk.strip())
                # Add overlap from end of previous chunk
                overlap_text = current_chunk[-overlap_chars:] if len(current_chunk) > overlap_chars else ""
                current_chunk = overlap_text + "\n\n" + para
            else:
                current_chunk = current_chunk + "\n\n" + para if current_chunk else para

        # Don't forget the last chunk
        if current_chunk.strip():
            chunks.append(current_chunk.strip())

    # Step 3: Merge very small chunks
    merged = []
    for chunk in chunks:
        if merged and len(merged[-1]) < char_limit // 2 and len(chunk) < char_limit // 2:
            merged[-1] = merged[-1] + "\n\n" + chunk
        else:
            merged.append(chunk)

    return merged if merged else [text.strip()]


def build_embed_texts(chunks: list[str]) -> list[str]:
    """Prepare chunks for the configured embedding provider.

    DashScope text-embedding-v4 works best with the original text. Private bge
    deployments can add an instruction prefix at the caller/config layer if needed.
    """
    return chunks


def build_qdrant_points(
    article_id: str,
    title: str,
    category: str,
    tags: list[str],
    chunks: list[str],
    vectors: list[list[float]],
) -> list[dict]:
    """Build Qdrant point dicts from chunks and their embeddings.

    Returns list of dicts with id, vector, and payload keys.
    """
    points = []
    now = datetime.now(timezone.utc).isoformat()

    for i, (chunk, vector) in enumerate(zip(chunks, vectors)):
        points.append(
            {
                "id": str(uuid4()),
                "vector": vector,
                "payload": {
                    "kb_article_id": article_id,
                    "chunk_index": i,
                    "content": chunk,
                    "title": title,
                    "category": category,
                    "tags": tags,
                    "created_at": now,
                },
            }
        )

    return points
