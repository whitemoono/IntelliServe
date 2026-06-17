"""
User model for authentication and authorization.
"""

from datetime import datetime
from uuid import UUID

from sqlalchemy import Boolean, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from api.core.database import Base, TimestampMixin, UUIDMixin


class User(Base, UUIDMixin, TimestampMixin):
    """User account model."""

    __tablename__ = "users"

    employee_id: Mapped[str] = mapped_column(
        String(32), unique=True, nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    email: Mapped[str | None] = mapped_column(String(256), unique=True)
    hashed_password: Mapped[str | None] = mapped_column(String(256))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    role: Mapped[str] = mapped_column(String(32), default="user")  # admin/engineer/user
    dingtalk_id: Mapped[str | None] = mapped_column(String(128), index=True)
    wechat_work_id: Mapped[str | None] = mapped_column(String(128))
    position: Mapped[str | None] = mapped_column(String(128))
    engineer_skills: Mapped[list] = mapped_column(JSONB, default=list)
    current_workload: Mapped[int] = mapped_column(Integer, default=0)

    def __repr__(self) -> str:
        return f"<User {self.employee_id} ({self.role})>"
