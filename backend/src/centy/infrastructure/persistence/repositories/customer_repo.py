from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from centy.application.ports.repositories import ICustomerLabelRepository, ICustomerRepository
from centy.domain.customers.entities import Customer, CustomerLabel
from centy.domain.shared.value_objects import Email, TenantId
from centy.infrastructure.persistence.models.customer import CustomerLabelModel, CustomerModel


def _label_to_domain(m: CustomerLabelModel) -> CustomerLabel:
    return CustomerLabel(
        id=UUID(m.id),
        tenant_id=TenantId(UUID(m.tenant_id)),
        owner_user_id=UUID(m.owner_user_id),
        name=m.name,
        color=m.color,
        is_active=m.is_active,
        created_at=m.created_at,
    )


def _label_to_model(lb: CustomerLabel) -> CustomerLabelModel:
    return CustomerLabelModel(
        id=str(lb.id),
        tenant_id=str(lb.tenant_id),
        owner_user_id=str(lb.owner_user_id),
        name=lb.name,
        color=lb.color,
        is_active=lb.is_active,
        created_at=lb.created_at,
    )


def _customer_to_domain(m: CustomerModel) -> Customer:
    return Customer(
        id=UUID(m.id),
        tenant_id=TenantId(UUID(m.tenant_id)),
        owner_user_id=UUID(m.owner_user_id),
        name=m.name,
        email=Email(m.email) if m.email else None,
        phone=m.phone,
        address=m.address,
        city=m.city,
        province=m.province,
        neighborhood=m.neighborhood,
        postal_code=m.postal_code,
        label_id=UUID(m.label_id) if m.label_id else None,
        notes=m.notes,
        is_active=m.is_active,
        created_at=m.created_at,
    )


def _customer_to_model(c: Customer) -> CustomerModel:
    return CustomerModel(
        id=str(c.id),
        tenant_id=str(c.tenant_id),
        owner_user_id=str(c.owner_user_id),
        name=c.name,
        email=c.email.value if c.email else None,
        phone=c.phone,
        address=c.address,
        city=c.city,
        province=c.province,
        neighborhood=c.neighborhood,
        postal_code=c.postal_code,
        label_id=str(c.label_id) if c.label_id else None,
        notes=c.notes,
        is_active=c.is_active,
        created_at=c.created_at,
    )


class SQLAlchemyCustomerLabelRepository(ICustomerLabelRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, label_id: UUID, tenant_id: TenantId) -> CustomerLabel | None:
        result = await self._session.execute(
            select(CustomerLabelModel).where(
                CustomerLabelModel.id == str(label_id),
                CustomerLabelModel.tenant_id == str(tenant_id),
            )
        )
        model = result.scalar_one_or_none()
        return _label_to_domain(model) if model else None

    async def save(self, label: CustomerLabel) -> None:
        existing = await self._session.get(CustomerLabelModel, str(label.id))
        if existing is None:
            self._session.add(_label_to_model(label))
        else:
            existing.name = label.name
            existing.color = label.color
            existing.is_active = label.is_active

    async def list_by_owner(self, owner_user_id: UUID, tenant_id: TenantId) -> list[CustomerLabel]:
        result = await self._session.execute(
            select(CustomerLabelModel)
            .where(
                CustomerLabelModel.owner_user_id == str(owner_user_id),
                CustomerLabelModel.tenant_id == str(tenant_id),
            )
            .order_by(CustomerLabelModel.created_at)
        )
        return [_label_to_domain(m) for m in result.scalars().all()]

    async def delete(self, label_id: UUID, tenant_id: TenantId) -> None:
        model = await self._session.get(CustomerLabelModel, str(label_id))
        if model and model.tenant_id == str(tenant_id):
            await self._session.delete(model)


class SQLAlchemyCustomerRepository(ICustomerRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, customer_id: UUID, tenant_id: TenantId) -> Customer | None:
        result = await self._session.execute(
            select(CustomerModel).where(
                CustomerModel.id == str(customer_id),
                CustomerModel.tenant_id == str(tenant_id),
            )
        )
        model = result.scalar_one_or_none()
        return _customer_to_domain(model) if model else None

    async def save(self, customer: Customer) -> None:
        existing = await self._session.get(CustomerModel, str(customer.id))
        if existing is None:
            self._session.add(_customer_to_model(customer))
        else:
            existing.name = customer.name
            existing.email = customer.email.value if customer.email else None
            existing.phone = customer.phone
            existing.address = customer.address
            existing.city = customer.city
            existing.province = customer.province
            existing.neighborhood = customer.neighborhood
            existing.postal_code = customer.postal_code
            existing.label_id = str(customer.label_id) if customer.label_id else None
            existing.notes = customer.notes
            existing.is_active = customer.is_active

    async def list_by_owner(self, owner_user_id: UUID, tenant_id: TenantId) -> list[Customer]:
        result = await self._session.execute(
            select(CustomerModel)
            .where(
                CustomerModel.owner_user_id == str(owner_user_id),
                CustomerModel.tenant_id == str(tenant_id),
            )
            .order_by(CustomerModel.created_at.desc())
        )
        return [_customer_to_domain(m) for m in result.scalars().all()]

    async def list_by_tenant(self, tenant_id: TenantId) -> list[Customer]:
        result = await self._session.execute(
            select(CustomerModel)
            .where(CustomerModel.tenant_id == str(tenant_id))
            .order_by(CustomerModel.created_at.desc())
        )
        return [_customer_to_domain(m) for m in result.scalars().all()]

    async def delete(self, customer_id: UUID, tenant_id: TenantId) -> None:
        model = await self._session.get(CustomerModel, str(customer_id))
        if model and model.tenant_id == str(tenant_id):
            await self._session.delete(model)
