import uuid
from uuid import UUID

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.ext.asyncio import AsyncSession

from centy.application.warranties.commands import (
    GenerateWarrantiesCommand,
    SendWarrantiesEmailCommand,
)
from centy.application.warranties.handlers import (
    GenerateWarrantiesHandler,
    GetWarrantyHandler,
    ListWarrantiesByQuoteHandler,
    ListWarrantiesHandler,
    SendWarrantiesEmailHandler,
)
from centy.application.warranties.queries import (
    GetWarrantyQuery,
    ListWarrantiesByQuoteQuery,
    ListWarrantiesQuery,
)
from centy.domain.shared.value_objects import TenantId
from centy.infrastructure.api.dependencies import (
    CurrentUser,
    get_current_user,
    get_generate_warranties_handler,
    get_list_warranties_by_quote_handler,
    get_list_warranties_handler,
    get_send_warranties_email_handler,
    get_session,
    get_warranty_handler,
)
from centy.infrastructure.config.settings import get_settings

router = APIRouter(tags=["warranties"])


def _resolve_tenant(settings_tenant: str) -> TenantId:
    try:
        return TenantId(UUID(settings_tenant))
    except ValueError:
        return TenantId(uuid.uuid5(uuid.NAMESPACE_DNS, settings_tenant))


# ── Request bodies ──────────────────────────────────────────────────────────────


class SendWarrantiesEmailBody(BaseModel):
    recipient_email: EmailStr
    recipient_name: str | None = None
    custom_message: str | None = None


class GenerateWarrantiesBody(BaseModel):
    vehicle_model: str | None = Field(default=None, max_length=100)
    license_plate: str | None = Field(default=None, max_length=20)


# ── Response schema ───────────────────────────────────────────────────────────


class WarrantyResponse(BaseModel):
    id: str
    tenant_id: str
    quote_id: str
    quote_line_id: str
    product_id: str
    product_snapshot: dict
    warranty_number: str
    customer_snapshot: dict | None
    created_by_user_id: str
    warranty_years: int
    expires_at: str
    is_valid: bool
    sent_at: str | None
    created_at: str
    vehicle_model: str | None
    license_plate: str | None


def _to_response(r: object) -> WarrantyResponse:
    return WarrantyResponse(
        id=r.warranty_id,  # type: ignore[attr-defined]
        tenant_id=r.tenant_id,  # type: ignore[attr-defined]
        quote_id=r.quote_id,  # type: ignore[attr-defined]
        quote_line_id=r.quote_line_id,  # type: ignore[attr-defined]
        product_id=r.product_id,  # type: ignore[attr-defined]
        product_snapshot=r.product_snapshot,  # type: ignore[attr-defined]
        warranty_number=r.warranty_number,  # type: ignore[attr-defined]
        customer_snapshot=r.customer_snapshot,  # type: ignore[attr-defined]
        created_by_user_id=r.created_by_user_id,  # type: ignore[attr-defined]
        warranty_years=r.warranty_years,  # type: ignore[attr-defined]
        expires_at=r.expires_at,  # type: ignore[attr-defined]
        is_valid=r.is_valid,  # type: ignore[attr-defined]
        sent_at=r.sent_at,  # type: ignore[attr-defined]
        created_at=r.created_at,  # type: ignore[attr-defined]
        vehicle_model=r.vehicle_model,  # type: ignore[attr-defined]
        license_plate=r.license_plate,  # type: ignore[attr-defined]
    )


# ── Routes ────────────────────────────────────────────────────────────────────


@router.get("/warranties", response_model=list[WarrantyResponse])
async def list_warranties(
    current_user: CurrentUser = Depends(get_current_user),
    handler: ListWarrantiesHandler = Depends(get_list_warranties_handler),
) -> list[WarrantyResponse]:
    results = await handler.handle(
        ListWarrantiesQuery(
            tenant_id=_resolve_tenant(get_settings().tenant_id_default),
            requester_user_id=UUID(current_user.user_id),
            requester_role=current_user.role,
        )
    )
    return [_to_response(r) for r in results]


@router.get("/warranties/{warranty_id}", response_model=WarrantyResponse)
async def get_warranty(
    warranty_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    handler: GetWarrantyHandler = Depends(get_warranty_handler),
) -> WarrantyResponse:
    result = await handler.handle(
        GetWarrantyQuery(
            warranty_id=warranty_id,
            tenant_id=_resolve_tenant(get_settings().tenant_id_default),
            requester_user_id=UUID(current_user.user_id),
            requester_role=current_user.role,
        )
    )
    return _to_response(result)


@router.get("/quotes/{quote_id}/warranties", response_model=list[WarrantyResponse])
async def list_warranties_by_quote(
    quote_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    handler: ListWarrantiesByQuoteHandler = Depends(
        get_list_warranties_by_quote_handler
    ),
) -> list[WarrantyResponse]:
    results = await handler.handle(
        ListWarrantiesByQuoteQuery(
            quote_id=quote_id,
            tenant_id=_resolve_tenant(get_settings().tenant_id_default),
            requester_user_id=UUID(current_user.user_id),
            requester_role=current_user.role,
        )
    )
    return [_to_response(r) for r in results]


@router.post(
    "/quotes/{quote_id}/warranties",
    response_model=list[WarrantyResponse],
    status_code=status.HTTP_201_CREATED,
)
async def generate_warranties(
    quote_id: UUID,
    body: GenerateWarrantiesBody | None = None,
    current_user: CurrentUser = Depends(get_current_user),
    handler: GenerateWarrantiesHandler = Depends(get_generate_warranties_handler),
) -> list[WarrantyResponse]:
    results = await handler.handle(
        GenerateWarrantiesCommand(
            quote_id=quote_id,
            tenant_id=_resolve_tenant(get_settings().tenant_id_default),
            requester_user_id=UUID(current_user.user_id),
            requester_role=current_user.role,
            vehicle_model=body.vehicle_model if body else None,
            license_plate=body.license_plate if body else None,
        )
    )
    return [_to_response(r) for r in results]


@router.post(
    "/quotes/{quote_id}/warranties/send-email", status_code=status.HTTP_204_NO_CONTENT
)
async def send_warranties_email(
    quote_id: str,
    body: SendWarrantiesEmailBody,
    current_user: CurrentUser = Depends(get_current_user),
    handler: SendWarrantiesEmailHandler = Depends(get_send_warranties_email_handler),
    session: AsyncSession = Depends(get_session),
) -> None:
    cmd = SendWarrantiesEmailCommand(
        quote_id=quote_id,
        sender_user_id=UUID(current_user.user_id),
        tenant_id=current_user.tenant_id,
        recipient_email=str(body.recipient_email),
        recipient_name=body.recipient_name,
        custom_message=body.custom_message,
        frontend_base_url=get_settings().frontend_base_url,
    )
    await handler.handle(cmd)
    await session.commit()
