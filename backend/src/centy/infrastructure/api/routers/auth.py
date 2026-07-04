from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, EmailStr

from centy.application.auth.commands import (
    LoginCommand,
    LogoutCommand,
    RefreshTokenCommand,
)
from centy.application.auth.handlers import (
    LoginHandler,
    LogoutHandler,
    RefreshTokenHandler,
)
from centy.application.auth.password_reset_handlers import (
    ForgotPasswordCommand,
    ForgotPasswordHandler,
    ResetPasswordCommand,
    ResetPasswordHandler,
    ValidateResetTokenHandler,
)
from centy.domain.shared.exceptions import (
    AuthorizationError,
    BusinessRuleViolationError,
    NotFoundError,
)
from centy.infrastructure.api.dependencies import (
    CurrentUser,
    get_current_user,
    get_forgot_password_handler,
    get_login_handler,
    get_logout_handler,
    get_refresh_handler,
    get_reset_password_handler,
    get_validate_reset_token_handler,
)
from centy.infrastructure.config.settings import Settings, get_settings

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user_id: str
    email: str
    role: str


class RefreshRequest(BaseModel):
    refresh_token: str


class MeResponse(BaseModel):
    user_id: str
    email: str
    role: str
    tenant_id: str


@router.post("/login", response_model=TokenResponse)
async def login(
    body: LoginRequest,
    handler: LoginHandler = Depends(get_login_handler),
) -> TokenResponse:
    settings = get_settings()
    try:
        import uuid

        from centy.domain.shared.value_objects import TenantId

        result = await handler.handle(
            LoginCommand(
                email=body.email,
                password=body.password,
                tenant_id=TenantId(
                    uuid.UUID(settings.tenant_id_default)
                    if _is_uuid(settings.tenant_id_default)
                    else uuid.uuid5(uuid.NAMESPACE_DNS, settings.tenant_id_default)
                ),
            )
        )
    except AuthorizationError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    return TokenResponse(
        access_token=result.access_token,
        refresh_token=result.refresh_token,
        user_id=result.user_id,
        email=result.email,
        role=result.role,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    body: RefreshRequest,
    handler: RefreshTokenHandler = Depends(get_refresh_handler),
) -> TokenResponse:
    try:
        result = await handler.handle(
            RefreshTokenCommand(refresh_token=body.refresh_token)
        )
    except AuthorizationError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)
        ) from exc
    return TokenResponse(
        access_token=result.access_token,
        refresh_token=result.refresh_token,
        user_id="",
        email="",
        role="",
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    body: RefreshRequest,
    handler: LogoutHandler = Depends(get_logout_handler),
    _: CurrentUser = Depends(get_current_user),
) -> Response:
    await handler.handle(LogoutCommand(refresh_token=body.refresh_token))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me", response_model=MeResponse)
async def me(current_user: CurrentUser = Depends(get_current_user)) -> MeResponse:
    return MeResponse(
        user_id=current_user.user_id,
        email=current_user.email,
        role=current_user.role,
        tenant_id=current_user.tenant_id,
    )


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


@router.post("/forgot-password", status_code=status.HTTP_204_NO_CONTENT)
async def forgot_password(
    body: ForgotPasswordRequest,
    handler: ForgotPasswordHandler = Depends(get_forgot_password_handler),
    settings: Settings = Depends(get_settings),
) -> Response:
    await handler.handle(
        ForgotPasswordCommand(
            email=str(body.email),
            tenant_id=settings.tenant_id_default,
            frontend_base_url=settings.frontend_base_url,
        )
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/reset-password/validate")
async def validate_reset_token(
    token: str,
    handler: ValidateResetTokenHandler = Depends(get_validate_reset_token_handler),
) -> dict[str, object]:
    result = await handler.handle(token)
    return {"valid": result.valid, "email": result.email}


@router.post("/reset-password", status_code=status.HTTP_204_NO_CONTENT)
async def reset_password(
    body: ResetPasswordRequest,
    handler: ResetPasswordHandler = Depends(get_reset_password_handler),
) -> Response:
    try:
        await handler.handle(
            ResetPasswordCommand(token=body.token, new_password=body.new_password)
        )
    except (BusinessRuleViolationError, NotFoundError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _is_uuid(value: str) -> bool:
    import uuid

    try:
        uuid.UUID(value)
        return True
    except ValueError:
        return False
