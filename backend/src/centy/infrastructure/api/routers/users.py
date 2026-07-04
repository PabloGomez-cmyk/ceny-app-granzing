import uuid
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr

from centy.application.users.commands import (
    AssignRoleCommand,
    CreateUserCommand,
    DeactivateUserCommand,
    UpdateUserCommand,
)
from centy.application.users.handlers import (
    AssignRoleHandler,
    CreateUserHandler,
    DeactivateUserHandler,
    GetUserHandler,
    ListUsersHandler,
    UpdateUserHandler,
)
from centy.application.users.queries import GetUserByIdQuery, ListUsersQuery
from centy.domain.shared.exceptions import ConflictError, NotFoundError
from centy.domain.shared.value_objects import TenantId
from centy.domain.users.entities import Role
from centy.infrastructure.api.dependencies import (
    CurrentUser,
    get_assign_role_handler,
    get_create_user_handler,
    get_current_user,
    get_deactivate_handler,
    get_list_users_handler,
    get_update_user_handler,
    get_user_handler,
    require_admin,
)
from centy.infrastructure.config.settings import get_settings

router = APIRouter(prefix="/users", tags=["users"])


class CreateUserRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: Role = Role.OPERATOR


class AssignRoleRequest(BaseModel):
    role: Role


class UpdateUserRequest(BaseModel):
    email: EmailStr | None = None
    full_name: str | None = None
    role: Role | None = None
    is_active: bool | None = None
    password: str | None = None
    company_name: str | None = None
    company_logo_url: str | None = None
    company_street: str | None = None
    company_city: str | None = None
    company_province: str | None = None
    company_postal_code: str | None = None
    company_cuit: str | None = None
    company_color_primary: str | None = None
    company_color_secondary: str | None = None
    default_commercial_conditions: str | None = None


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    is_active: bool
    company_name: str | None = None
    company_logo_url: str | None = None
    company_street: str | None = None
    company_city: str | None = None
    company_province: str | None = None
    company_postal_code: str | None = None
    company_cuit: str | None = None
    company_color_primary: str | None = None
    company_color_secondary: str | None = None
    default_commercial_conditions: str | None = None


def _resolve_tenant(settings_tenant: str) -> TenantId:
    try:
        return TenantId(UUID(settings_tenant))
    except ValueError:
        return TenantId(uuid.uuid5(uuid.NAMESPACE_DNS, settings_tenant))


