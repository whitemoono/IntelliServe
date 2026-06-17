"""
IntelliServe IT Suite - FastAPI Application Entry Point.

Assembles all modules, configures middleware, and manages application lifecycle.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.core.config import settings
from api.core.exceptions import register_exception_handlers

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL, logging.INFO),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle manager - startup and shutdown events."""
    # === Startup ===
    logger.info(f"Starting {settings.APP_NAME} ({settings.APP_ENV})")

    # Auto-run doc builder to keep website documentation synchronized
    try:
        import os
        import sys

        current_dir = os.path.dirname(os.path.abspath(__file__))
        workspace_candidates = [
            os.path.abspath(os.path.join(current_dir, "..", "..")),
            os.path.abspath(os.path.join(current_dir, "..")),
        ]
        workspace_root = next(
            (
                candidate
                for candidate in workspace_candidates
                if os.path.exists(os.path.join(candidate, "scripts", "build_docs.py"))
            ),
            workspace_candidates[0],
        )
        if workspace_root not in sys.path:
            sys.path.insert(0, workspace_root)
        from scripts.build_docs import build
        build()
        logger.info("Documentation builder synchronized successfully at startup")
    except Exception as e:
        logger.warning(f"Documentation builder failed at startup (non-fatal): {e}")

    # 0. Auto-create database tables
    try:
        from api.core.database import Base, async_session_factory, engine
        from api.modules.auth.models import User  # noqa: F401
        from api.modules.knowledge.models import KnowledgeBase, KbRevision  # noqa: F401
        from api.modules.chatbot.models import ChatMessage  # noqa: F401

        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables ensured")

        # Auto-create default admin if not exists
        from sqlalchemy import select
        from api.core.security import hash_password

        async with async_session_factory() as db:
            result = await db.execute(select(User).where(User.employee_id == "admin"))
            if result.scalar_one_or_none() is None:
                admin = User(
                    employee_id="admin",
                    name="系统管理员",
                    email="admin@intelliserve.local",
                    hashed_password=hash_password("admin123"),
                    role="admin",
                    is_active=True,
                    is_verified=True,
                )
                db.add(admin)
                await db.commit()
                logger.info("Default admin created: admin / admin123")
            else:
                logger.info("Admin user already exists")
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")

    # 1. Initialize Qdrant collection
    try:
        from api.common.qdrant_client import get_qdrant_client

        qdrant = get_qdrant_client()
        await qdrant.ensure_collection()
        logger.info("Qdrant collection initialized")
    except Exception as e:
        logger.warning(f"Qdrant initialization failed (non-fatal): {e}")

    # 2. Verify LLM connectivity
    try:
        from api.common.llm_client import get_llm_client

        llm = get_llm_client()
        await llm.health_check()
        logger.info(f"LLM service connected: {llm.provider} ({llm.chat_model})")
    except Exception as e:
        logger.warning(f"LLM health check failed (non-fatal): {e}")

    # 3. Start DingTalk Stream adapter
    try:
        from api.modules.chatbot.service import get_chatbot_service

        chatbot = get_chatbot_service()
        chatbot.start_dingtalk()
        logger.info("DingTalk adapter started")
    except Exception as e:
        logger.warning(f"DingTalk adapter start failed (non-fatal): {e}")

    logger.info("Application startup complete")
    yield

    # === Shutdown ===
    logger.info("Shutting down application...")

    # Close LLM client
    try:
        from api.common.llm_client import close_llm_client

        await close_llm_client()
    except Exception:
        pass

    # Close Qdrant client
    try:
        from api.common.qdrant_client import close_qdrant_client

        await close_qdrant_client()
    except Exception:
        pass

    # Dispose database engine
    try:
        from api.core.database import engine

        await engine.dispose()
    except Exception:
        pass

    logger.info("Shutdown complete")


# Create FastAPI application
app = FastAPI(
    title="IntelliServe IT Suite",
    description="AI 驱动的 IT 运维智能平台",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/api/v1/docs",
    redoc_url="/api/v1/redoc",
    openapi_url="/api/v1/openapi.json",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register global exception handlers
register_exception_handlers(app)

# --- Mount API routers ---
from api.modules.auth.routes import router as auth_router
from api.modules.knowledge.routes import router as kb_router
from api.modules.chatbot.routes import router as chatbot_router

app.include_router(auth_router, prefix="/api/v1")
app.include_router(kb_router, prefix="/api/v1")
app.include_router(chatbot_router, prefix="/api/v1")


# Health check endpoint
@app.get("/api/v1/health", tags=["系统"])
async def health_check():
    """Health check endpoint for load balancers and monitoring."""
    return {
        "status": "ok",
        "version": "0.1.0",
        "service": settings.APP_NAME,
    }


@app.get("/api/v1/config/status", tags=["系统"])
async def config_status():
    """Return current LLM provider and model configuration."""
    import httpx

    from api.common.llm_client import get_llm_client
    from api.core.config import settings

    llm = get_llm_client()
    llm_status = "connected"
    try:
        await llm.health_check()
    except Exception:
        llm_status = "disconnected"

    qdrant_status = "disconnected"
    kb_points_count = 0
    try:
        async with httpx.AsyncClient(base_url=settings.QDRANT_URL, timeout=5.0) as client:
            resp = await client.get(f"/collections/{settings.QDRANT_COLLECTION}")
            resp.raise_for_status()
            collection = resp.json().get("result", {})
            qdrant_status = collection.get("status", "connected")
            kb_points_count = int(collection.get("points_count") or 0)
    except Exception:
        qdrant_status = "disconnected"

    worker_status = "disconnected"
    try:
        from worker.celery_app import celery_app

        inspect = celery_app.control.inspect(timeout=2.0)
        if inspect.ping():
            worker_status = "connected"
    except Exception:
        worker_status = "disconnected"

    return {
        "llm_provider": llm.provider,
        "chat_model": llm.chat_model,
        "embed_model": llm.embed_model,
        "llm_status": llm_status,
        "qdrant_status": qdrant_status,
        "worker_status": worker_status,
        "kb_points_count": kb_points_count,
        "app_env": settings.APP_ENV,
    }
