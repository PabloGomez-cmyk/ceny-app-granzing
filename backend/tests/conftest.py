"""Fixtures compartidos y fakes en memoria para tests de use cases."""

from types import TracebackType
from typing import Self
from uuid import UUID, uuid4

import pytest

from centy.application.ports.auth import IPasswordHasher, ITokenService
from centy.application.ports.cache import ICacheService
from centy.application.ports.repositories import (
    IBrandRepository,
    ICustomerLabelRepository,
    ICustomerRepository,
    IGlassTypeRepository,
    IPriceListItemRepository,
    IProductCategoryRepository,
    IProductRepository,
    IUserRepository,
)
from centy.application.ports.unit_of_work import IUnitOfWork
from centy.domain.catalog.entities import Brand, GlassType, Product, ProductCategory
from centy.domain.customers.entities import Customer, CustomerLabel
from centy.domain.pricing.entities import PriceListItem
from centy.domain.shared.value_objects import Email, TenantId
from centy.domain.users.entities import Role, User
from centy.domain.users.value_objects import HashedPassword

# ── Fakes ─────────────────────────────────────────────────────────────────────


class FakeUserRepository(IUserRepository):
    def __init__(self) -> None:
        self._store: dict[UUID, User] = {}

    async def get_by_id(self, user_id: UUID, tenant_id: TenantId) -> User | None:
        u = self._store.get(user_id)
        return u if u and u.tenant_id == tenant_id else None

    async def get_by_email(self, email: Email, tenant_id: TenantId) -> User | None:
        return next(
            (
                u
                for u in self._store.values()
                if u.email == email and u.tenant_id == tenant_id
            ),
            None,
        )

    async def save(self, user: User) -> None:
        self._store[user.id] = user

    async def list_by_tenant(self, tenant_id: TenantId) -> list[User]:
        return [u for u in self._store.values() if u.tenant_id == tenant_id]

    async def delete(self, user_id: UUID, tenant_id: TenantId) -> None:
        self._store.pop(user_id, None)


class FakeCustomerLabelRepository(ICustomerLabelRepository):
    def __init__(self) -> None:
        self._store: dict[UUID, CustomerLabel] = {}

    async def get_by_id(
        self, label_id: UUID, tenant_id: TenantId
    ) -> CustomerLabel | None:
        lb = self._store.get(label_id)
        return lb if lb and lb.tenant_id == tenant_id else None

    async def save(self, label: CustomerLabel) -> None:
        self._store[label.id] = label

    async def list_by_owner(
        self, owner_user_id: UUID, tenant_id: TenantId
    ) -> list[CustomerLabel]:
        return [
            lb
            for lb in self._store.values()
            if lb.owner_user_id == owner_user_id and lb.tenant_id == tenant_id
        ]

    async def delete(self, label_id: UUID, tenant_id: TenantId) -> None:
        lb = self._store.get(label_id)
        if lb and lb.tenant_id == tenant_id:
            del self._store[label_id]


class FakeCustomerRepository(ICustomerRepository):
    def __init__(self) -> None:
        self._store: dict[UUID, Customer] = {}

    async def get_by_id(
        self, customer_id: UUID, tenant_id: TenantId
    ) -> Customer | None:
        c = self._store.get(customer_id)
        return c if c and c.tenant_id == tenant_id else None

    async def save(self, customer: Customer) -> None:
        self._store[customer.id] = customer

    async def list_by_owner(
        self, owner_user_id: UUID, tenant_id: TenantId
    ) -> list[Customer]:
        return [
            c
            for c in self._store.values()
            if c.owner_user_id == owner_user_id and c.tenant_id == tenant_id
        ]

    async def list_by_tenant(self, tenant_id: TenantId) -> list[Customer]:
        return [c for c in self._store.values() if c.tenant_id == tenant_id]

    async def delete(self, customer_id: UUID, tenant_id: TenantId) -> None:
        c = self._store.get(customer_id)
        if c and c.tenant_id == tenant_id:
            del self._store[customer_id]


