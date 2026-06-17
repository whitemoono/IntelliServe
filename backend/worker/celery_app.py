"""
Celery application configuration for IntelliServe IT Suite.
"""

from celery import Celery

from api.core.config import settings

# Create Celery app
celery_app = Celery("intelliserve")

# Configuration
celery_app.conf.update(
    # Broker and result backend
    broker_url=settings.REDIS_CELERY_BROKER_URL,
    result_backend=settings.REDIS_URL,
    # Serialization
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    # Timezone
    timezone="Asia/Shanghai",
    enable_utc=True,
    # Task execution
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    # Result expiration
    result_expires=3600,  # 1 hour
    # Task queues
    task_queues={
        "default": {"exchange": "default", "routing_key": "default"},
        "kb": {"exchange": "kb", "routing_key": "kb"},
        "embedding": {"exchange": "embedding", "routing_key": "embedding"},
    },
    task_default_queue="default",
    # Task routes
    task_routes={
        "kb_tasks.*": {"queue": "kb"},
    },
)

# Auto-discover tasks from worker modules
celery_app.autodiscover_tasks(["worker"])
celery_app.conf.imports = ("worker.kb_tasks",)

# Import task modules explicitly so task names are registered before the worker
# starts consuming messages. This keeps dispatch wrappers and Celery in lockstep.
import worker.kb_tasks  # noqa: E402,F401
