"""
Application configuration via Pydantic Settings.
All settings are loaded from environment variables or .env file.
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Database (PostgreSQL + TimescaleDB)
    DB_HOST: str = "localhost"
    DB_PORT: int = 5432
    DB_USER: str = "intelliserve"
    DB_PASSWORD: str = "CHANGE_ME"
    DB_NAME: str = "intelliserve"
    DB_POOL_SIZE: int = 20
    DB_MAX_OVERFLOW: int = 10

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_CELERY_BROKER_URL: str = "redis://localhost:6379/1"

    # JWT Authentication
    JWT_SECRET_KEY: str = "CHANGE_ME_GENERATE_WITH_openssl_rand_hex_32"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # LLM Provider: "dashscope" (Alibaba Cloud Bailian / OpenAI-compatible gateway)
    # or "ollama" (local fallback)
    LLM_PROVIDER: str = "dashscope"

    # DashScope API (Alibaba Cloud Bailian - default)
    DASHSCOPE_API_KEY: str = ""
    DASHSCOPE_BASE_URL: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    DASHSCOPE_CHAT_MODEL: str = "deepseek-v4-pro"
    DASHSCOPE_EMBED_MODEL: str = "text-embedding-v4"
    DASHSCOPE_EMBED_DIMENSIONS: int = 1024

    # Ollama (local - optional)
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_CHAT_MODEL: str = "deepseek-r1:32b"
    OLLAMA_EMBED_MODEL: str = "bge-m3"
    OLLAMA_LIGHT_MODEL: str = "deepseek-r1:8b"

    # Qdrant (Vector Database)
    QDRANT_URL: str = "http://localhost:6333"
    QDRANT_COLLECTION: str = "kb_chunks"
    QDRANT_VECTOR_SIZE: int = 1024

    # MinIO (Object Storage)
    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_USER: str = "minioadmin"
    MINIO_PASSWORD: str = "CHANGE_ME"
    MINIO_BUCKET: str = "intelliserve"
    MINIO_SECURE: bool = False

    # DingTalk
    DINGTALK_CLIENT_ID: str = ""
    DINGTALK_CLIENT_SECRET: str = ""

    # Application
    APP_NAME: str = "IntelliServe IT Suite"
    APP_ENV: str = "development"
    LOG_LEVEL: str = "INFO"

    @property
    def database_url(self) -> str:
        """Async SQLAlchemy database URL."""
        return (
            f"postgresql+asyncpg://{self.DB_USER}:{self.DB_PASSWORD}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        )

    @property
    def database_url_sync(self) -> str:
        """Sync database URL for Alembic migrations."""
        return (
            f"postgresql://{self.DB_USER}:{self.DB_PASSWORD}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        )

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
