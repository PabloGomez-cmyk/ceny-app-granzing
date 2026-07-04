"""Tests para los use cases de Customer (CRUD de clientes)."""

import pytest
from uuid import uuid4

from centy.application.customers.commands import (
    CreateCustomerCommand,
    DeactivateCustomerCommand,
    UpdateCustomerCommand,
)
from centy.application.customers.handlers import (
    CreateCustomerHandler,
    DeactivateCustomerHandler,
    GetCustomerHandler,
    ListCustomersHandler,
    UpdateCustomerHandler,
)
from centy.application.customers.queries import GetCustomerQuery, ListCustomersQuery
from centy.domain.shared.exceptions import AuthorizationError, BusinessRuleViolationError, NotFoundError
from centy.domain.shared.value_objects import TenantId
from tests.conftest import FakeCustomerRepository, FakeUnitOfWork


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def tenant_id() -> TenantId:
    return TenantId(uuid4())


@pytest.fixture
def owner_id() -> uuid4:  # type: ignore[return-value]
    return uuid4()


@pytest.fixture
def customer_repo() -> FakeCustomerRepository:
    return FakeCustomerRepository()


@pytest.fixture
def uow(customer_repo: FakeCustomerRepository) -> FakeUnitOfWork:
    uow = FakeUnitOfWork()
    uow.customers = customer_repo
    return uow


def make_create_command(tenant_id: TenantId, owner_id: uuid4, **overrides) -> CreateCustomerCommand:  # type: ignore[no-untyped-def]
    defaults: dict = dict(
        tenant_id=tenant_id,
        owner_user_id=owner_id,
        name="Cliente Test",
    )
    defaults.update(overrides)
    return CreateCustomerCommand(**defaults)


# ── CreateCustomer ────────────────────────────────────────────────────────────

class TestCreateCustomerHandler:
    async def test_crea_cliente_correctamente(
        self, uow: FakeUnitOfWork, tenant_id: TenantId, owner_id: uuid4
    ) -> None:
        handler = CreateCustomerHandler(uow)
        result = await handler.handle(make_create_command(tenant_id, owner_id, name="Ana López"))

        assert result.name == "Ana López"
        assert result.is_active is True
        assert result.email is None

    async def test_crea_con_todos_los_campos(
        self, uow: FakeUnitOfWork, tenant_id: TenantId, owner_id: uuid4
    ) -> None:
        handler = CreateCustomerHandler(uow)
        result = await handler.handle(
            make_create_command(
                tenant_id, owner_id,
                name="Juan Pérez",
                email="juan@empresa.com",
                phone="+54 351 555-1234",
                address="Av. Colón 1234",
                city="Córdoba",
                province="Córdoba",
                neighborhood="Nueva Córdoba",
                postal_code="5000",
                notes="Cliente preferencial",
            )
        )
        assert result.email == "juan@empresa.com"
        assert result.phone == "+54 351 555-1234"
        assert result.city == "Córdoba"
        assert result.province == "Córdoba"
        assert result.neighborhood == "Nueva Córdoba"
        assert result.postal_code == "5000"
        assert result.notes == "Cliente preferencial"

    async def test_hace_commit(
        self, uow: FakeUnitOfWork, tenant_id: TenantId, owner_id: uuid4
    ) -> None:
        handler = CreateCustomerHandler(uow)
        await handler.handle(make_create_command(tenant_id, owner_id))
        assert uow.committed is True

    async def test_persiste_en_repositorio(
        self, uow: FakeUnitOfWork, customer_repo: FakeCustomerRepository,
        tenant_id: TenantId, owner_id: uuid4
    ) -> None:
        handler = CreateCustomerHandler(uow)
        result = await handler.handle(make_create_command(tenant_id, owner_id, name="Persistido"))

        saved = await customer_repo.get_by_id(result.customer_id, tenant_id)
        assert saved is not None
        assert saved.name == "Persistido"

    async def test_nombre_vacio_lanza_error(
        self, uow: FakeUnitOfWork, tenant_id: TenantId, owner_id: uuid4
    ) -> None:
        handler = CreateCustomerHandler(uow)
        with pytest.raises(BusinessRuleViolationError):
            await handler.handle(make_create_command(tenant_id, owner_id, name="   "))