class FakeBrandRepository(IBrandRepository):
    def __init__(self) -> None:
        self._store: dict[UUID, Brand] = {}

    async def get_by_id(self, brand_id: UUID, tenant_id: TenantId) -> Brand | None:
        b = self._store.get(brand_id)
        return b if b and b.tenant_id == tenant_id else None

    async def save(self, brand: Brand) -> None:
        self._store[brand.id] = brand

    async def list_by_tenant(self, tenant_id: TenantId) -> list[Brand]:
        return [b for b in self._store.values() if b.tenant_id == tenant_id]

    async def delete(self, brand_id: UUID, tenant_id: TenantId) -> None:
        b = self._store.get(brand_id)
        if b and b.tenant_id == tenant_id:
            del self._store[brand_id]


class FakeProductCategoryRepository(IProductCategoryRepository):
    def __init__(self) -> None:
        self._store: dict[UUID, ProductCategory] = {}

    async def get_by_id(
        self, category_id: UUID, tenant_id: TenantId
    ) -> ProductCategory | None:
        c = self._store.get(category_id)
        return c if c and c.tenant_id == tenant_id else None

    async def save(self, category: ProductCategory) -> None:
        self._store[category.id] = category

    async def list_by_tenant(self, tenant_id: TenantId) -> list[ProductCategory]:
        return [c for c in self._store.values() if c.tenant_id == tenant_id]

    async def delete(self, category_id: UUID, tenant_id: TenantId) -> None:
        c = self._store.get(category_id)
        if c and c.tenant_id == tenant_id:
            del self._store[category_id]


class FakeGlassTypeRepository(IGlassTypeRepository):
    def __init__(self) -> None:
        self._store: dict[UUID, GlassType] = {}

    async def get_by_id(
        self, glass_type_id: UUID, tenant_id: TenantId
    ) -> GlassType | None:
        g = self._store.get(glass_type_id)
        return g if g and g.tenant_id == tenant_id else None

    async def save(self, glass_type: GlassType) -> None:
        self._store[glass_type.id] = glass_type

    async def list_by_tenant(self, tenant_id: TenantId) -> list[GlassType]:
        return [g for g in self._store.values() if g.tenant_id == tenant_id]

    async def delete(self, glass_type_id: UUID, tenant_id: TenantId) -> None:
        g = self._store.get(glass_type_id)
        if g and g.tenant_id == tenant_id:
            del self._store[glass_type_id]


class FakeProductRepository(IProductRepository):
    def __init__(self) -> None:
        self._store: dict[UUID, Product] = {}

    async def get_by_id(self, product_id: UUID, tenant_id: TenantId) -> Product | None:
        p = self._store.get(product_id)
        return p if p and p.tenant_id == tenant_id else None

    async def save(self, product: Product) -> None:
        self._store[product.id] = product

    async def list_by_tenant(self, tenant_id: TenantId) -> list[Product]:
        return [p for p in self._store.values() if p.tenant_id == tenant_id]

    async def delete(self, product_id: UUID, tenant_id: TenantId) -> None:
        p = self._store.get(product_id)
        if p and p.tenant_id == tenant_id:
            del self._store[product_id]


class FakePriceListItemRepository(IPriceListItemRepository):
    def __init__(self) -> None:
        self._store: dict[tuple[UUID, UUID], PriceListItem] = {}

    async def get_by_user_and_product(
        self, user_id: UUID, product_id: UUID, tenant_id: TenantId
    ) -> PriceListItem | None:
        item = self._store.get((user_id, product_id))
        return item if item and item.tenant_id == tenant_id else None

    async def save(self, item: PriceListItem) -> None:
        self._store[(item.user_id, item.product_id)] = item

    async def list_by_user(
        self, user_id: UUID, tenant_id: TenantId
    ) -> list[PriceListItem]:
        return [
            i
            for i in self._store.values()
            if i.user_id == user_id and i.tenant_id == tenant_id
        ]

    async def delete(
        self, user_id: UUID, product_id: UUID, tenant_id: TenantId
    ) -> None:
        item = self._store.get((user_id, product_id))
        if item and item.tenant_id == tenant_id:
            del self._store[(user_id, product_id)]


