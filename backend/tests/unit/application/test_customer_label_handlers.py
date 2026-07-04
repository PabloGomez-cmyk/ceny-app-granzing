"""Tests para los use cases de CustomerLabel (CRUD de etiquetas)."""

from uuid import uuid4

import pytest

from centy.application.customers.commands import (
    CreateCustomerLabelCommand,
    DeleteCustomerLabelCommand,
    UpdateCustomerLabelCommand,
)
from centy.application.customers.handlers import (
    CreateCustomerLabelHandler,
    DeleteCustomerLabelHandler,
    ListCustomerLabelsHandler,
    UpdateCustomerLabelHandler,
)
from centy.application.customers.queries import ListCustomerLabelsQuery
from centy.domain.shared.exceptions import NotFoundError
from centy.domain.shared.value_objects import TenantId
from tests.conftest import FakeCustomerLabelRepository, FakeUnitOfWork

# ── Fixtures ──────────────────────────────────────────────────────────────────


@pytest.fixture
def tenant_id() -> TenantId:
    return TenantId(uuid4())


@pytest.fixture
def owner_id() -> uuid4:  # type: ignore[return-value]
    return uuid4()


@pytest.fixture
def label_repo() -> FakeCustomerLabelRepository:
    return FakeCustomerLabelRepository()


@pytest.fixture
def uow(label_repo: FakeCustomerLabelRepository) -> FakeUnitOfWork:
    uow = FakeUnitOfWork()
    uow.customer_labels = label_repo
    return uow


# ── CreateCustomerLabel ───────────────────────────────────────────────────────


class TestCreateCustomerLabelHandler:
    async def test_crea_etiqueta_correctamente(
        self, uow: FakeUnitOfWork, tenant_id: TenantId, owner_id: uuid4
    ) -> None:
        handler = CreateCustomerLabelHandler(uow)
        result = await handler.handle(
            CreateCustomerLabelCommand(
                tenant_id=tenant_id,
                owner_user_id=owner_id,
                name="Residencial",
                color="#10b981",
            )
        )
        assert result.name == "Residencial"
        assert result.color == "#10b981"
        assert result.is_active is True

    async def test_hace_commit(
        self, uow: FakeUnitOfWork, tenant_id: TenantId, owner_id: uuid4
    ) -> None:
        handler = CreateCustomerLabelHandler(uow)
        await handler.handle(
            CreateCustomerLabelCommand(
                tenant_id=tenant_id,
                owner_user_id=owner_id,
                name="VIP",
                color="#f59e0b",
            )
        )
        assert uow.committed is True

    async def test_persiste_en_repositorio(
        self,
        uow: FakeUnitOfWork,
        label_repo: FakeCustomerLabelRepository,
        tenant_id: TenantId,
        owner_id: uuid4,
    ) -> None:
        handler = CreateCustomerLabelHandler(uow)
        result = await handler.handle(
            CreateCustomerLabelCommand(
                tenant_id=tenant_id,
                owner_user_id=owner_id,
                name="Comercial",
                color="#3b82f6",
            )
        )
        saved = await label_repo.get_by_id(result.label_id, tenant_id)
        assert saved is not None
        assert saved.name == "Comercial"


# ── UpdateCustomerLabel ───────────────────────────────────────────────────────


