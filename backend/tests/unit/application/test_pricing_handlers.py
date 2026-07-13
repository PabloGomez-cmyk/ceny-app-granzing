"""Tests para los use cases de Pricing (overrides de costo/precio por operador)."""

from decimal import Decimal
from uuid import uuid4

import pytest

from centy.application.pricing.commands import (
    DeletePriceOverrideCommand,
    SetPriceOverrideCommand,
)
from centy.application.pricing.handlers import (
    DeletePriceOverrideHandler,
    GetEffectivePriceListHandler,
    SetPriceOverrideHandler,
)
from centy.application.pricing.queries import GetEffectivePriceListQuery
from centy.domain.catalog.entities import Product
from centy.domain.shared.exceptions import AuthorizationError, NotFoundError
from centy.domain.shared.value_objects import Email, TenantId
from centy.domain.users.entities import Role, User
from centy.domain.users.value_objects import HashedPassword
from tests.conftest import FakeUnitOfWork

# ── Fixtures ──────────────────────────────────────────────────────────────────


@pytest.fixture
def tenant_id() -> TenantId:
    return TenantId(uuid4())


def _make_user(tenant_id: TenantId, role: Role, email: str) -> User:
    return User.create(
        tenant_id=tenant_id,
        email=Email(email),
        hashed_password=HashedPassword("fake:x"),
        full_name="Test User",
        role=role,
    )


def _make_product(tenant_id: TenantId, **overrides) -> Product:  # type: ignore[no-untyped-def]
    defaults: dict = dict(
        tenant_id=tenant_id,
        name="Film Test",
        brand_id=uuid4(),
        sale_price_per_m2=Decimal("1000.00"),
        purchase_price_per_m2=Decimal("500.00"),
        uv_percentage=Decimal("90"),
        irr_percentage=Decimal("70"),
        tser_percentage=Decimal("50"),
        warranty_years=5,
        category_id=uuid4(),
        application_types=["WINDOW"],
    )
    defaults.update(overrides)
    return Product.create(**defaults)


@pytest.fixture
def admin(tenant_id: TenantId) -> User:
    return _make_user(tenant_id, Role.ADMIN, "admin@test.com")


@pytest.fixture
def operator(tenant_id: TenantId) -> User:
    return _make_user(tenant_id, Role.OPERATOR, "operator@test.com")


@pytest.fixture
def other_operator(tenant_id: TenantId) -> User:
    return _make_user(tenant_id, Role.OPERATOR, "other@test.com")


@pytest.fixture
def product(tenant_id: TenantId) -> Product:
    return _make_product(tenant_id)


@pytest.fixture
def uow(
    tenant_id: TenantId,
    admin: User,
    operator: User,
    other_operator: User,
    product: Product,
) -> FakeUnitOfWork:
    u = FakeUnitOfWork()
    u.users._store[admin.id] = admin
    u.users._store[operator.id] = operator
    u.users._store[other_operator.id] = other_operator
    u.products._store[product.id] = product
    return u


# ── SetPriceOverrideHandler ───────────────────────────────────────────────────


