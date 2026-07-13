from decimal import Decimal
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from centy.application.ports.repositories import IPriceListItemRepository
from centy.domain.pricing.entities import PriceListItem
from centy.domain.shared.value_objects import Money, TenantId
from centy.infrastructure.persistence.models.pricing import PriceListItemModel


class SQLAlchemyPriceListItemRepository(IPriceListItemRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_user_and_product(
        self, user_id: UUID, product_id: UUID, tenant_id: TenantId
    ) -> PriceListItem | None:
        result = await self._session.execute(
            select(PriceListItemModel).where(
                PriceListItemModel.user_id == str(user_id),
                PriceListItemModel.product_id == str(product_id),
                PriceListItemModel.tenant_id == str(tenant_id),
            )
        )
        row = result.scalar_one_or_none()
        return _item_to_domain(row) if row else None

    async def save(self, item: PriceListItem) -> None:
        existing = await self._session.get(PriceListItemModel, str(item.id))
        if existing:
            existing.purchase_price = (
                float(item.purchase_price.amount)
                if item.purchase_price is not None
                else None
            )
            existing.sale_price = (
                float(item.sale_price.amount) if item.sale_price is not None else None
            )
        else:
            self._session.add(
                PriceListItemModel(
                    id=str(item.id),
                    tenant_id=str(item.tenant_id),
                    user_id=str(item.user_id),
                    product_id=str(item.product_id),
                    purchase_price=(
                        float(item.purchase_price.amount)
                        if item.purchase_price is not None
                        else None
                    ),
                    sale_price=(
                        float(item.sale_price.amount)
                        if item.sale_price is not None
                        else None
                    ),
                    created_at=item.created_at,
                )
            )

    async def list_by_user(
        self, user_id: UUID, tenant_id: TenantId
    ) -> list[PriceListItem]:
        result = await self._session.execute(
            select(PriceListItemModel).where(
                PriceListItemModel.user_id == str(user_id),
                PriceListItemModel.tenant_id == str(tenant_id),
            )
        )
        return [_item_to_domain(row) for row in result.scalars()]

    async def delete(
        self, user_id: UUID, product_id: UUID, tenant_id: TenantId
    ) -> None:
        await self._session.execute(
            delete(PriceListItemModel).where(
                PriceListItemModel.user_id == str(user_id),
                PriceListItemModel.product_id == str(product_id),
                PriceListItemModel.tenant_id == str(tenant_id),
            )
        )


def _item_to_domain(row: PriceListItemModel) -> PriceListItem:
    i = PriceListItem.__new__(PriceListItem)
    i.id = UUID(row.id)
    i.tenant_id = TenantId(UUID(row.tenant_id))
    i.user_id = UUID(row.user_id)
    i.product_id = UUID(row.product_id)
    i.purchase_price = (
        Money(Decimal(str(row.purchase_price)))
        if row.purchase_price is not None
        else None
    )
    i.sale_price = (
        Money(Decimal(str(row.sale_price))) if row.sale_price is not None else None
    )
    i.created_at = row.created_at
    return i
