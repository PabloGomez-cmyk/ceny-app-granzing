import uuid
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field

from centy.application.pricing.commands import (
    DeletePriceOverrideCommand,
    SetPriceOverrideCommand,
)
from centy.application.pricing.handlers import (
    DeletePriceOverrideHandler,
    GetEffectivePriceListHandler,
    SetPriceOverrideHandler,
)
from centy.application.pricing.queries import GetEffectivePriceListQuery
from centy.domain.shared.value_objects import TenantId
from centy.infrastructure.api.dependencies import (
    CurrentUser,
    get_current_user,
    get_delete_price_override_handler,
    get_effective_price_list_handler,
    get_set_price_override_handler,
    require_admin,
)
from centy.infrastructure.config.settings import get_settings

router = APIRouter(tags=["pricing"])


def _resolve_tenant(settings_tenant: str) -> TenantId:
    try:
        return TenantId(UUID(settings_tenant))
    except ValueError:
        return TenantId(uuid.uuid5(uuid.NAMESPACE_DNS, settings_tenant))


# ── Schemas ───────────────────────────────────────────────────────────────────


class EffectivePriceItemResponse(BaseModel):
    product_id: str
    product_name: str
    brand_name: str
    catalog_purchase_price: Decimal
    catalog_sale_price: Decimal
    effective_purchase_price: Decimal
    effective_sale_price: Decimal
    has_purchase_override: bool
    has_sale_override: bool


class SetPriceOverrideBody(BaseModel):
    product_id: UUID
    purchase_price: Decimal | None = Field(None, ge=Decimal("0"))
    sale_price: Decimal | None = Field(None, ge=Decimal("0"))
    clear_purchase_price: bool = False
    clear_sale_price: bool = False


class PriceListItemResponse(BaseModel):
    user_id: str
    product_id: str
    purchase_price: Decimal | None
    sale_price: Decimal | None


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.get(
    "/users/{user_id}/price-list", response_model=list[EffectivePriceItemResponse]
)
async def get_effective_price_list(
    user_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    handler: GetEffectivePriceListHandler = Depends(get_effective_price_list_handler),
) -> list[EffectivePriceItemResponse]:
    results = await handler.handle(
        GetEffectivePriceListQuery(
            tenant_id=_resolve_tenant(get_settings().tenant_id_default),
            requester_user_id=UUID(current_user.user_id),
            requester_role=current_user.role,
            user_id=user_id,
        )
    )
    return [
        EffectivePriceItemResponse(
            product_id=str(r.product_id),
            product_name=r.product_name,
            brand_name=r.brand_name,
            catalog_purchase_price=r.catalog_purchase_price,
            catalog_sale_price=r.catalog_sale_price,
            effective_purchase_price=r.effective_purchase_price,
            effective_sale_price=r.effective_sale_price,
            has_purchase_override=r.has_purchase_override,
            has_sale_override=r.has_sale_override,
        )
        for r in results
    ]


@router.patch("/price-lists/items/{user_id}", response_model=PriceListItemResponse)
async def set_price_override(
    user_id: UUID,
    body: SetPriceOverrideBody,
    admin: CurrentUser = Depends(require_admin),
    handler: SetPriceOverrideHandler = Depends(get_set_price_override_handler),
) -> PriceListItemResponse:
    result = await handler.handle(
        SetPriceOverrideCommand(
            tenant_id=_resolve_tenant(get_settings().tenant_id_default),
            requester_user_id=UUID(admin.user_id),
            requester_role=admin.role,
            user_id=user_id,
            product_id=body.product_id,
            purchase_price=body.purchase_price,
            sale_price=body.sale_price,
            clear_purchase_price=body.clear_purchase_price,
            clear_sale_price=body.clear_sale_price,
        )
    )
    return PriceListItemResponse(
        user_id=str(result.user_id),
        product_id=str(result.product_id),
        purchase_price=result.purchase_price,
        sale_price=result.sale_price,
    )


@router.delete(
    "/price-lists/items/{user_id}/{product_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_price_override(
    user_id: UUID,
    product_id: UUID,
    admin: CurrentUser = Depends(require_admin),
    handler: DeletePriceOverrideHandler = Depends(get_delete_price_override_handler),
) -> None:
    await handler.handle(
        DeletePriceOverrideCommand(
            tenant_id=_resolve_tenant(get_settings().tenant_id_default),
            requester_user_id=UUID(admin.user_id),
            requester_role=admin.role,
            user_id=user_id,
            product_id=product_id,
        )
    )