# ── GetCustomer ───────────────────────────────────────────────────────────────

class TestGetCustomerHandler:
    async def test_devuelve_cliente_del_owner(
        self, uow: FakeUnitOfWork, customer_repo: FakeCustomerRepository,
        tenant_id: TenantId, owner_id: uuid4
    ) -> None:
        created = await CreateCustomerHandler(uow).handle(
            make_create_command(tenant_id, owner_id, name="Mi Cliente")
        )

        handler = GetCustomerHandler(customer_repo)
        result = await handler.handle(
            GetCustomerQuery(
                customer_id=created.customer_id,
                tenant_id=tenant_id,
                requester_user_id=owner_id,
                requester_role="OPERATOR",
            )
        )
        assert result.name == "Mi Cliente"

    async def test_otro_user_no_puede_ver_cliente(
        self, uow: FakeUnitOfWork, customer_repo: FakeCustomerRepository,
        tenant_id: TenantId, owner_id: uuid4
    ) -> None:
        created = await CreateCustomerHandler(uow).handle(
            make_create_command(tenant_id, owner_id)
        )
        otro_user = uuid4()

        handler = GetCustomerHandler(customer_repo)
        with pytest.raises(AuthorizationError):
            await handler.handle(
                GetCustomerQuery(
                    customer_id=created.customer_id,
                    tenant_id=tenant_id,
                    requester_user_id=otro_user,
                    requester_role="OPERATOR",
                )
            )

    async def test_admin_tampoco_ve_clientes_ajenos(
        self, uow: FakeUnitOfWork, customer_repo: FakeCustomerRepository,
        tenant_id: TenantId, owner_id: uuid4
    ) -> None:
        created = await CreateCustomerHandler(uow).handle(
            make_create_command(tenant_id, owner_id)
        )
        admin_id = uuid4()

        handler = GetCustomerHandler(customer_repo)
        with pytest.raises(AuthorizationError):
            await handler.handle(
                GetCustomerQuery(
                    customer_id=created.customer_id,
                    tenant_id=tenant_id,
                    requester_user_id=admin_id,
                    requester_role="ADMIN",
                )
            )

    async def test_cliente_inexistente_lanza_not_found(
        self, customer_repo: FakeCustomerRepository, tenant_id: TenantId
    ) -> None:
        handler = GetCustomerHandler(customer_repo)
        with pytest.raises(NotFoundError):
            await handler.handle(
                GetCustomerQuery(
                    customer_id=uuid4(),
                    tenant_id=tenant_id,
                    requester_user_id=uuid4(),
                    requester_role="OPERATOR",
                )
            )


# ── ListCustomers ─────────────────────────────────────────────────────────────

