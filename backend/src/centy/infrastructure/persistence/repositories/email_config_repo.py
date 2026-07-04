from datetime import datetime, timezone
from uuid import UUID, uuid4

from cryptography.fernet import Fernet
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from centy.application.ports.email import IEmailConfigRepository, UserEmailConfig
from centy.infrastructure.persistence.models.email_config import UserEmailConfigModel
from centy.infrastructure.persistence.models.user import UserModel


class SQLAlchemyEmailConfigRepository(IEmailConfigRepository):
    def __init__(self, session: AsyncSession, encryption_key: bytes) -> None:
        self._session = session
        self._fernet = Fernet(encryption_key)

    def _encrypt(self, value: str) -> str:
        return self._fernet.encrypt(value.encode()).decode()

    def _decrypt(self, value: str) -> str:
        return self._fernet.decrypt(value.encode()).decode()

    def _to_domain(self, model: UserEmailConfigModel) -> UserEmailConfig:
        return UserEmailConfig(
            user_id=UUID(model.user_id),
            tenant_id=model.tenant_id,
            gmail_email=model.gmail_email,
            access_token=self._decrypt(model.access_token_enc),
            refresh_token=self._decrypt(model.refresh_token_enc),
            token_expiry=model.token_expiry,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )

    async def get_by_user_id(self, user_id: UUID, tenant_id: str) -> UserEmailConfig | None:
        stmt = select(UserEmailConfigModel).where(
            UserEmailConfigModel.user_id == str(user_id),
            UserEmailConfigModel.tenant_id == tenant_id,
        )
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        return self._to_domain(model) if model else None

    async def save(self, config: UserEmailConfig) -> None:
        stmt = select(UserEmailConfigModel).where(
            UserEmailConfigModel.user_id == str(config.user_id),
            UserEmailConfigModel.tenant_id == config.tenant_id,
        )
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()

        if model is None:
            model = UserEmailConfigModel(
                id=str(uuid4()),
                user_id=str(config.user_id),
                tenant_id=config.tenant_id,
                gmail_email=config.gmail_email,
                access_token_enc=self._encrypt(config.access_token),
                refresh_token_enc=self._encrypt(config.refresh_token),
                token_expiry=config.token_expiry,
                created_at=config.created_at,
                updated_at=config.updated_at,
            )
            self._session.add(model)
        else:
            model.gmail_email = config.gmail_email
            model.access_token_enc = self._encrypt(config.access_token)
            model.refresh_token_enc = self._encrypt(config.refresh_token)
            model.token_expiry = config.token_expiry
            model.updated_at = datetime.now(tz=timezone.utc)

        await self._session.commit()

    async def delete(self, user_id: UUID, tenant_id: str) -> None:
        stmt = delete(UserEmailConfigModel).where(
            UserEmailConfigModel.user_id == str(user_id),
            UserEmailConfigModel.tenant_id == tenant_id,
        )
        await self._session.execute(stmt)
        await self._session.commit()

    async def get_any_for_tenant(self, tenant_id: str) -> UserEmailConfig | None:
        stmt = (
            select(UserEmailConfigModel)
            .where(UserEmailConfigModel.tenant_id == tenant_id)
            .limit(1)
        )
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        return self._to_domain(model) if model else None

    async def get_admin_config(self, tenant_id: str) -> UserEmailConfig | None:
        stmt = (
            select(UserEmailConfigModel)
            .join(UserModel, UserModel.id == UserEmailConfigModel.user_id)
            .where(
                UserEmailConfigModel.tenant_id == tenant_id,
                UserModel.role == "ADMIN",
                UserModel.is_active.is_(True),
            )
            .limit(1)
        )
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        return self._to_domain(model) if model else None
