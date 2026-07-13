from dataclasses import dataclass
from decimal import Decimal
from uuid import UUID

from centy.domain.shared.entity import Entity
from centy.domain.shared.value_objects import Money, TenantId


@dataclass(kw_only=True)
class PriceListItem(Entity):
    """Override de costo y/o precio de venta de un operador para un producto.

    No hay una entidad "PriceList" contenedora: cada item es la unidad
    mínima de override (tenant, operador, producto). Si un operador no
    tiene item para un producto, se usa el default de Product
    (sale_price_per_m2 / purchase_price_per_m2). Ambos campos son
    independientes entre sí — un admin puede cargar solo costo, solo
    precio, o los dos.
    """

    tenant_id: TenantId
    user_id: UUID
    product_id: UUID
    purchase_price: Money | None = None
    sale_price: Money | None = None

    @classmethod
    def create(
        cls,
        *,
        tenant_id: TenantId,
        user_id: UUID,
        product_id: UUID,
        purchase_price: Decimal | None = None,
        sale_price: Decimal | None = None,
    ) -> "PriceListItem":
        return cls(
            tenant_id=tenant_id,
            user_id=user_id,
            product_id=product_id,
            purchase_price=Money(purchase_price)
            if purchase_price is not None
            else None,
            sale_price=Money(sale_price) if sale_price is not None else None,
        )

    def update(
        self,
        *,
        purchase_price: Decimal | None = None,
        sale_price: Decimal | None = None,
        clear_purchase_price: bool = False,
        clear_sale_price: bool = False,
    ) -> None:
        if clear_purchase_price:
            self.purchase_price = None
        elif purchase_price is not None:
            self.purchase_price = Money(purchase_price)
        if clear_sale_price:
            self.sale_price = None
        elif sale_price is not None:
            self.sale_price = Money(sale_price)
