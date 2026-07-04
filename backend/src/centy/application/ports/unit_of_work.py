from abc import ABC, abstractmethod
from types import TracebackType
from typing import Self

from centy.application.ports.repositories import (
    IBrandRepository,
    ICustomerLabelRepository,
    ICustomerRepository,
    IGlassTypeRepository,
    IProductCategoryRepository,
    IProductRepository,
    IQuoteRepository,
    IUserRepository,
    IWarrantyRepository,
)


class IUnitOfWork(ABC):
    """Coordina transacciones atómicas entre múltiples repositorios."""

    users: IUserRepository
    customers: ICustomerRepository
    customer_labels: ICustomerLabelRepository
    brands: IBrandRepository
    product_categories: IProductCategoryRepository
    glass_types: IGlassTypeRepository
    products: IProductRepository
    quotes: IQuoteRepository
    warranties: IWarrantyRepository

    @abstractmethod
    async def __aenter__(self) -> Self:
        ...

    @abstractmethod
    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: TracebackType | None,
    ) -> None:
        ...

    @abstractmethod
    async def commit(self) -> None:
        ...

    @abstractmethod
    async def rollback(self) -> None:
        ...
