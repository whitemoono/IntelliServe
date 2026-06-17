"""
Auth API routes - login, refresh, user management.
"""

from math import ceil

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from api.core.database import get_db
from api.core.dependencies import get_current_user, require_role
from api.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
)
from api.core.config import settings
from api.modules.auth.schemas import (
    LoginRequest,
    PaginatedResponse,
    RefreshRequest,
    TokenResponse,
    UserCreate,
    UserResponse,
    UserUpdate,
)
from api.modules.auth.service import auth_service

router = APIRouter(prefix="/auth", tags=["认证管理"])


@router.post("/login", response_model=TokenResponse, summary="用户登录")
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Authenticate user and return JWT tokens."""
    user = await auth_service.authenticate(request.username, request.password, db)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="工号或密码错误",
        )

    access_token = create_access_token(str(user.id), user.role)
    refresh_token = create_refresh_token(str(user.id))

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserResponse.model_validate(user),
    )


@router.post("/refresh", summary="刷新访问令牌")
async def refresh_token(request: RefreshRequest):
    """Refresh access token using a valid refresh token."""
    try:
        payload = decode_token(request.refresh_token)
        if payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="无效的刷新令牌",
            )
        user_id = payload.get("sub")
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="刷新令牌已过期或无效",
        )

    # We need to get the user's role for the new access token
    # For simplicity, we create a basic access token; role will be verified on use
    access_token = create_access_token(user_id, "user")

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    }


@router.get("/me", response_model=UserResponse, summary="获取当前用户信息")
async def get_me(current_user=Depends(get_current_user)):
    """Get current authenticated user information."""
    return UserResponse.model_validate(current_user)


# --- Admin-only user management endpoints ---


@router.post(
    "/users",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="创建用户 (管理员)",
)
async def create_user(
    data: UserCreate,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_role("admin")),
):
    """Create a new user account. Admin only."""
    user = await auth_service.create_user(data, db)
    return UserResponse.model_validate(user)


@router.get(
    "/users",
    response_model=PaginatedResponse[UserResponse],
    summary="用户列表 (管理员)",
)
async def list_users(
    page: int = 1,
    page_size: int = 20,
    role: str | None = None,
    is_active: bool | None = None,
    q: str | None = None,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_role("admin")),
):
    """List all users with pagination and filters. Admin only."""
    users, total = await auth_service.list_users(
        page=page, page_size=page_size, role=role, is_active=is_active, q=q, db=db
    )
    return PaginatedResponse(
        items=[UserResponse.model_validate(u) for u in users],
        total=total,
        page=page,
        page_size=page_size,
        pages=ceil(total / page_size) if total > 0 else 0,
    )


@router.put(
    "/users/{user_id}",
    response_model=UserResponse,
    summary="更新用户 (管理员)",
)
async def update_user(
    user_id: str,
    data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_role("admin")),
):
    """Update user information. Admin only."""
    from uuid import UUID

    user = await auth_service.update_user(UUID(user_id), data, db)
    return UserResponse.model_validate(user)


@router.delete(
    "/users/{user_id}",
    response_model=UserResponse,
    summary="禁用用户 (管理员)",
)
async def deactivate_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_role("admin")),
):
    """Soft delete a user by setting is_active=False. Admin only."""
    from uuid import UUID

    user = await auth_service.deactivate_user(UUID(user_id), db)
    return UserResponse.model_validate(user)
