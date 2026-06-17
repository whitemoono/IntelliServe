"""
Custom exceptions and global exception handlers for standardized error responses.
"""

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse


class AppException(HTTPException):
    """Base application exception with structured error response."""

    def __init__(
        self,
        status_code: int,
        detail: str,
        code: str,
        params: dict | None = None,
    ):
        self.error_code = code
        self.error_params = params or {}
        super().__init__(
            status_code=status_code,
            detail={"detail": detail, "code": code, "params": self.error_params},
        )


class NotFoundException(AppException):
    """Resource not found exception."""

    def __init__(self, resource: str, resource_id: str):
        super().__init__(
            status_code=404,
            detail=f"{resource} 未找到",
            code=f"{resource.upper()}_NOT_FOUND",
            params={"id": resource_id},
        )


class UnauthorizedException(AppException):
    """Authentication required exception."""

    def __init__(self, detail: str = "请先登录"):
        super().__init__(status_code=401, detail=detail, code="UNAUTHORIZED")


class ForbiddenException(AppException):
    """Insufficient permissions exception."""

    def __init__(self, detail: str = "权限不足"):
        super().__init__(status_code=403, detail=detail, code="FORBIDDEN")


class BadRequestException(AppException):
    """Bad request exception."""

    def __init__(self, detail: str, code: str = "BAD_REQUEST", params: dict | None = None):
        super().__init__(status_code=400, detail=detail, code=code, params=params)


class ConflictException(AppException):
    """Resource conflict exception."""

    def __init__(self, detail: str, code: str = "CONFLICT"):
        super().__init__(status_code=409, detail=detail, code=code)


def register_exception_handlers(app: FastAPI) -> None:
    """Register global exception handlers on the FastAPI app."""

    @app.exception_handler(AppException)
    async def app_exception_handler(request: Request, exc: AppException):
        return JSONResponse(
            status_code=exc.status_code,
            content=exc.detail if isinstance(exc.detail, dict) else {"detail": exc.detail},
        )

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail, "code": "HTTP_ERROR"},
        )

    @app.exception_handler(Exception)
    async def general_exception_handler(request: Request, exc: Exception):
        return JSONResponse(
            status_code=500,
            content={"detail": "服务器内部错误", "code": "INTERNAL_ERROR"},
        )
