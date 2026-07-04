from types import TracebackType
from typing import Self

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from centy.application.ports.unit_of_work import IUnitOfWork
from centy.infrastructure.persistence.repositories.customer_repo import (
    SQLAlchemyCustomerLabelRepository,
    SQLAlchemyCustomerRepository,
)
from centy.infrastructure.persistence.repositories.product_repo import (
    SQLAlchemyBrandRepository,
    SQLAlchemyGlassTypeRepository,
    SQLAlchemyProductCategoryRepository,
    SQLAlchemyProductRepository,
)
from centy.infrastructure.persistence.repositories.quote_repo import (
    SQLAlchemyQuoteRepository,
)
from centy.infrastructure.persistence.repositories.user_repo import (
    SQLAlchemyUserRepository,
)
from centy.infrastructure.persistence.repositories.warranty_repo import (
    SQLAlchemyWarrantyRepository,
)


class SQLAlchemyUnitOfWork(IUnitOfWork):
    def __init__(self, session_factory: async_sessionmaker[AsyncSession]) -> None:
        self._session_factory = session_factory

    async def __aenter__(self) -> Self:
        self._session: AsyncSession = self._session_factory()
        self.users = SQLAlchemyUserRepository(self._session)
        self.customers = SQLAlchemyCustomerRepository(self._session)
        self.customer_labels = SQLAlchemyCustomerLabelRepository(self._session)
        self.brands = SQLAlchemyBrandRepository(self._session)
        self.product_categories = SQLAlchemyProductCategoryRepository(self._session)
        self.glass_types = SQLAlchemyGlassTypeRepository(self._session)
        self.products = SQLAlchemyProductRepository(self._session)
        self.quotes = SQLAlchemyQuoteRepository(self._session)
        self.warranties = SQLAlchemyWarrantyRepository(self._session)
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: TracebackType | None,
    ) -> None:
        if exc_type is not None:
            await self.rollback()
        await self._session.close()

    async def commit(self) -> None:
        await self._session.commit()

    async def rollback(self) -> None:
        await self._session.rollback()