class TestUpdateCustomerLabelHandler:
    async def _create_label(
        self,
        uow: FakeUnitOfWork,
        tenant_id: TenantId,
        owner_id: uuid4,
        name: str = "Original",
        color: str = "#10b981",
    ):  # type: ignore[return]
        handler = CreateCustomerLabelHandler(uow)
        uow.committed = False
        return await handler.handle(
            CreateCustomerLabelCommand(
                tenant_id=tenant_id,
                owner_user_id=owner_id,
                name=name,
                color=color,
            )
        )

    async def test_actualiza_nombre(
        self, uow: FakeUnitOfWork, tenant_id: TenantId, owner_id: uuid4
    ) -> None:
        created = await self._create_label(uow, tenant_id, owner_id)
        uow.committed = False

        handler = UpdateCustomerLabelHandler(uow)
        result = await handler.handle(
            UpdateCustomerLabelCommand(
                label_id=created.label_id,
                tenant_id=tenant_id,
                owner_user_id=owner_id,
                name="Modificado",
            )
        )
        assert result.name == "Modificado"
        assert uow.committed is True

    async def test_actualiza_color(
        self, uow: FakeUnitOfWork, tenant_id: TenantId, owner_id: uuid4
    ) -> None:
        created = await self._create_label(uow, tenant_id, owner_id)
        uow.committed = False

        handler = UpdateCustomerLabelHandler(uow)
        result = await handler.handle(
            UpdateCustomerLabelCommand(
                label_id=created.label_id,
                tenant_id=tenant_id,
                owner_user_id=owner_id,
                color="#ef4444",
            )
        )
        assert result.color == "#ef4444"

    async def test_etiqueta_inexistente_lanza_not_found(
        self, uow: FakeUnitOfWork, tenant_id: TenantId, owner_id: uuid4
    ) -> None:
        handler = UpdateCustomerLabelHandler(uow)
        with pytest.raises(NotFoundError):
            await handler.handle(
                UpdateCustomerLabelCommand(
                    label_id=uuid4(),
                    tenant_id=tenant_id,
                    owner_user_id=owner_id,
                    name="X",
                )
            )

    async def test_otro_tenant_no_puede_actualizar(
        self, uow: FakeUnitOfWork, tenant_id: TenantId, owner_id: uuid4
    ) -> None:
        created = await self._create_label(uow, tenant_id, owner_id)
        otro_tenant = TenantId(uuid4())

        handler = UpdateCustomerLabelHandler(uow)
        with pytest.raises(NotFoundError):
            await handler.handle(
                UpdateCustomerLabelCommand(
                    label_id=created.label_id,
                    tenant_id=otro_tenant,
                    owner_user_id=owner_id,
                    name="Hack",
                )
            )


# ── DeleteCustomerLabel ───────────────────────────────────────────────────────


class TestDeleteCustomerLabelHandler:
    async def test_elimina_etiqueta(
        self,
        uow: FakeUnitOfWork,
        label_repo: FakeCustomerLabelRepository,
        tenant_id: TenantId,
        owner_id: uuid4,
    ) -> None:
        created = await CreateCustomerLabelHandler(uow).handle(
            CreateCustomerLabelCommand(
                tenant_id=tenant_id,
                owner_user_id=owner_id,
                name="Temporal",
                color="#10b981",
            )
        )
        uow.committed = False

        await DeleteCustomerLabelHandler(uow).handle(
            DeleteCustomerLabelCommand(
                label_id=created.label_id,
                tenant_id=tenant_id,
                owner_user_id=owner_id,
            )
        )
        assert uow.committed is True
        assert await label_repo.get_by_id(created.label_id, tenant_id) is None

    async def test_eliminar_inexistente_lanza_not_found(
        self, uow: FakeUnitOfWork, tenant_id: TenantId, owner_id: uuid4
    ) -> None:
        with pytest.raises(NotFoundError):
            await DeleteCustomerLabelHandler(uow).handle(
                DeleteCustomerLabelCommand(
                    label_id=uuid4(),
                    tenant_id=tenant_id,
                    owner_user_id=owner_id,
                )
            )


# ── ListCustomerLabels ────────────────────────────────────────────────────────


class TestListCustomerLabelsHandler:
    async def test_devuelve_solo_etiquetas_del_owner(
        self, uow: FakeUnitOfWork, tenant_id: TenantId
    ) -> None:
        owner_a = uuid4()
        owner_b = uuid4()
        create = CreateCustomerLabelHandler(uow)

        await create.handle(
            CreateCustomerLabelCommand(
                tenant_id=tenant_id, owner_user_id=owner_a, name="A1", color="#10b981"
            )
        )
        await create.handle(
            CreateCustomerLabelCommand(
                tenant_id=tenant_id, owner_user_id=owner_a, name="A2", color="#3b82f6"
            )
        )
        await create.handle(
            CreateCustomerLabelCommand(
                tenant_id=tenant_id, owner_user_id=owner_b, name="B1", color="#ef4444"
            )
        )

        handler = ListCustomerLabelsHandler(uow.customer_labels)
        results = await handler.handle(
            ListCustomerLabelsQuery(tenant_id=tenant_id, owner_user_id=owner_a)
        )

        assert len(results) == 2
        names = {r.name for r in results}
        assert names == {"A1", "A2"}

    async def test_devuelve_lista_vacia_si_no_hay_etiquetas(
        self, uow: FakeUnitOfWork, tenant_id: TenantId
    ) -> None:
        handler = ListCustomerLabelsHandler(uow.customer_labels)
        results = await handler.handle(
            ListCustomerLabelsQuery(tenant_id=tenant_id, owner_user_id=uuid4())
        )
        assert results == []