class TestSetPriceOverrideHandler:
    async def test_admin_crea_override_de_costo_y_precio(
        self,
        uow: FakeUnitOfWork,
        tenant_id: TenantId,
        admin: User,
        operator: User,
        product: Product,
    ) -> None:
        result = await SetPriceOverrideHandler(uow).handle(
            SetPriceOverrideCommand(
                tenant_id=tenant_id,
                requester_user_id=admin.id,
                requester_role="ADMIN",
                user_id=operator.id,
                product_id=product.id,
                purchase_price=Decimal("300.00"),
                sale_price=Decimal("1200.00"),
            )
        )
        assert result.purchase_price == Decimal("300.00")
        assert result.sale_price == Decimal("1200.00")
        assert uow.committed is True

    async def test_admin_carga_solo_costo_sin_tocar_precio(
        self,
        uow: FakeUnitOfWork,
        tenant_id: TenantId,
        admin: User,
        operator: User,
        product: Product,
    ) -> None:
        result = await SetPriceOverrideHandler(uow).handle(
            SetPriceOverrideCommand(
                tenant_id=tenant_id,
                requester_user_id=admin.id,
                requester_role="ADMIN",
                user_id=operator.id,
                product_id=product.id,
                purchase_price=Decimal("300.00"),
            )
        )
        assert result.purchase_price == Decimal("300.00")
        assert result.sale_price is None

    async def test_upsert_actualiza_override_existente(
        self,
        uow: FakeUnitOfWork,
        tenant_id: TenantId,
        admin: User,
        operator: User,
        product: Product,
    ) -> None:
        handler = SetPriceOverrideHandler(uow)
        await handler.handle(
            SetPriceOverrideCommand(
                tenant_id=tenant_id,
                requester_user_id=admin.id,
                requester_role="ADMIN",
                user_id=operator.id,
                product_id=product.id,
                purchase_price=Decimal("300.00"),
            )
        )
        result = await handler.handle(
            SetPriceOverrideCommand(
                tenant_id=tenant_id,
                requester_user_id=admin.id,
                requester_role="ADMIN",
                user_id=operator.id,
                product_id=product.id,
                purchase_price=Decimal("350.00"),
            )
        )
        assert result.purchase_price == Decimal("350.00")
        items = await uow.price_list_items.list_by_user(operator.id, tenant_id)
        assert len(items) == 1

    async def test_operador_no_puede_setear_precios(
        self, uow: FakeUnitOfWork, tenant_id: TenantId, operator: User, product: Product
    ) -> None:
        with pytest.raises(AuthorizationError):
            await SetPriceOverrideHandler(uow).handle(
                SetPriceOverrideCommand(
                    tenant_id=tenant_id,
                    requester_user_id=operator.id,
                    requester_role="OPERATOR",
                    user_id=operator.id,
                    product_id=product.id,
                    purchase_price=Decimal("1.00"),
                )
            )

    async def test_usuario_de_otro_tenant_lanza_not_found(
        self, uow: FakeUnitOfWork, admin: User, product: Product
    ) -> None:
        otro_tenant = TenantId(uuid4())
        with pytest.raises(NotFoundError):
            await SetPriceOverrideHandler(uow).handle(
                SetPriceOverrideCommand(
                    tenant_id=otro_tenant,
                    requester_user_id=admin.id,
                    requester_role="ADMIN",
                    user_id=uuid4(),
                    product_id=product.id,
                    purchase_price=Decimal("1.00"),
                )
            )

    async def test_producto_inexistente_lanza_not_found(
        self, uow: FakeUnitOfWork, tenant_id: TenantId, admin: User, operator: User
    ) -> None:
        with pytest.raises(NotFoundError):
            await SetPriceOverrideHandler(uow).handle(
                SetPriceOverrideCommand(
                    tenant_id=tenant_id,
                    requester_user_id=admin.id,
                    requester_role="ADMIN",
                    user_id=operator.id,
                    product_id=uuid4(),
                    purchase_price=Decimal("1.00"),
                )
            )


# ── DeletePriceOverrideHandler ────────────────────────────────────────────────


class TestDeletePriceOverrideHandler:
    async def test_admin_borra_override(
        self,
        uow: FakeUnitOfWork,
        tenant_id: TenantId,
        admin: User,
        operator: User,
        product: Product,
    ) -> None:
        await SetPriceOverrideHandler(uow).handle(
            SetPriceOverrideCommand(
                tenant_id=tenant_id,
                requester_user_id=admin.id,
                requester_role="ADMIN",
                user_id=operator.id,
                product_id=product.id,
                purchase_price=Decimal("300.00"),
            )
        )
        await DeletePriceOverrideHandler(uow).handle(
            DeletePriceOverrideCommand(
                tenant_id=tenant_id,
                requester_user_id=admin.id,
                requester_role="ADMIN",
                user_id=operator.id,
                product_id=product.id,
            )
        )
        item = await uow.price_list_items.get_by_user_and_product(
            operator.id, product.id, tenant_id
        )
        assert item is None

    async def test_operador_no_puede_borrar(
        self, uow: FakeUnitOfWork, tenant_id: TenantId, operator: User, product: Product
    ) -> None:
        with pytest.raises(AuthorizationError):
            await DeletePriceOverrideHandler(uow).handle(
                DeletePriceOverrideCommand(
                    tenant_id=tenant_id,
                    requester_user_id=operator.id,
                    requester_role="OPERATOR",
                    user_id=operator.id,
                    product_id=product.id,
                )
            )