class FakeUnitOfWork(IUnitOfWork):
    def __init__(self, repo: FakeUserRepository | None = None) -> None:
        self.users: FakeUserRepository = repo or FakeUserRepository()
        self.customers: FakeCustomerRepository = FakeCustomerRepository()
        self.customer_labels: FakeCustomerLabelRepository = (
            FakeCustomerLabelRepository()
        )
        self.brands: FakeBrandRepository = FakeBrandRepository()
        self.product_categories: FakeProductCategoryRepository = (
            FakeProductCategoryRepository()
        )
        self.glass_types: FakeGlassTypeRepository = FakeGlassTypeRepository()
        self.products: FakeProductRepository = FakeProductRepository()
        self.price_list_items: FakePriceListItemRepository = (
            FakePriceListItemRepository()
        )
        self.committed = False

    async def __aenter__(self) -> Self:
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: TracebackType | None,
    ) -> None:
        pass

    async def commit(self) -> None:
        self.committed = True

    async def rollback(self) -> None:
        pass


class FakePasswordHasher(IPasswordHasher):
    """Hash determinístico para tests: evita el costo de bcrypt."""

    def hash(self, plain_password: str) -> HashedPassword:
        return HashedPassword(f"fake:{plain_password}")

    def verify(self, plain_password: str, hashed: HashedPassword) -> bool:
        return hashed.value == f"fake:{plain_password}"


class FakeTokenService(ITokenService):
    def create_access_token(self, subject: str, extra_claims: dict[str, str]) -> str:
        role = extra_claims.get("role", "")
        tenant = extra_claims.get("tenant_id", "")
        email = extra_claims.get("email", "")
        return f"access|{subject}|{tenant}|{role}|{email}"

    def create_refresh_token(self, subject: str) -> str:
        return f"refresh|{subject}|{uuid4()}"

    def decode_access_token(self, token: str) -> dict[str, str]:
        _, sub, tenant, role, email = token.split("|", 4)
        return {
            "sub": sub,
            "tenant_id": tenant,
            "role": role,
            "email": email,
            "type": "access",
        }

    def decode_refresh_token(self, token: str) -> dict[str, str]:
        parts = token.split("|")
        return {"sub": parts[1], "jti": parts[2], "type": "refresh", "tenant_id": ""}


class FakeCacheService(ICacheService):
    def __init__(self) -> None:
        self._store: dict[str, str] = {}

    async def get(self, key: str) -> str | None:
        return self._store.get(key)

    async def set(self, key: str, value: str, ttl_seconds: int) -> None:
        self._store[key] = value

    async def delete(self, key: str) -> None:
        self._store.pop(key, None)

    async def exists(self, key: str) -> bool:
        return key in self._store


# ── Fixtures de dominio ───────────────────────────────────────────────────────


@pytest.fixture
def tenant_id() -> TenantId:
    return TenantId(uuid4())


@pytest.fixture
def fake_repo() -> FakeUserRepository:
    return FakeUserRepository()


@pytest.fixture
def fake_uow(fake_repo: FakeUserRepository) -> FakeUnitOfWork:
    return FakeUnitOfWork(repo=fake_repo)


@pytest.fixture
def fake_hasher() -> FakePasswordHasher:
    return FakePasswordHasher()


@pytest.fixture
def fake_tokens() -> FakeTokenService:
    return FakeTokenService()


@pytest.fixture
def fake_cache() -> FakeCacheService:
    return FakeCacheService()


@pytest.fixture
def admin_user(tenant_id: TenantId) -> User:
    return User.create(
        tenant_id=tenant_id,
        email=Email("admin@glazing.com"),
        hashed_password=HashedPassword("fake:admin123"),
        full_name="Admin Glazing",
        role=Role.ADMIN,
    )


@pytest.fixture
def operator_user(tenant_id: TenantId) -> User:
    return User.create(
        tenant_id=tenant_id,
        email=Email("operator@glazing.com"),
        hashed_password=HashedPassword("fake:op123"),
        full_name="Operador Test",
        role=Role.OPERATOR,
    )


@pytest.fixture
def fake_label_repo() -> FakeCustomerLabelRepository:
    return FakeCustomerLabelRepository()


@pytest.fixture
def fake_customer_repo() -> FakeCustomerRepository:
    return FakeCustomerRepository()


@pytest.fixture
def fake_customer_uow(
    fake_customer_repo: FakeCustomerRepository,
    fake_label_repo: FakeCustomerLabelRepository,
) -> FakeUnitOfWork:
    uow = FakeUnitOfWork()
    uow.customers = fake_customer_repo
    uow.customer_labels = fake_label_repo
    return uow
