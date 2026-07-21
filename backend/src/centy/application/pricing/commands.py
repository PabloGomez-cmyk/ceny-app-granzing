from dataclasses import dataclass
from decimal import Decimal
from uuid import UUID

from centy.domain.shared.value_objects import TenantId


@dataclass(frozen=True)
class SetPriceOverrideCommand:
    tenant_id: TenantId
    requester_user_id: UUID
    requester_role: str
    user_id: UUID
    product_id: UUID
    purchase_price: Decimal | None = None
    sale_price: Decimal | None = None
    clear_purchase_price: bool = False
    clear_sale_price: bool = False
    purchase_price_per_unit: Decimal | None = None
    sale_price_per_unit: Decimal | None = None
    clear_purchase_price_per_unit: bool = False
    clear_sale_price_per_unit: bool = False


@dataclass(frozen=True)
class DeletePriceOverrideCommand:
    tenant_id: TenantId
    requester_user_id: UUID
    requester_role: str
    user_id: UUID
    product_id: UUID
