import uuid
from uuid import UUID

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field

from centy.application.customers.commands import (
    CreateCustomerCommand,
    CreateCustomerLabelCommand,
    DeactivateCustomerCommand,
    DeleteCustomerLabelCommand,
    UpdateCustomerCommand,
    UpdateCustomerLabelCommand,
)
from centy.application.customers.handlers import (
    CreateCustomerHandler,
    CreateCustomerLabelHandler,
    DeactivateCustomerHandler,
    DeleteCustomerLabelHandler,
    GetCustomerHandler,
    ListCustomerLabelsHandler,
    ListCustomersHandler,
    UpdateCustomerHandler,
    UpdateCustomerLabelHandler,
)
from centy.application.customers.queries import (
    GetCustomerQuery,
    ListCustomerLabelsQuery,
    ListCustomersQuery,
)
from centy.domain.shared.value_objects import TenantId
from centy.infrastructure.api.dependencies import (
    CurrentUser,
    get_create_customer_handler,
    get_create_label_handler,
    get_current_user,
    get_customer_handler,
    get_deactivate_customer_handler,
    get_delete_label_handler,
    get_list_customers_handler,
    get_list_labels_handler,
    get_update_customer_handler,
    get_update_label_handler,
)
from centy.infrastructure.config.settings import get_settings

router = APIRouter(prefix="/customers", tags=["customers"])


def _resolve_tenant(settings_tenant: str) -> TenantId:
    try:
        return TenantId(UUID(settings_tenant))
    except ValueError:
        return TenantId(uuid.uuid5(uuid.NAMESPACE_DNS, settings_tenant))


# ── Schemas ───────────────────────────────────────────────────────────────────


class CustomerLabelResponse(BaseModel):
    id: str
    name: str
    color: str
    is_active: bool


class CustomerResponse(BaseModel):
    id: str
    tenant_id: str
    owner_user_id: str
    name: str
    email: str | None
    phone: str | None
    address: str | None
    city: str | None
    province: str | None
    neighborhood: str | None
    postal_code: str | None
    label_id: str | None
    notes: str | None
    is_active: bool
    created_at: str


