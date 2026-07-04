from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from centy.application.ports.repositories import IUserRepository
from centy.domain.shared.value_objects import Email, TenantId
from centy.domain.users.entities import Role, User
from centy.domain.users.value_objects import HashedPassword
from centy.infrastructure.persistence.models.user import UserModel


def _to_domain(m: UserModel) -> User:
    return User(
        id=UUID(m.id),
        tenant_id=TenantId(UUID(m.tenant_id)),
        email=Email(m.email),
        hashed_password=HashedPassword(m.hashed_password),
        full_name=m.full_name,
        role=Role(m.role),
        is_active=m.is_active,
        created_at=m.created_at,
        company_name=m.company_name,
        company_logo_url=m.company_logo_url,
        company_street=m.company_street,
        company_city=m.company_city,
        company_province=m.company_province,
        company_postal_code=m.company_postal_code,
        company_cuit=m.company_cuit,
        company_color_primary=m.company_color_primary,
        company_color_secondary=m.company_color_secondary,
        default_commercial_conditions=m.default_commercial_conditions,
    )


def _to_model(u: User) -> UserModel:
    return UserModel(
        id=str(u.id),
        tenant_id=str(u.tenant_id),
        email=u.email.value,
        hashed_password=u.hashed_password.value,
        full_name=u.full_name,
        role=u.role.value,
        is_active=u.is_active,
        created_at=u.created_at,
        company_name=u.company_name,
        company_logo_url=u.company_logo_url,
        company_street=u.company_street,
        company_city=u.company_city,
        company_province=u.company_province,
        company_postal_code=u.company_postal_code,
        company_cuit=u.company_cuit,
        company_color_primary=u.company_color_primary,
        company_color_secondary=u.company_color_secondary,
        default_commercial_conditions=u.default_commercial_conditions,
    )


class SQLAlchemyUserRepository(IUserRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, user_id: UUID, tenant_id: TenantId) -> User | None:
        result = await self._session.execute(
            select(UserModel).where(
                UserModel.id == str(user_id),
                UserModel.tenant_id == str(tenant_id),
            )
        )
        model = result.scalar_one_or_none()
        return _to_domain(model) if model else None

    async def get_by_email(self, email: Email, tenant_id: TenantId) -> User | None:
        result = await self._session.execute(
            select(UserModel).where(
                UserModel.email == email.value,
                UserModel.tenant_id == str(tenant_id),
            )
        )
        model = result.scalar_one_or_none()
        return _to_domain(model) if model else None

    async def save(self, user: User) -> None:
        existing = await self._session.get(UserModel, str(user.id))
        if existing is None:
            self._session.add(_to_model(user))
        else:
            existing.email = user.email.value
            existing.hashed_password = user.hashed_password.value
            existing.full_name = user.full_name
            existing.role = user.role.value
            existing.is_active = user.is_active
            existing.company_name = user.company_name
            existing.company_logo_url = user.company_logo_url
            existing.company_street = user.company_street
            existing.company_city = user.company_city
            existing.company_province = user.company_province
            existing.company_postal_code = user.company_postal_code
            existing.company_cuit = user.company_cuit
            existing.company_color_primary = user.company_color_primary
            existing.company_color_secondary = user.company_color_secondary
            existing.default_commercial_conditions = user.default_commercial_conditions

    async def list_by_tenant(self, tenant_id: TenantId) -> list[User]:
        result = await self._session.execute(
            select(UserModel)
            .where(UserModel.tenant_id == str(tenant_id))
            .order_by(UserModel.created_at)
        )
        return [_to_domain(m) for m in result.scalars().all()]

    async def delete(self, user_id: UUID, tenant_id: TenantId) -> None:
        model = await self._session.get(UserModel, str(user_id))
        if model and model.tenant_id == str(tenant_id):
            await self._session.delete(model)