class TestListCustomersHandler:
    async def test_devuelve_solo_clientes_del_owner(
        self, uow: FakeUnitOfWork, customer_repo: FakeCustomerRepository,
        tenant_id: TenantId
    ) -> None:
        owner_a = uuid4()
        owner_b = uuid4()
        create = CreateCustomerHandler(uow)

        await create.handle(make_create_command(tenant_id, owner_a, name="A1"))
        await create.handle(make_create_command(tenant_id, owner_a, name="A2"))
        await create.handle(make_create_command(tenant_id, owner_b, name="B1"))

        handler = ListCustomersHandler(customer_repo)
        results = await handler.handle(
            ListCustomersQuery(
                tenant_id=tenant_id,
                requester_user_id=owner_a,
                requester_role="OPERATOR",
            )
        )
        assert len(results) == 2
        names = {r.name for r in results}
        assert names == {"A1", "A2"}

    async def test_admin_ve_solo_sus_propios_clientes(
        self, uow: FakeUnitOfWork, customer_repo: FakeCustomerRepository,
        tenant_id: TenantId
    ) -> None:
        admin_id = uuid4()
        otro_user = uuid4()
        create = CreateCustomerHandler(uow)

        await create.handle(make_create_command(tenant_id, admin_id, name="Del Admin"))
        await create.handle(make_create_command(tenant_id, otro_user, name="Del Otro"))

        handler = ListCustomersHandler(customer_repo)
        results = await handler.handle(
            ListCustomersQuery(
                tenant_id=tenant_id,
                requester_user_id=admin_id,
                requester_role="ADMIN",
            )
        )
        assert len(results) == 1
        assert results[0].name == "Del Admin"

    async def test_devuelve_lista_vacia_si_no_tiene_clientes(
        self, customer_repo: FakeCustomerRepository, tenant_id: TenantId
    ) -> None:
        handler = ListCustomersHandler(customer_repo)
        results = await handler.handle(
            ListCustomersQuery(
                tenant_id=tenant_id,
                requester_user_id=uuid4(),
                requester_role="OPERATOR",
            )
        )
        assert results == []


# ── UpdateCustomer ────────────────────────────────────────────────────────────

class TestUpdateCustomerHandler:
    async def _create(
        self, uow: FakeUnitOfWork, tenant_id: TenantId, owner_id: uuid4, **kwargs
    ):  # type: ignore[return]
        uow.committed = False
        return await CreateCustomerHandler(uow).handle(
            make_create_command(tenant_id, owner_id, **kwargs)
        )

    async def test_actualiza_nombre(
        self, uow: FakeUnitOfWork, tenant_id: TenantId, owner_id: uuid4
    ) -> None:
        created = await self._create(uow, tenant_id, owner_id, name="Viejo")
        uow.committed = False

        result = await UpdateCustomerHandler(uow).handle(
            UpdateCustomerCommand(
                customer_id=created.customer_id,
                tenant_id=tenant_id,
                requester_user_id=owner_id,
                requester_role="OPERATOR",
                name="Nuevo",
            )
        )
        assert result.name == "Nuevo"
        assert uow.committed is True

    async def test_actualiza_campos_de_localizacion(
        self, uow: FakeUnitOfWork, tenant_id: TenantId, owner_id: uuid4
    ) -> None:
        created = await self._create(uow, tenant_id, owner_id)
        uow.committed = False

        result = await UpdateCustomerHandler(uow).handle(
            UpdateCustomerCommand(
                customer_id=created.customer_id,
                tenant_id=tenant_id,
                requester_user_id=owner_id,
                requester_role="OPERATOR",
                city="Mendoza",
                province="Mendoza",
                neighborhood="Godoy Cruz",
                postal_code="5500",
                address="San Martín 500",
            )
        )
        assert result.city == "Mendoza"
        assert result.province == "Mendoza"
        assert result.neighborhood == "Godoy Cruz"
        assert result.postal_code == "5500"
        assert result.address == "San Martín 500"

    async def test_no_owner_lanza_authorization_error(
        self, uow: FakeUnitOfWork, tenant_id: TenantId, owner_id: uuid4
    ) -> None:
        created = await self._create(uow, tenant_id, owner_id)
        otro = uuid4()

        with pytest.raises(AuthorizationError):
            await UpdateCustomerHandler(uow).handle(
                UpdateCustomerCommand(
                    customer_id=created.customer_id,
                    tenant_id=tenant_id,
                    requester_user_id=otro,
                    requester_role="OPERATOR",
                    name="Hack",
                )
            )

    async def test_cliente_inexistente_lanza_not_found(
        self, uow: FakeUnitOfWork, tenant_id: TenantId, owner_id: uuid4
    ) -> None:
        with pytest.raises(NotFoundError):
            await UpdateCustomerHandler(uow).handle(
                UpdateCustomerCommand(
                    customer_id=uuid4(),
                    tenant_id=tenant_id,
                    requester_user_id=owner_id,
                    requester_role="OPERATOR",
                    name="X",
                )
            )

    async def test_reactivar_cliente_inactivo(
        self, uow: FakeUnitOfWork, tenant_id: TenantId, owner_id: uuid4
    ) -> None:
        created = await self._create(uow, tenant_id, owner_id)
        await DeactivateCustomerHandler(uow).handle(
            DeactivateCustomerCommand(
                customer_id=created.customer_id,
                tenant_id=tenant_id,
                requester_user_id=owner_id,
                requester_role="OPERATOR",
            )
        )
        uow.committed = False

        result = await UpdateCustomerHandler(uow).handle(
            UpdateCustomerCommand(
                customer_id=created.customer_id,
                tenant_id=tenant_id,
                requester_user_id=owner_id,
                requester_role="OPERATOR",
                is_active=True,
            )
        )
        assert result.is_active is True


