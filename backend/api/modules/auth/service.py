"""
Auth service - business logic for user management and authentication.
"""

from math import ceil
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.core.exceptions import (
    BadRequestException,
    ConflictException,
    NotFoundException,
)
from api.core.security import hash_password, verify_password
from api.modules.auth.models import User
from api.modules.auth.schemas import UserCreate, UserUpdate


class AuthService:
    """Service for user management and authentication."""

    async def authenticate(
        self, employee_id: str, password: str, db: AsyncSession
    ) -> User | None:
        """Authenticate user by employee_id and password. Returns User or None."""
        result = await db.execute(select(User).where(User.employee_id == employee_id))
        user = result.scalar_one_or_none()

        if user is None:
            return None
        if not user.is_active:
            return None
        if not user.hashed_password:
            return None
        if not verify_password(password, user.hashed_password):
            return None

        return user

    async def create_user(self, data: UserCreate, db: AsyncSession) -> User:
        """Create a new user account."""
        # Check for duplicate employee_id
        existing = await db.execute(
            select(User).where(User.employee_id == data.employee_id)
        )
        if existing.scalar_one_or_none():
            raise ConflictException("工号已存在", code="EMPLOYEE_ID_EXISTS")

        # Check for duplicate email if provided
        if data.email:
            existing_email = await db.execute(
                select(User).where(User.email == data.email)
            )
            if existing_email.scalar_one_or_none():
                raise ConflictException("邮箱已被使用", code="EMAIL_EXISTS")

        user = User(
            employee_id=data.employee_id,
            name=data.name,
            email=data.email,
            hashed_password=hash_password(data.password),
            role=data.role,
            position=data.position,
            dingtalk_id=data.dingtalk_id,
            engineer_skills=data.engineer_skills,
        )
        db.add(user)
        await db.flush()
        await db.refresh(user)
        return user

    async def get_user(self, user_id: UUID, db: AsyncSession) -> User:
        """Get user by ID. Raises NotFoundException if not found."""
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if user is None:
            raise NotFoundException("用户", str(user_id))
        return user

    async def get_user_by_dingtalk_id(
        self, dingtalk_id: str, db: AsyncSession
    ) -> User | None:
        """Get user by DingTalk ID. Returns None if not found."""
        result = await db.execute(
            select(User).where(User.dingtalk_id == dingtalk_id)
        )
        return result.scalar_one_or_none()

    async def list_users(
        self,
        page: int = 1,
        page_size: int = 20,
        role: str | None = None,
        is_active: bool | None = None,
        q: str | None = None,
        db: AsyncSession = None,
    ) -> tuple[list[User], int]:
        """List users with pagination and filters."""
        query = select(User)

        if role:
            query = query.where(User.role == role)
        if is_active is not None:
            query = query.where(User.is_active == is_active)
        if q:
            query = query.where(
                User.name.ilike(f"%{q}%") | User.employee_id.ilike(f"%{q}%")
            )

        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total = (await db.execute(count_query)).scalar()

        # Apply pagination
        query = query.order_by(User.created_at.desc())
        query = query.offset((page - 1) * page_size).limit(page_size)

        result = await db.execute(query)
        users = list(result.scalars().all())

        return users, total

    async def update_user(
        self, user_id: UUID, data: UserUpdate, db: AsyncSession
    ) -> User:
        """Update user fields."""
        user = await self.get_user(user_id, db)

        update_data = data.model_dump(exclude_unset=True)
        if "password" in update_data:
            update_data["hashed_password"] = hash_password(update_data.pop("password"))

        for field, value in update_data.items():
            setattr(user, field, value)

        await db.flush()
        await db.refresh(user)
        return user

    async def deactivate_user(self, user_id: UUID, db: AsyncSession) -> User:
        """Soft delete a user by setting is_active=False."""
        user = await self.get_user(user_id, db)
        user.is_active = False
        await db.flush()
        await db.refresh(user)
        return user


# Module-level singleton
auth_service = AuthService()