class CreateCustomerBody(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    email: str | None = None
    phone: str | None = None
    address: str | None = None
    city: str | None = None
    province: str | None = None
    neighborhood: str | None = None
    postal_code: str | None = None
    label_id: UUID | None = None
    notes: str | None = None


class UpdateCustomerBody(BaseModel):
    name: str | None = Field(None, max_length=200)
    email: str | None = None
    phone: str | None = None
    address: str | None = None
    city: str | None = None
    province: str | None = None
    neighborhood: str | None = None
    postal_code: str | None = None
    label_id: UUID | None = None
    clear_label: bool = False
    notes: str | None = None
    is_active: bool | None = None


class CreateLabelBody(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    color: str = Field("#10b981", pattern=r"^#[0-9a-fA-F]{6}$")


class UpdateLabelBody(BaseModel):
    name: str | None = Field(None, max_length=50)
    color: str | None = Field(None, pattern=r"^#[0-9a-fA-F]{6}$")


# ── Label routes ──────────────────────────────────────────────────────────────


@router.get("/labels", response_model=list[CustomerLabelResponse])
async def list_labels(
    current_user: CurrentUser = Depends(get_current_user),
    handler: ListCustomerLabelsHandler = Depends(get_list_labels_handler),
) -> list[CustomerLabelResponse]:
    results = await handler.handle(
        ListCustomerLabelsQuery(
            tenant_id=_resolve_tenant(get_settings().tenant_id_default),
            owner_user_id=UUID(current_user.user_id),
        )
    )
    return [
        CustomerLabelResponse(
            id=str(r.label_id), name=r.name, color=r.color, is_active=r.is_active
        )
        for r in results
    ]


@router.post(
    "/labels", response_model=CustomerLabelResponse, status_code=status.HTTP_201_CREATED
)
async def create_label(
    body: CreateLabelBody,
    current_user: CurrentUser = Depends(get_current_user),
    handler: CreateCustomerLabelHandler = Depends(get_create_label_handler),
) -> CustomerLabelResponse:
    result = await handler.handle(
        CreateCustomerLabelCommand(
            tenant_id=_resolve_tenant(get_settings().tenant_id_default),
            owner_user_id=UUID(current_user.user_id),
            name=body.name,
            color=body.color,
        )
    )
    return CustomerLabelResponse(
        id=str(result.label_id),
        name=result.name,
        color=result.color,
        is_active=result.is_active,
    )


@router.patch("/labels/{label_id}", response_model=CustomerLabelResponse)
async def update_label(
    label_id: UUID,
    body: UpdateLabelBody,
    current_user: CurrentUser = Depends(get_current_user),
    handler: UpdateCustomerLabelHandler = Depends(get_update_label_handler),
) -> CustomerLabelResponse:
    result = await handler.handle(
        UpdateCustomerLabelCommand(
            label_id=label_id,
            tenant_id=_resolve_tenant(get_settings().tenant_id_default),
            owner_user_id=UUID(current_user.user_id),
            name=body.name,
            color=body.color,
        )
    )
    return CustomerLabelResponse(
        id=str(result.label_id),
        name=result.name,
        color=result.color,
        is_active=result.is_active,
    )


@router.delete("/labels/{label_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_label(
    label_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    handler: DeleteCustomerLabelHandler = Depends(get_delete_label_handler),
) -> None:
    await handler.handle(
        DeleteCustomerLabelCommand(
            label_id=label_id,
            tenant_id=_resolve_tenant(get_settings().tenant_id_default),
            owner_user_id=UUID(current_user.user_id),
        )
    )


# ── Customer routes ───────────────────────────────────────────────────────────


@router.get("", response_model=list[CustomerResponse])
async def list_customers(
    current_user: CurrentUser = Depends(get_current_user),
    handler: ListCustomersHandler = Depends(get_list_customers_handler),
) -> list[CustomerResponse]:
    results = await handler.handle(
        ListCustomersQuery(
            tenant_id=_resolve_tenant(get_settings().tenant_id_default),
            requester_user_id=UUID(current_user.user_id),
            requester_role=current_user.role,
        )
    )
    return [
        CustomerResponse(
            id=str(r.customer_id),
            tenant_id=r.tenant_id,
            owner_user_id=str(r.owner_user_id),
            name=r.name,
            email=r.email,
            phone=r.phone,
            address=r.address,
            city=r.city,
            province=r.province,
            neighborhood=r.neighborhood,
            postal_code=r.postal_code,
            label_id=str(r.label_id) if r.label_id else None,
            notes=r.notes,
            is_active=r.is_active,
            created_at=r.created_at,
        )
        for r in results
    ]


@router.post("", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
async def create_customer(
    body: CreateCustomerBody,
    current_user: CurrentUser = Depends(get_current_user),
    handler: CreateCustomerHandler = Depends(get_create_customer_handler),
) -> CustomerResponse:
    result = await handler.handle(
        CreateCustomerCommand(
            tenant_id=_resolve_tenant(get_settings().tenant_id_default),
            owner_user_id=UUID(current_user.user_id),
            name=body.name,
            email=body.email,
            phone=body.phone,
            address=body.address,
            city=body.city,
            province=body.province,
            neighborhood=body.neighborhood,
            postal_code=body.postal_code,
            label_id=body.label_id,
            notes=body.notes,
        )
    )
    return CustomerResponse(
        id=str(result.customer_id),
        tenant_id=result.tenant_id,
        owner_user_id=str(result.owner_user_id),
        name=result.name,
        email=result.email,
        phone=result.phone,
        address=result.address,
        city=result.city,
        province=result.province,
        neighborhood=result.neighborhood,
        postal_code=result.postal_code,
        label_id=str(result.label_id) if result.label_id else None,
        notes=result.notes,
        is_active=result.is_active,
        created_at=result.created_at,
    )


@router.get("/{customer_id}", response_model=CustomerResponse)
async def get_customer(
    customer_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    handler: GetCustomerHandler = Depends(get_customer_handler),
) -> CustomerResponse:
    result = await handler.handle(
        GetCustomerQuery(
            customer_id=customer_id,
            tenant_id=_resolve_tenant(get_settings().tenant_id_default),
            requester_user_id=UUID(current_user.user_id),
            requester_role=current_user.role,
        )
    )
    return CustomerResponse(
        id=str(result.customer_id),
        tenant_id=result.tenant_id,
        owner_user_id=str(result.owner_user_id),
        name=result.name,
        email=result.email,
        phone=result.phone,
        address=result.address,
        city=result.city,
        province=result.province,
        neighborhood=result.neighborhood,
        postal_code=result.postal_code,
        label_id=str(result.label_id) if result.label_id else None,
        notes=result.notes,
        is_active=result.is_active,
        created_at=result.created_at,
    )


@router.patch("/{customer_id}", response_model=CustomerResponse)
async def update_customer(
    customer_id: UUID,
    body: UpdateCustomerBody,
    current_user: CurrentUser = Depends(get_current_user),
    handler: UpdateCustomerHandler = Depends(get_update_customer_handler),
) -> CustomerResponse:
    result = await handler.handle(
        UpdateCustomerCommand(
            customer_id=customer_id,
            tenant_id=_resolve_tenant(get_settings().tenant_id_default),
            requester_user_id=UUID(current_user.user_id),
            requester_role=current_user.role,
            name=body.name,
            email=body.email,
            phone=body.phone,
            address=body.address,
            city=body.city,
            province=body.province,
            neighborhood=body.neighborhood,
            postal_code=body.postal_code,
            label_id=body.label_id,
            clear_label=body.clear_label,
            notes=body.notes,
            is_active=body.is_active,
        )
    )
    return CustomerResponse(
        id=str(result.customer_id),
        tenant_id=result.tenant_id,
        owner_user_id=str(result.owner_user_id),
        name=result.name,
        email=result.email,
        phone=result.phone,
        address=result.address,
        city=result.city,
        province=result.province,
        neighborhood=result.neighborhood,
        postal_code=result.postal_code,
        label_id=str(result.label_id) if result.label_id else None,
        notes=result.notes,
        is_active=result.is_active,
        created_at=result.created_at,
    )


@router.delete("/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_customer(
    customer_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    handler: DeactivateCustomerHandler = Depends(get_deactivate_customer_handler),
) -> None:
    await handler.handle(
        DeactivateCustomerCommand(
            customer_id=customer_id,
            tenant_id=_resolve_tenant(get_settings().tenant_id_default),
            requester_user_id=UUID(current_user.user_id),
            requester_role=current_user.role,
        )
    )
