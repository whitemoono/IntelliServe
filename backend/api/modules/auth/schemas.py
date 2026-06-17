"""
Pydantic schemas for auth module.
"""

from datetime import datetime
from typing import Generic, TypeVar
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr

T = TypeVar("T")


class UserCreate(BaseModel):
    """Schema for creating a new user."""

    employee_id: str
    name: str
    email: str | None = None
    password: str
    role: str = "user"
    position: str | None = None
    dingtalk_id: str | None = None
    engineer_skills: list[str] = []


class UserUpdate(BaseModel):
    """Schema for updating a user."""

    name: str | None = None
    email: str | None = None
    role: str | None = None
    position: str | None = None
    dingtalk_id: str | None = None
    is_active: bool | None = None
    engineer_skills: list[str] | None = None


class UserResponse(BaseModel):
    """Schema for user response."""

    id: UUID
    employee_id: str
    name: str
    email: str | None
    role: str
    is_active: bool
    is_verified: bool
    position: str | None
    dingtalk_id: str | None
    engineer_skills: list
    current_workload: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LoginRequest(BaseModel):
    """Schema for login request."""

    username: str  # employee_id
    password: str


class TokenResponse(BaseModel):
    """Schema for token response."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse


class RefreshRequest(BaseModel):
    """Schema for token refresh request."""

    refresh_token: str


class PaginatedResponse(BaseModel, Generic[T]):
    """Generic paginated response wrapper."""

    items: list[T]
    total: int
    page: int
    page_size: int
    pages: int
