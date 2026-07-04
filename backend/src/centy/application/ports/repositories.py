from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from centy.domain.catalog.entities import Brand, GlassType, Product, ProductCategory
from centy.domain.customers.entities import Customer, CustomerLabel
from centy.domain.quotes.entities import Quote
from centy.domain.shared.value_objects import Email, TenantId
from centy.domain.users.entities import User
from centy.domain.warranties.entities import Warranty


@dataclass
class PasswordResetToken:
    token: str
    user_id: UUID
    tenant_id: str
    expires_at: datetime
    used_at: datetime | None
    created_at: datetime


class IUserRepository(ABC):
    """Puerto de salida para persistencia de usuarios.

    Las implementaciones concretas viven en infrastructure/persistence/repositories/.
    """

    @abstractmethod
    async def get_by_id(self, user_id: UUID, tenant_id: TenantId) -> User | None: ...

    @abstractmethod
    async def get_by_email(self, email: Email, tenant_id: TenantId) -> User | None: ...

    @abstractmethod
    async def save(self, user: User) -> None: ...

    @abstractmethod
    async def list_by_tenant(self, tenant_id: TenantId) -> list[User]: ...

    @abstractmethod
    async def delete(self, user_id: UUID, tenant_id: TenantId) -> None: ...


class ICustomerLabelRepository(ABC):
    """Puerto de salida para etiquetas de clientes."""

    @abstractmethod
    async def get_by_id(
        self, label_id: UUID, tenant_id: TenantId
    ) -> CustomerLabel | None: ...

    @abstractmethod
    async def save(self, label: CustomerLabel) -> None: ...

    @abstractmethod
    async def list_by_owner(
        self, owner_user_id: UUID, tenant_id: TenantId
    ) -> list[CustomerLabel]: ...

    @abstractmethod
    async def delete(self, label_id: UUID, tenant_id: TenantId) -> None: ...


class ICustomerRepository(ABC):
    """Puerto de salida para persistencia de clientes."""

    @abstractmethod
    async def get_by_id(
        self, customer_id: UUID, tenant_id: TenantId
    ) -> Customer | None: ...

    @abstractmethod
    async def save(self, customer: Customer) -> None: ...

    @abstractmethod
    async def list_by_owner(
        self, owner_user_id: UUID, tenant_id: TenantId
    ) -> list[Customer]: ...

    @abstractmethod
    async def list_by_tenant(self, tenant_id: TenantId) -> list[Customer]: ...

    @abstractmethod
    async def delete(self, customer_id: UUID, tenant_id: TenantId) -> None: ...


# ── Catalog repositories ──────────────────────────────────────────────────────


class IBrandRepository(ABC):
    @abstractmethod
    async def get_by_id(self, brand_id: UUID, tenant_id: TenantId) -> Brand | None: ...

    @abstractmethod
    async def save(self, brand: Brand) -> None: ...

    @abstractmethod
    async def list_by_tenant(self, tenant_id: TenantId) -> list[Brand]: ...

    @abstractmethod
    async def delete(self, brand_id: UUID, tenant_id: TenantId) -> None: ...


class IProductCategoryRepository(ABC):
    @abstractmethod
    async def get_by_id(
        self, category_id: UUID, tenant_id: TenantId
    ) -> ProductCategory | None: ...

    @abstractmethod
    async def save(self, category: ProductCategory) -> None: ...

    @abstractmethod
    async def list_by_tenant(self, tenant_id: TenantId) -> list[ProductCategory]: ...

    @abstractmethod
    async def delete(self, category_id: UUID, tenant_id: TenantId) -> None: ...


class IGlassTypeRepository(ABC):
    @abstractmethod
    async def get_by_id(
        self, glass_type_id: UUID, tenant_id: TenantId
    ) -> GlassType | None: ...

    @abstractmethod
    async def save(self, glass_type: GlassType) -> None: ...

    @abstractmethod
    async def list_by_tenant(self, tenant_id: TenantId) -> list[GlassType]: ...

    @abstractmethod
    async def delete(self, glass_type_id: UUID, tenant_id: TenantId) -> None: ...


class IProductRepository(ABC):
    @abstractmethod
    async def get_by_id(
        self, product_id: UUID, tenant_id: TenantId
    ) -> Product | None: ...

    @abstractmethod
    async def save(self, product: Product) -> None: ...

    @abstractmethod
    async def list_by_tenant(self, tenant_id: TenantId) -> list[Product]: ...

    @abstractmethod
    async def delete(self, product_id: UUID, tenant_id: TenantId) -> None: ...


class IQuoteRepository(ABC):
    @abstractmethod
    async def get_by_id(self, quote_id: UUID, tenant_id: TenantId) -> Quote | None: ...

    @abstractmethod
    async def save(self, quote: Quote) -> None: ...

    @abstractmethod
    async def list_by_tenant(self, tenant_id: TenantId) -> list[Quote]: ...

    @abstractmethod
    async def list_by_user(self, user_id: UUID, tenant_id: TenantId) -> list[Quote]: ...

    @abstractmethod
    async def delete(self, quote_id: UUID, tenant_id: TenantId) -> None: ...

    @abstractmethod
    async def next_sequence(self, tenant_id: TenantId, user_id: UUID) -> int: ...


class IWarrantyRepository(ABC):
    @abstractmethod
    async def get_by_id(
        self, warranty_id: UUID, tenant_id: TenantId
    ) -> Warranty | None: ...

    @abstractmethod
    async def save(self, warranty: Warranty) -> None: ...

    @abstractmethod
    async def list_by_tenant(self, tenant_id: TenantId) -> list[Warranty]: ...

    @abstractmethod
    async def list_by_user(
        self, user_id: UUID, tenant_id: TenantId
    ) -> list[Warranty]: ...

    @abstractmethod
    async def list_by_quote(
        self, quote_id: UUID, tenant_id: TenantId
    ) -> list[Warranty]: ...

    @abstractmethod
    async def next_sequence(self, tenant_id: TenantId) -> int: ...


class IPasswordResetTokenRepository(ABC):
    @abstractmethod
    async def save(self, token: PasswordResetToken) -> None: ...

    @abstractmethod
    async def get(self, token: str) -> PasswordResetToken | None: ...

    @abstractmethod
    async def mark_used(self, token: str) -> None: ...

    @abstractmethod
    async def delete_expired(self) -> None: ...
