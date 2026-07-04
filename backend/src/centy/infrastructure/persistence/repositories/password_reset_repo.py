from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import delete, update
from sqlalchemy.ext.asyncio import AsyncSession

from centy.application.ports.repositories import (
    IPasswordResetTokenRepository,
    PasswordResetToken,
)
from centy.infrastructure.persistence.models.password_reset import (
    PasswordResetTokenModel,
)


class SQLAlchemyPasswordResetTokenRepository(IPasswordResetTokenRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    def _to_domain(self, model: PasswordResetTokenModel) -> PasswordResetToken:
        return PasswordResetToken(
            token=model.token,
            user_id=UUID(model.user_id),
            tenant_id=model.tenant_id,
            expires_at=model.expires_at,
            used_at=model.used_at,
            created_at=model.created_at,
        )

    async def save(self, token: PasswordResetToken) -> None:
        self._session.add(
            PasswordResetTokenModel(
                token=token.token,
                user_id=str(token.user_id),
                tenant_id=token.tenant_id,
                expires_at=token.expires_at,
                used_at=token.used_at,
                created_at=token.created_at,
            )
        )
        await self._session.commit()

    async def get(self, token: str) -> PasswordResetToken | None:
        model = await self._session.get(PasswordResetTokenModel, token)
        return self._to_domain(model) if model else None

    async def mark_used(self, token: str) -> None:
        stmt = (
            update(PasswordResetTokenModel)
            .where(PasswordResetTokenModel.token == token)
            .values(used_at=datetime.now(tz=UTC))
        )
        await self._session.execute(stmt)
        await self._session.commit()

    async def delete_expired(self) -> None:
        stmt = delete(PasswordResetTokenModel).where(
            PasswordResetTokenModel.expires_at < datetime.now(tz=UTC)
        )
        await self._session.execute(stmt)
        await self._session.commit()