# ── DeactivateCustomer ────────────────────────────────────────────────────────

class TestDeactivateCustomerHandler:
    async def test_desactiva_cliente(
        self, uow: FakeUnitOfWork, customer_repo: FakeCustomerRepository,
        tenant_id: TenantId, owner_id: uuid4
    ) -> None:
        created = await CreateCustomerHandler(uow).handle(
            make_create_command(tenant_id, owner_id)
        )
        uow.committed = False

        await DeactivateCustomerHandler(uow).handle(
            DeactivateCustomerCommand(
                customer_id=created.customer_id,
                tenant_id=tenant_id,
                requester_user_id=owner_id,
                requester_role="OPERATOR",
            )
        )
        assert uow.committed is True
        saved = await customer_repo.get_by_id(created.customer_id, tenant_id)
        assert saved is not None
        assert saved.is_active is False

    async def test_no_owner_no_puede_desactivar(
        self, uow: FakeUnitOfWork, tenant_id: TenantId, owner_id: uuid4
    ) -> None:
        created = await CreateCustomerHandler(uow).handle(
            make_create_command(tenant_id, owner_id)
        )
        otro = uuid4()

        with pytest.raises(AuthorizationError):
            await DeactivateCustomerHandler(uow).handle(
                DeactivateCustomerCommand(
                    customer_id=created.customer_id,
                    tenant_id=tenant_id,
                    requester_user_id=otro,
                    requester_role="OPERATOR",
                )
            )

    async def test_cliente_inexistente_lanza_not_found(
        self, uow: FakeUnitOfWork, tenant_id: TenantId, owner_id: uuid4
    ) -> None:
        with pytest.raises(NotFoundError):
            await DeactivateCustomerHandler(uow).handle(
                DeactivateCustomerCommand(
                    customer_id=uuid4(),
                    tenant_id=tenant_id,
                    requester_user_id=owner_id,
                    requester_role="OPERATOR",
                )
            )

    async def test_desactivar_ya_inactivo_lanza_error(
        self, uow: FakeUnitOfWork, tenant_id: TenantId, owner_id: uuid4
    ) -> None:
        created = await CreateCustomerHandler(uow).handle(
            make_create_command(tenant_id, owner_id)
        )
        await DeactivateCustomerHandler(uow).handle(
            DeactivateCustomerCommand(
                customer_id=created.customer_id,
                tenant_id=tenant_id,
                requester_user_id=owner_id,
                requester_role="OPERATOR",
            )
        )
        with pytest.raises(BusinessRuleViolationError, match="ya está inactivo"):
            await DeactivateCustomerHandler(uow).handle(
                DeactivateCustomerCommand(
                    customer_id=created.customer_id,
                    tenant_id=tenant_id,
                    requester_user_id=owner_id,
                    requester_role="OPERATOR",
                )
            )
