from dataclasses import dataclass
from decimal import Decimal
from typing import Any
from uuid import UUID

from centy.domain.quotes.value_objects import (
    FilmMode,
    LocationType,
    QuoteStatus,
    SaleType,
)
from centy.domain.shared.value_objects import TenantId


@dataclass(frozen=True)
class GlassPaneInput:
    pane_id: str
    glass_type_id: UUID | None
    glass_type_name: str
    width_cm: Decimal
    height_cm: Decimal
    location: LocationType
    quantity: int
    notes: str | None
    sort_order: int


@dataclass(frozen=True)
class QuoteLineInput:
    product_id: UUID
    product_snapshot: dict[str, Any]
    glass_pane_ids: list[str]
    price_per_m2: Decimal
    subtotal: Decimal
    surface_m2: Decimal | None = None
    quantity: Decimal | None = None


@dataclass(frozen=True)
class CreateQuoteCommand:
    tenant_id: TenantId
    created_by_user_id: UUID
    customer_id: UUID | None
    customer_snapshot: dict[str, Any] | None
    sale_type: SaleType
    film_mode: FilmMode
    glass_panes: list[GlassPaneInput]
    lines: list[QuoteLineInput]
    height_surcharge_pct: Decimal
    travel_cost: Decimal
    discount_pct: Decimal
    tax_pct: Decimal
    gap_cm: Decimal
    commercial_conditions: str
    cut_plan_snapshot: dict[str, Any]
    valid_until: str


@dataclass(frozen=True)
class UpdateQuoteCommand:
    quote_id: UUID
    tenant_id: TenantId
    requester_user_id: UUID
    requester_role: str
    customer_id: UUID | None
    customer_snapshot: dict[str, Any] | None
    sale_type: SaleType
    film_mode: FilmMode
    glass_panes: list[GlassPaneInput]
    lines: list[QuoteLineInput]
    height_surcharge_pct: Decimal
    travel_cost: Decimal
    discount_pct: Decimal
    tax_pct: Decimal
    gap_cm: Decimal
    commercial_conditions: str
    cut_plan_snapshot: dict[str, Any]
    valid_until: str


@dataclass(frozen=True)
class UpdateQuoteStatusCommand:
    quote_id: UUID
    tenant_id: TenantId
    requester_user_id: UUID
    requester_role: str
    new_status: QuoteStatus


@dataclass(frozen=True)
class DeleteQuoteCommand:
    quote_id: UUID
    tenant_id: TenantId
    requester_user_id: UUID
    requester_role: str
