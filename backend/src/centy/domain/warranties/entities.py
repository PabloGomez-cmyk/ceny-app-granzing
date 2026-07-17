from dataclasses import dataclass
from datetime import date, datetime
from typing import Any
from uuid import UUID

from centy.domain.shared.entity import Entity
from centy.domain.shared.exceptions import BusinessRuleViolationError
from centy.domain.shared.value_objects import TenantId


@dataclass(kw_only=True)
class Warranty(Entity):
    """Garantía oficial emitida para un producto instalado en una venta."""

    tenant_id: TenantId
    quote_id: UUID
    quote_line_id: UUID
    product_id: UUID
    product_snapshot: dict[str, Any]  # {name, brand_name, uv_pct, irr_pct, tser_pct}
    warranty_number: str
    customer_snapshot: dict[str, Any] | None
    created_by_user_id: UUID
    warranty_years: int
    expires_at: date
    sent_at: datetime | None = None
    vehicle_model: str | None = None
    license_plate: str | None = None

    @classmethod
    def create(
        cls,
        *,
        tenant_id: TenantId,
        quote_id: UUID,
        quote_line_id: UUID,
        product_id: UUID,
        product_snapshot: dict[str, Any],
        warranty_number: str,
        customer_snapshot: dict[str, Any] | None,
        created_by_user_id: UUID,
        warranty_years: int,
        vehicle_model: str | None = None,
        license_plate: str | None = None,
    ) -> "Warranty":
        if warranty_years <= 0:
            raise BusinessRuleViolationError(
                "El producto no tiene una garantía válida configurada"
            )
        issued = date.today()
        try:
            expires_at = issued.replace(year=issued.year + warranty_years)
        except ValueError:
            # 29 de febrero cayendo en un año no bisiesto
            expires_at = issued.replace(
                year=issued.year + warranty_years, day=28, month=2
            )
        return cls(
            tenant_id=tenant_id,
            quote_id=quote_id,
            quote_line_id=quote_line_id,
            product_id=product_id,
            product_snapshot=product_snapshot,
            warranty_number=warranty_number,
            customer_snapshot=customer_snapshot,
            created_by_user_id=created_by_user_id,
            warranty_years=warranty_years,
            expires_at=expires_at,
            vehicle_model=vehicle_model,
            license_plate=license_plate,
        )

    @property
    def is_valid(self) -> bool:
        return date.today() <= self.expires_at
