"""
Celery task dispatch wrappers for knowledge base operations.
Keeps the service layer decoupled from Celery internals.
"""


def dispatch_index_article(
    article_id: str,
    title: str,
    content: str,
    category: str,
    tags: list[str],
) -> None:
    """Dispatch Celery task to chunk, embed, and index an article."""
    try:
        from worker.kb_tasks import index_article

        index_article.delay(article_id, title, content, category, tags or [])
    except Exception as e:
        import logging

        logger = logging.getLogger(__name__)
        logger.warning(f"Failed to dispatch index_article task: {e}")


def dispatch_delete_vectors(article_id: str) -> None:
    """Dispatch Celery task to delete article vectors from Qdrant."""
    try:
        from worker.kb_tasks import delete_article_vectors

        delete_article_vectors.delay(article_id)
    except Exception as e:
        import logging

        logger = logging.getLogger(__name__)
        logger.warning(f"Failed to dispatch delete_article_vectors task: {e}")