# ── GetEffectivePriceListHandler ──────────────────────────────────────────────


class TestGetEffectivePriceListHandler:
    def _handler(self, uow: FakeUnitOfWork) -> GetEffectivePriceListHandler:
        return GetEffectivePriceListHandler(
            products_repo=uow.products,
            brands_repo=uow.brands,
            price_list_repo=uow.price_list_items,
            users_repo=uow.users,
        )

    async def test_sin_override_devuelve_precios_de_catalogo(
        self, uow: FakeUnitOfWork, tenant_id: TenantId, operator: User, product: Product
    ) -> None:
        results = await self._handler(uow).handle(
            GetEffectivePriceListQuery(
                tenant_id=tenant_id,
                requester_user_id=operator.id,
                requester_role="OPERATOR",
                user_id=operator.id,
            )
        )
        assert len(results) == 1
        item = results[0]
        assert item.effective_purchase_price == Decimal("500.00")
        assert item.effective_sale_price == Decimal("1000.00")
        assert item.has_purchase_override is False
        assert item.has_sale_override is False

    async def test_con_override_parcial_devuelve_mezcla(
        self,
        uow: FakeUnitOfWork,
        tenant_id: TenantId,
        admin: User,
        operator: User,
        product: Product,
    ) -> None:
        await SetPriceOverrideHandler(uow).handle(
            SetPriceOverrideCommand(
                tenant_id=tenant_id,
                requester_user_id=admin.id,
                requester_role="ADMIN",
                user_id=operator.id,
                product_id=product.id,
                purchase_price=Decimal("300.00"),
                # sale_price no se toca — debe quedar el default de catálogo
            )
        )
        results = await self._handler(uow).handle(
            GetEffectivePriceListQuery(
                tenant_id=tenant_id,
                requester_user_id=operator.id,
                requester_role="OPERATOR",
                user_id=operator.id,
            )
        )
        item = results[0]
        assert item.effective_purchase_price == Decimal("300.00")
        assert item.has_purchase_override is True
        assert item.effective_sale_price == Decimal("1000.00")
        assert item.has_sale_override is False

    async def test_admin_puede_consultar_lista_de_cualquier_operador(
        self, uow: FakeUnitOfWork, tenant_id: TenantId, admin: User, operator: User
    ) -> None:
        results = await self._handler(uow).handle(
            GetEffectivePriceListQuery(
                tenant_id=tenant_id,
                requester_user_id=admin.id,
                requester_role="ADMIN",
                user_id=operator.id,
            )
        )
        assert len(results) == 1

    async def test_operador_no_puede_ver_lista_de_otro(
        self,
        uow: FakeUnitOfWork,
        tenant_id: TenantId,
        operator: User,
        other_operator: User,
    ) -> None:
        with pytest.raises(AuthorizationError):
            await self._handler(uow).handle(
                GetEffectivePriceListQuery(
                    tenant_id=tenant_id,
                    requester_user_id=other_operator.id,
                    requester_role="OPERATOR",
                    user_id=operator.id,
                )
            )

    async def test_usuario_inexistente_lanza_not_found(
        self, uow: FakeUnitOfWork, tenant_id: TenantId
    ) -> None:
        random_id = uuid4()
        with pytest.raises(NotFoundError):
            await self._handler(uow).handle(
                GetEffectivePriceListQuery(
                    tenant_id=tenant_id,
                    requester_user_id=random_id,
                    requester_role="ADMIN",
                    user_id=random_id,
                )
            )
