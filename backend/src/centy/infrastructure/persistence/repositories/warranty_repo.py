from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from centy.application.ports.repositories import IWarrantyRepository
from centy.domain.shared.value_objects import TenantId
from centy.domain.warranties.entities import Warranty
from centy.infrastructure.persistence.models.warranty import WarrantyModel


def _to_domain(m: WarrantyModel) -> Warranty:
    return Warranty(
        id=UUID(m.id),
        tenant_id=TenantId(UUID(m.tenant_id)),
        quote_id=UUID(m.quote_id),
        quote_line_id=UUID(m.quote_line_id),
        product_id=UUID(m.product_id),
        product_snapshot=m.product_snapshot,
        warranty_number=m.warranty_number,
        customer_snapshot=m.customer_snapshot,
        created_by_user_id=UUID(m.created_by_user_id),
        warranty_years=m.warranty_years,
        expires_at=m.expires_at,
        sent_at=m.sent_at,
        created_at=m.created_at,
    )


class SQLAlchemyWarrantyRepository(IWarrantyRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, warranty_id: UUID, tenant_id: TenantId) -> Warranty | None:
        result = await self._session.execute(
            select(WarrantyModel).where(
                WarrantyModel.id == str(warranty_id),
                WarrantyModel.tenant_id == str(tenant_id),
            )
        )
        model = result.scalar_one_or_none()
        return _to_domain(model) if model else None

    async def save(self, warranty: Warranty) -> None:
        existing = await self._session.get(WarrantyModel, str(warranty.id))
        if existing is None:
            self._session.add(
                WarrantyModel(
                    id=str(warranty.id),
                    tenant_id=str(warranty.tenant_id),
                    quote_id=str(warranty.quote_id),
                    quote_line_id=str(warranty.quote_line_id),
                    product_id=str(warranty.product_id),
                    product_snapshot=warranty.product_snapshot,
                    warranty_number=warranty.warranty_number,
                    customer_snapshot=warranty.customer_snapshot,
                    created_by_user_id=str(warranty.created_by_user_id),
                    warranty_years=warranty.warranty_years,
                    expires_at=warranty.expires_at,
                    sent_at=warranty.sent_at,
                    created_at=warranty.created_at,
                )
            )
        else:
            existing.sent_at = warranty.sent_at

    async def list_by_tenant(self, tenant_id: TenantId) -> list[Warranty]:
        result = await self._session.execute(
            select(WarrantyModel)
            .where(WarrantyModel.tenant_id == str(tenant_id))
            .order_by(WarrantyModel.created_at.desc())
        )
        return [_to_domain(m) for m in result.scalars().all()]

    async def list_by_user(self, user_id: UUID, tenant_id: TenantId) -> list[Warranty]:
        result = await self._session.execute(
            select(WarrantyModel)
            .where(
                WarrantyModel.created_by_user_id == str(user_id),
                WarrantyModel.tenant_id == str(tenant_id),
            )
            .order_by(WarrantyModel.created_at.desc())
        )
        return [_to_domain(m) for m in result.scalars().all()]

    async def list_by_quote(self, quote_id: UUID, tenant_id: TenantId) -> list[Warranty]:
        result = await self._session.execute(
            select(WarrantyModel)
            .where(
                WarrantyModel.quote_id == str(quote_id),
                WarrantyModel.tenant_id == str(tenant_id),
            )
            .order_by(WarrantyModel.created_at.asc())
        )
        return [_to_domain(m) for m in result.scalars().all()]

    async def next_sequence(self, tenant_id: TenantId) -> int:
        result = await self._session.execute(
            select(func.count())
            .select_from(WarrantyModel)
            .where(WarrantyModel.tenant_id == str(tenant_id))
        )
        count = result.scalar_one()
        return (count or 0) + 1
