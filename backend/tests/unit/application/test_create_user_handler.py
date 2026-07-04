"""Tests para el use case CreateUser."""

import pytest

from centy.application.users.commands import CreateUserCommand
from centy.application.users.handlers import CreateUserHandler
from centy.domain.shared.exceptions import ConflictError, ValidationError
from centy.domain.shared.value_objects import TenantId
from centy.domain.users.entities import Role
from tests.conftest import FakePasswordHasher, FakeUnitOfWork, FakeUserRepository


@pytest.fixture
def handler(
    fake_uow: FakeUnitOfWork, fake_hasher: FakePasswordHasher
) -> CreateUserHandler:
    return CreateUserHandler(uow=fake_uow, hasher=fake_hasher)


def make_command(tenant_id: TenantId, **overrides) -> CreateUserCommand:  # type: ignore[no-untyped-def]
    defaults = dict(
        tenant_id=tenant_id,
        email="nuevo@glazing.com",
        password="segura123",
        full_name="Nuevo Operador",
        role=Role.OPERATOR,
    )
    defaults.update(overrides)
    return CreateUserCommand(**defaults)


class TestCreateUser:
    async def test_crea_usuario_correctamente(
        self, handler: CreateUserHandler, fake_uow: FakeUnitOfWork, tenant_id: TenantId
    ) -> None:
        result = await handler.handle(make_command(tenant_id))

        assert result.email == "nuevo@glazing.com"
        assert result.full_name == "Nuevo Operador"
        assert result.role == Role.OPERATOR.value
        assert result.is_active is True

    async def test_hashea_la_contraseña(
        self, handler: CreateUserHandler, fake_uow: FakeUnitOfWork, tenant_id: TenantId
    ) -> None:
        await handler.handle(make_command(tenant_id, password="mipass"))

        saved = next(iter(fake_uow.users._store.values()))
        assert saved.hashed_password.value == "fake:mipass"

    async def test_hace_commit(
        self, handler: CreateUserHandler, fake_uow: FakeUnitOfWork, tenant_id: TenantId
    ) -> None:
        await handler.handle(make_command(tenant_id))
        assert fake_uow.committed is True

    async def test_email_duplicado_lanza_conflict(
        self, handler: CreateUserHandler, fake_uow: FakeUnitOfWork, tenant_id: TenantId
    ) -> None:
        cmd = make_command(tenant_id, email="dup@glazing.com")
        await handler.handle(cmd)

        with pytest.raises(ConflictError, match="ya está registrado"):
            await handler.handle(cmd)

    async def test_email_duplicado_distinto_tenant_no_conflictua(
        self,
        fake_hasher: FakePasswordHasher,
        tenant_id: TenantId,
    ) -> None:
        from uuid import uuid4

        from centy.domain.shared.value_objects import TenantId as TId

        repo = FakeUserRepository()
        uow1 = FakeUnitOfWork(repo=repo)
        uow2 = FakeUnitOfWork(repo=repo)

        h1 = CreateUserHandler(uow=uow1, hasher=fake_hasher)
        h2 = CreateUserHandler(uow=uow2, hasher=fake_hasher)

        other_tenant = TId(uuid4())
        await h1.handle(make_command(tenant_id, email="shared@glazing.com"))
        # mismo email, distinto tenant → no lanza error
        await h2.handle(make_command(other_tenant, email="shared@glazing.com"))

    async def test_email_invalido_lanza_validation_error(
        self, handler: CreateUserHandler, tenant_id: TenantId
    ) -> None:
        with pytest.raises(ValidationError):
            await handler.handle(make_command(tenant_id, email="no-es-email"))

    async def test_nombre_vacio_lanza_error(
        self, handler: CreateUserHandler, tenant_id: TenantId
    ) -> None:
        from centy.domain.shared.exceptions import BusinessRuleViolationError

        with pytest.raises(BusinessRuleViolationError):
            await handler.handle(make_command(tenant_id, full_name="   "))