@router.get("", response_model=list[UserResponse])
async def list_users(
    handler: ListUsersHandler = Depends(get_list_users_handler),
    current_user: CurrentUser = Depends(require_admin),
) -> list[UserResponse]:
    settings = get_settings()
    results = await handler.handle(
        ListUsersQuery(tenant_id=_resolve_tenant(settings.tenant_id_default))
    )
    return [
        UserResponse(
            id=str(r.user_id),
            email=r.email,
            full_name=r.full_name,
            role=r.role,
            is_active=r.is_active,
            company_name=r.company_name,
            company_logo_url=r.company_logo_url,
            company_street=r.company_street,
            company_city=r.company_city,
            company_province=r.company_province,
            company_postal_code=r.company_postal_code,
            company_cuit=r.company_cuit,
            company_color_primary=r.company_color_primary,
            company_color_secondary=r.company_color_secondary,
            default_commercial_conditions=r.default_commercial_conditions,
        )
        for r in results
    ]


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    body: CreateUserRequest,
    handler: CreateUserHandler = Depends(get_create_user_handler),
    current_user: CurrentUser = Depends(require_admin),
) -> UserResponse:
    settings = get_settings()
    try:
        result = await handler.handle(
            CreateUserCommand(
                tenant_id=_resolve_tenant(settings.tenant_id_default),
                email=body.email,
                password=body.password,
                full_name=body.full_name,
                role=body.role,
            )
        )
    except ConflictError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=str(exc)
        ) from exc
    return UserResponse(
        id=str(result.user_id),
        email=result.email,
        full_name=result.full_name,
        role=result.role,
        is_active=result.is_active,
        company_name=result.company_name,
        company_logo_url=result.company_logo_url,
        company_street=result.company_street,
        company_city=result.company_city,
        company_province=result.company_province,
        company_postal_code=result.company_postal_code,
        company_cuit=result.company_cuit,
        company_color_primary=result.company_color_primary,
        company_color_secondary=result.company_color_secondary,
        default_commercial_conditions=result.default_commercial_conditions,
    )


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: UUID,
    handler: GetUserHandler = Depends(get_user_handler),
    current_user: CurrentUser = Depends(get_current_user),
) -> UserResponse:
    settings = get_settings()
    # El operativo solo puede ver su propio perfil; admin ve cualquiera
    if current_user.role != "ADMIN" and current_user.user_id != str(user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Acceso denegado"
        )
    try:
        result = await handler.handle(
            GetUserByIdQuery(
                user_id=user_id, tenant_id=_resolve_tenant(settings.tenant_id_default)
            )
        )
    except NotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc
    return UserResponse(
        id=str(result.user_id),
        email=result.email,
        full_name=result.full_name,
        role=result.role,
        is_active=result.is_active,
        company_name=result.company_name,
        company_logo_url=result.company_logo_url,
        company_street=result.company_street,
        company_city=result.company_city,
        company_province=result.company_province,
        company_postal_code=result.company_postal_code,
        company_cuit=result.company_cuit,
        company_color_primary=result.company_color_primary,
        company_color_secondary=result.company_color_secondary,
        default_commercial_conditions=result.default_commercial_conditions,
    )


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: UUID,
    body: UpdateUserRequest,
    handler: UpdateUserHandler = Depends(get_update_user_handler),
    current_user: CurrentUser = Depends(get_current_user),
) -> UserResponse:
    settings = get_settings()
    if current_user.role != "ADMIN" and current_user.user_id != str(user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Acceso denegado"
        )
    # Operativos solo pueden cambiar su contraseña y datos de empresa
    if current_user.role != "ADMIN":
        body = UpdateUserRequest(
            password=body.password,
            company_name=body.company_name,
            company_logo_url=body.company_logo_url,
            company_street=body.company_street,
            company_city=body.company_city,
            company_province=body.company_province,
            company_postal_code=body.company_postal_code,
            company_cuit=body.company_cuit,
            company_color_primary=body.company_color_primary,
            company_color_secondary=body.company_color_secondary,
            default_commercial_conditions=body.default_commercial_conditions,
        )
    try:
        result = await handler.handle(
            UpdateUserCommand(
                user_id=user_id,
                tenant_id=_resolve_tenant(settings.tenant_id_default),
                email=body.email,
                full_name=body.full_name,
                role=body.role,
                is_active=body.is_active,
                password=body.password,
                company_name=body.company_name,
                company_logo_url=body.company_logo_url,
                company_street=body.company_street,
                company_city=body.company_city,
                company_province=body.company_province,
                company_postal_code=body.company_postal_code,
                company_cuit=body.company_cuit,
                company_color_primary=body.company_color_primary,
                company_color_secondary=body.company_color_secondary,
                default_commercial_conditions=body.default_commercial_conditions,
            )
        )
    except NotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc
    except ConflictError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=str(exc)
        ) from exc
    return UserResponse(
        id=str(result.user_id),
        email=result.email,
        full_name=result.full_name,
        role=result.role,
        is_active=result.is_active,
        company_name=result.company_name,
        company_logo_url=result.company_logo_url,
        company_street=result.company_street,
        company_city=result.company_city,
        company_province=result.company_province,
        company_postal_code=result.company_postal_code,
        company_cuit=result.company_cuit,
        company_color_primary=result.company_color_primary,
        company_color_secondary=result.company_color_secondary,
        default_commercial_conditions=result.default_commercial_conditions,
    )


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_user(
    user_id: UUID,
    handler: DeactivateUserHandler = Depends(get_deactivate_handler),
    current_user: CurrentUser = Depends(require_admin),
) -> None:
    settings = get_settings()
    try:
        await handler.handle(
            DeactivateUserCommand(
                user_id=user_id, tenant_id=_resolve_tenant(settings.tenant_id_default)
            )
        )
    except NotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc


@router.patch("/{user_id}/role", response_model=UserResponse)
async def assign_role(
    user_id: UUID,
    body: AssignRoleRequest,
    handler: AssignRoleHandler = Depends(get_assign_role_handler),
    current_user: CurrentUser = Depends(require_admin),
) -> None:
    settings = get_settings()
    try:
        await handler.handle(
            AssignRoleCommand(
                user_id=user_id,
                tenant_id=_resolve_tenant(settings.tenant_id_default),
                new_role=body.role,
            )
        )
    except NotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc
