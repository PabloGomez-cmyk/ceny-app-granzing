from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any
from uuid import UUID, uuid4

from centy.domain.quotes.value_objects import FilmMode, LocationType, QuoteStatus
from centy.domain.shared.entity import Entity
from centy.domain.shared.exceptions import BusinessRuleViolationError
from centy.domain.shared.value_objects import TenantId


@dataclass(kw_only=True)
class GlassPane:
    """Vidrio individual del proyecto (value object embebido en Quote)."""

    pane_id: str  # "v01", "v02" — generado en frontend
    glass_type_id: UUID | None
    glass_type_name: str
    width_cm: Decimal
    height_cm: Decimal
    location: LocationType
    quantity: int
    notes: str | None = None
    sort_order: int = 0

    @property
    def surface_m2(self) -> Decimal:
        return (self.width_cm / 100) * (self.height_cm / 100) * self.quantity


@dataclass(kw_only=True)
class QuoteLine:
    """Asignación de una lámina a uno o más vidrios del proyecto."""

    line_id: UUID = field(default_factory=uuid4)
    product_id: UUID
    product_snapshot: dict[
        str, Any
    ]  # {name, brand_name, brand_color, price_per_m2, uv_pct, irr_pct}
    glass_pane_ids: list[str]
    price_per_m2: Decimal
    surface_m2: Decimal
    subtotal: Decimal  # price_per_m2 x surface_m2


@dataclass(kw_only=True)
class Quote(Entity):
    """Presupuesto de instalación — agregado raíz del módulo de ventas."""

    tenant_id: TenantId
    created_by_user_id: UUID
    quote_number: str
    customer_id: UUID | None = None
    customer_snapshot: dict[str, Any] | None = None
    status: QuoteStatus = QuoteStatus.DRAFT
    film_mode: FilmMode = FilmMode.SINGLE
    glass_panes: list[GlassPane] = field(default_factory=list)
    lines: list[QuoteLine] = field(default_factory=list)
    height_surcharge_pct: Decimal = Decimal("30")
    travel_cost: Decimal = Decimal("0")
    discount_pct: Decimal = Decimal("0")
    tax_pct: Decimal = Decimal("0")
    gap_cm: Decimal = Decimal("3")
    commercial_conditions: str = ""
    cut_plan_snapshot: dict[str, Any] = field(default_factory=dict)
    valid_until: str = ""

    @classmethod
    def create(
        cls,
        *,
        tenant_id: TenantId,
        created_by_user_id: UUID,
        quote_number: str,
        customer_id: UUID | None,
        customer_snapshot: dict[str, Any] | None,
        film_mode: FilmMode,
        glass_panes: list[GlassPane],
        lines: list[QuoteLine],
        height_surcharge_pct: Decimal,
        travel_cost: Decimal,
        discount_pct: Decimal,
        tax_pct: Decimal,
        gap_cm: Decimal = Decimal("3"),
        commercial_conditions: str,
        cut_plan_snapshot: dict[str, Any],
        valid_until: str,
    ) -> "Quote":
        if not glass_panes:
            raise BusinessRuleViolationError(
                "El presupuesto debe tener al menos un vidrio"
            )
        if not lines:
            raise BusinessRuleViolationError(
                "El presupuesto debe tener al menos una lámina asignada"
            )
        if discount_pct < -50 or discount_pct > 50:
            raise BusinessRuleViolationError(
                "El descuento/recargo debe estar entre -50% y +50%"
            )
        if gap_cm < 0:
            raise BusinessRuleViolationError(
                "El espacio entre vidrios no puede ser negativo"
            )
        return cls(
            tenant_id=tenant_id,
            created_by_user_id=created_by_user_id,
            quote_number=quote_number,
            customer_id=customer_id,
            customer_snapshot=customer_snapshot,
            film_mode=film_mode,
            glass_panes=glass_panes,
            lines=lines,
            height_surcharge_pct=height_surcharge_pct,
            travel_cost=travel_cost,
            discount_pct=discount_pct,
            tax_pct=tax_pct,
            gap_cm=gap_cm,
            commercial_conditions=commercial_conditions,
            cut_plan_snapshot=cut_plan_snapshot,
            valid_until=valid_until,
        )

    @property
    def has_altura_panes(self) -> bool:
        return any(p.location == LocationType.ALTURA for p in self.glass_panes)

    def submit(self) -> None:
        if self.status != QuoteStatus.DRAFT:
            raise BusinessRuleViolationError(
                "Solo se pueden enviar presupuestos en estado DRAFT"
            )
        self.status = QuoteStatus.SENT

    def accept(self) -> None:
        if self.status != QuoteStatus.SENT:
            raise BusinessRuleViolationError(
                "Solo se pueden aceptar presupuestos enviados"
            )
        self.status = QuoteStatus.ACCEPTED

    def invoice(self) -> None:
        if self.status != QuoteStatus.ACCEPTED:
            raise BusinessRuleViolationError(
                "Solo se pueden facturar presupuestos aceptados"
            )
        self.status = QuoteStatus.INVOICED

    def complete(self) -> None:
        if self.status != QuoteStatus.INVOICED:
            raise BusinessRuleViolationError(
                "Solo se pueden terminar presupuestos facturados"
            )
        self.status = QuoteStatus.COMPLETED

    def cancel(self) -> None:
        if self.status in (QuoteStatus.INVOICED, QuoteStatus.COMPLETED):
            raise BusinessRuleViolationError(
                "No se puede cancelar un presupuesto facturado o terminado"
            )
        if self.status == QuoteStatus.CANCELLED:
            raise BusinessRuleViolationError("El presupuesto ya está cancelado")
        self.status = QuoteStatus.CANCELLED
