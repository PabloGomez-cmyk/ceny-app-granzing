"""Tests para el use case UpdateUser.

Cubre: actualización de email, nombre, rol, contraseña, estado y perfil de empresa.
NO hay DB, NO hay frameworks: puro Python con fakes en memoria.
"""

import asyncio
from uuid import uuid4

import pytest

from centy.application.users.commands import UpdateUserCommand
from centy.application.users.handlers import UpdateUserHandler
from centy.domain.shared.exceptions import ConflictError, NotFoundError
from centy.domain.shared.value_objects import Email, TenantId
from centy.domain.users.entities import Role, User
from centy.domain.users.value_objects import HashedPassword
from tests.conftest import FakePasswordHasher, FakeUnitOfWork, FakeUserRepository

# ── Helpers ───────────────────────────────────────────────────────────────────


def make_handler(uow: FakeUnitOfWork) -> UpdateUserHandler:
    return UpdateUserHandler(uow=uow, hasher=FakePasswordHasher())


def make_existing_user(tenant_id: TenantId, **overrides) -> User:  # type: ignore[no-untyped-def]
    defaults = dict(
        tenant_id=tenant_id,
        email=Email("original@glazing.com"),
        hashed_password=HashedPassword("fake:original"),
        full_name="Usuario Original",
        role=Role.OPERATOR,
    )
    defaults.update(overrides)
    return User.create(**defaults)


# ── Fixtures ──────────────────────────────────────────────────────────────────


@pytest.fixture
def existing_user(tenant_id: TenantId) -> User:
    return make_existing_user(tenant_id)


@pytest.fixture
def uow_with_user(fake_repo: FakeUserRepository, existing_user: User) -> FakeUnitOfWork:
    asyncio.get_event_loop().run_until_complete(fake_repo.save(existing_user))
    return FakeUnitOfWork(repo=fake_repo)


# ── Tests ─────────────────────────────────────────────────────────────────────


class TestUpdateUserHandler:
    # ── Nombre ───────────────────────────────────────────────────────────────

    async def test_actualiza_full_name(
        self, uow_with_user: FakeUnitOfWork, existing_user: User, tenant_id: TenantId
    ) -> None:
        result = await make_handler(uow_with_user).handle(
            UpdateUserCommand(
                user_id=existing_user.id, tenant_id=tenant_id, full_name="Nuevo Nombre"
            )
        )
        assert result.full_name == "Nuevo Nombre"

    async def test_full_name_none_no_modifica_nombre(
        self, uow_with_user: FakeUnitOfWork, existing_user: User, tenant_id: TenantId
    ) -> None:
        result = await make_handler(uow_with_user).handle(
            UpdateUserCommand(user_id=existing_user.id, tenant_id=tenant_id)
        )
        assert result.full_name == "Usuario Original"

    # ── Email ─────────────────────────────────────────────────────────────────

    async def test_actualiza_email_libre(
        self, uow_with_user: FakeUnitOfWork, existing_user: User, tenant_id: TenantId
    ) -> None:
        result = await make_handler(uow_with_user).handle(
            UpdateUserCommand(
                user_id=existing_user.id, tenant_id=tenant_id, email="nuevo@glazing.com"
            )
        )
        assert result.email == "nuevo@glazing.com"

    async def test_mismo_email_no_genera_conflict(
        self, uow_with_user: FakeUnitOfWork, existing_user: User, tenant_id: TenantId
    ) -> None:
        result = await make_handler(uow_with_user).handle(
            UpdateUserCommand(
                user_id=existing_user.id,
                tenant_id=tenant_id,
                email="original@glazing.com",
            )
        )
        assert result.email == "original@glazing.com"

    async def test_email_duplicado_lanza_conflict(
        self, fake_repo: FakeUserRepository, tenant_id: TenantId
    ) -> None:
        other = make_existing_user(
            tenant_id, email=Email("ocupado@glazing.com"), full_name="Otro"
        )
        target = make_existing_user(
            tenant_id, email=Email("target@glazing.com"), full_name="Target"
        )
        await fake_repo.save(other)
        await fake_repo.save(target)
        uow = FakeUnitOfWork(repo=fake_repo)

        with pytest.raises(ConflictError):
            await make_handler(uow).handle(
                UpdateUserCommand(
                    user_id=target.id, tenant_id=tenant_id, email="ocupado@glazing.com"
                )
            )

    # ── Rol ───────────────────────────────────────────────────────────────────

    async def test_actualiza_rol_a_admin(
        self, uow_with_user: FakeUnitOfWork, existing_user: User, tenant_id: TenantId
    ) -> None:
        result = await make_handler(uow_with_user).handle(
            UpdateUserCommand(
                user_id=existing_user.id, tenant_id=tenant_id, role=Role.ADMIN
            )
        )
        assert result.role == Role.ADMIN.value

    # ── Estado ────────────────────────────────────────────────────────────────

    async def test_desactiva_usuario_activo(
        self, uow_with_user: FakeUnitOfWork, existing_user: User, tenant_id: TenantId
    ) -> None:
        result = await make_handler(uow_with_user).handle(
            UpdateUserCommand(
                user_id=existing_user.id, tenant_id=tenant_id, is_active=False
            )
        )
        assert result.is_active is False

    async def test_reactiva_usuario_inactivo(
        self, fake_repo: FakeUserRepository, tenant_id: TenantId
    ) -> None:
        user = make_existing_user(
            tenant_id, email=Email("inactivo@glazing.com"), full_name="Inactivo"
        )
        user.deactivate()
        await fake_repo.save(user)
        uow = FakeUnitOfWork(repo=fake_repo)

        result = await make_handler(uow).handle(
            UpdateUserCommand(user_id=user.id, tenant_id=tenant_id, is_active=True)
        )
        assert result.is_active is True

    # ── Contraseña ────────────────────────────────────────────────────────────

    async def test_cambia_password_y_hashea(
        self, uow_with_user: FakeUnitOfWork, existing_user: User, tenant_id: TenantId
    ) -> None:
        await make_handler(uow_with_user).handle(
            UpdateUserCommand(
                user_id=existing_user.id, tenant_id=tenant_id, password="nuevapass"
            )
        )
        saved = uow_with_user.users._store[existing_user.id]
        assert saved.hashed_password.value == "fake:nuevapass"

    async def test_password_none_no_cambia_hash(
        self, uow_with_user: FakeUnitOfWork, existing_user: User, tenant_id: TenantId
    ) -> None:
        await make_handler(uow_with_user).handle(
            UpdateUserCommand(user_id=existing_user.id, tenant_id=tenant_id)
        )
        saved = uow_with_user.users._store[existing_user.id]
        assert saved.hashed_password.value == "fake:original"

    # ── Empresa ───────────────────────────────────────────────────────────────

    async def test_actualiza_company_name(
        self, uow_with_user: FakeUnitOfWork, existing_user: User, tenant_id: TenantId
    ) -> None:
        result = await make_handler(uow_with_user).handle(
            UpdateUserCommand(
                user_id=existing_user.id,
                tenant_id=tenant_id,
                company_name="Glazing Sur",
            )
        )
        assert result.company_name == "Glazing Sur"

    async def test_actualiza_company_logo_url(
        self, uow_with_user: FakeUnitOfWork, existing_user: User, tenant_id: TenantId
    ) -> None:
        result = await make_handler(uow_with_user).handle(
            UpdateUserCommand(
                user_id=existing_user.id,
                tenant_id=tenant_id,
                company_logo_url="https://cdn.example.com/logo.png",
            )
        )
        assert result.company_logo_url == "https://cdn.example.com/logo.png"

    async def test_company_name_vacio_se_guarda_como_none(
        self, uow_with_user: FakeUnitOfWork, existing_user: User, tenant_id: TenantId
    ) -> None:
        result = await make_handler(uow_with_user).handle(
            UpdateUserCommand(
                user_id=existing_user.id, tenant_id=tenant_id, company_name=""
            )
        )
        assert result.company_name is None

    async def test_actualiza_multiples_campos_empresa(
        self, uow_with_user: FakeUnitOfWork, existing_user: User, tenant_id: TenantId
    ) -> None:
        result = await make_handler(uow_with_user).handle(
            UpdateUserCommand(
                user_id=existing_user.id,
                tenant_id=tenant_id,
                company_name="Mi Empresa",
                company_logo_url="https://example.com/logo.png",
            )
        )
        assert result.company_name == "Mi Empresa"
        assert result.company_logo_url == "https://example.com/logo.png"

    async def test_actualiza_company_street(
        self, uow_with_user: FakeUnitOfWork, existing_user: User, tenant_id: TenantId
    ) -> None:
        result = await make_handler(uow_with_user).handle(
            UpdateUserCommand(
                user_id=existing_user.id,
                tenant_id=tenant_id,
                company_street="Av. Rivadavia 500",
            )
        )
        assert result.company_street == "Av. Rivadavia 500"

    async def test_actualiza_company_city(
        self, uow_with_user: FakeUnitOfWork, existing_user: User, tenant_id: TenantId
    ) -> None:
        result = await make_handler(uow_with_user).handle(
            UpdateUserCommand(
                user_id=existing_user.id, tenant_id=tenant_id, company_city="Rosario"
            )
        )
        assert result.company_city == "Rosario"

    async def test_actualiza_company_province(
        self, uow_with_user: FakeUnitOfWork, existing_user: User, tenant_id: TenantId
    ) -> None:
        result = await make_handler(uow_with_user).handle(
            UpdateUserCommand(
                user_id=existing_user.id,
                tenant_id=tenant_id,
                company_province="Santa Fe",
            )
        )
        assert result.company_province == "Santa Fe"

    async def test_actualiza_company_postal_code(
        self, uow_with_user: FakeUnitOfWork, existing_user: User, tenant_id: TenantId
    ) -> None:
        result = await make_handler(uow_with_user).handle(
            UpdateUserCommand(
                user_id=existing_user.id,
                tenant_id=tenant_id,
                company_postal_code="2000",
            )
        )
        assert result.company_postal_code == "2000"

    async def test_actualiza_company_cuit(
        self, uow_with_user: FakeUnitOfWork, existing_user: User, tenant_id: TenantId
    ) -> None:
        result = await make_handler(uow_with_user).handle(
            UpdateUserCommand(
                user_id=existing_user.id,
                tenant_id=tenant_id,
                company_cuit="30-99887766-5",
            )
        )
        assert result.company_cuit == "30-99887766-5"

    async def test_actualiza_todos_los_campos_direccion_juntos(
        self, uow_with_user: FakeUnitOfWork, existing_user: User, tenant_id: TenantId
    ) -> None:
        result = await make_handler(uow_with_user).handle(
            UpdateUserCommand(
                user_id=existing_user.id,
                tenant_id=tenant_id,
                company_name="Glazing Sur",
                company_street="Av. Corrientes 1234",
                company_city="Buenos Aires",
                company_province="CABA",
                company_postal_code="C1043",
                company_cuit="30-12345678-9",
            )
        )
        assert result.company_name == "Glazing Sur"
        assert result.company_street == "Av. Corrientes 1234"
        assert result.company_city == "Buenos Aires"
        assert result.company_province == "CABA"
        assert result.company_postal_code == "C1043"
        assert result.company_cuit == "30-12345678-9"

    async def test_campo_vacio_se_guarda_como_none(
        self, uow_with_user: FakeUnitOfWork, existing_user: User, tenant_id: TenantId
    ) -> None:
        # Primero asignamos un valor
        await make_handler(uow_with_user).handle(
            UpdateUserCommand(
                user_id=existing_user.id, tenant_id=tenant_id, company_street="Calle 1"
            )
        )
        # Luego lo limpiamos con string vacío
        result = await make_handler(uow_with_user).handle(
            UpdateUserCommand(
                user_id=existing_user.id, tenant_id=tenant_id, company_street=""
            )
        )
        assert result.company_street is None

    async def test_result_incluye_todos_los_campos_direccion(
        self, uow_with_user: FakeUnitOfWork, existing_user: User, tenant_id: TenantId
    ) -> None:
        result = await make_handler(uow_with_user).handle(
            UpdateUserCommand(user_id=existing_user.id, tenant_id=tenant_id)
        )
        assert hasattr(result, "company_street")
        assert hasattr(result, "company_city")
        assert hasattr(result, "company_province")
        assert hasattr(result, "company_postal_code")
        assert hasattr(result, "company_cuit")

    # ── Branding (colores + condiciones) ──────────────────────────────────────

    async def test_actualiza_color_primario(
        self, uow_with_user: FakeUnitOfWork, existing_user: User, tenant_id: TenantId
    ) -> None:
        result = await make_handler(uow_with_user).handle(
            UpdateUserCommand(
                user_id=existing_user.id,
                tenant_id=tenant_id,
                company_color_primary="#0f6e50",
            )
        )
        assert result.company_color_primary == "#0f6e50"

    async def test_actualiza_color_secundario(
        self, uow_with_user: FakeUnitOfWork, existing_user: User, tenant_id: TenantId
    ) -> None:
        result = await make_handler(uow_with_user).handle(
            UpdateUserCommand(
                user_id=existing_user.id,
                tenant_id=tenant_id,
                company_color_secondary="#e8f5f0",
            )
        )
        assert result.company_color_secondary == "#e8f5f0"

    async def test_actualiza_condiciones_comerciales(
        self, uow_with_user: FakeUnitOfWork, existing_user: User, tenant_id: TenantId
    ) -> None:
        conditions = "Válido 15 días.\nForma de pago: 50% anticipo, 50% entrega."
        result = await make_handler(uow_with_user).handle(
            UpdateUserCommand(
                user_id=existing_user.id,
                tenant_id=tenant_id,
                default_commercial_conditions=conditions,
            )
        )
        assert result.default_commercial_conditions == conditions

    async def test_color_primario_vacio_se_guarda_como_none(
        self, uow_with_user: FakeUnitOfWork, existing_user: User, tenant_id: TenantId
    ) -> None:
        result = await make_handler(uow_with_user).handle(
            UpdateUserCommand(
                user_id=existing_user.id,
                tenant_id=tenant_id,
                company_color_primary="",
            )
        )
        assert result.company_color_primary is None

    async def test_condiciones_vacias_se_guardan_como_none(
        self, uow_with_user: FakeUnitOfWork, existing_user: User, tenant_id: TenantId
    ) -> None:
        result = await make_handler(uow_with_user).handle(
            UpdateUserCommand(
                user_id=existing_user.id,
                tenant_id=tenant_id,
                default_commercial_conditions="",
            )
        )
        assert result.default_commercial_conditions is None

    async def test_actualiza_todos_los_campos_branding_juntos(
        self, uow_with_user: FakeUnitOfWork, existing_user: User, tenant_id: TenantId
    ) -> None:
        result = await make_handler(uow_with_user).handle(
            UpdateUserCommand(
                user_id=existing_user.id,
                tenant_id=tenant_id,
                company_color_primary="#1a1a2e",
                company_color_secondary="#f0f4f8",
                default_commercial_conditions="Garantía según fabricante.",
            )
        )
        assert result.company_color_primary == "#1a1a2e"
        assert result.company_color_secondary == "#f0f4f8"
        assert result.default_commercial_conditions == "Garantía según fabricante."

    async def test_result_incluye_campos_branding_none_por_defecto(
        self, uow_with_user: FakeUnitOfWork, existing_user: User, tenant_id: TenantId
    ) -> None:
        result = await make_handler(uow_with_user).handle(
            UpdateUserCommand(user_id=existing_user.id, tenant_id=tenant_id)
        )
        assert hasattr(result, "company_color_primary")
        assert hasattr(result, "company_color_secondary")
        assert hasattr(result, "default_commercial_conditions")
        assert result.company_color_primary is None
        assert result.company_color_secondary is None
        assert result.default_commercial_conditions is None

    async def test_colores_none_no_sobreescriben_valores_existentes(
        self, uow_with_user: FakeUnitOfWork, existing_user: User, tenant_id: TenantId
    ) -> None:
        # Primero establecemos colores
        await make_handler(uow_with_user).handle(
            UpdateUserCommand(
                user_id=existing_user.id,
                tenant_id=tenant_id,
                company_color_primary="#0f6e50",
            )
        )
        # Luego actualizamos otro campo sin tocar los colores
        result = await make_handler(uow_with_user).handle(
            UpdateUserCommand(
                user_id=existing_user.id,
                tenant_id=tenant_id,
                company_name="Empresa Nueva",
            )
        )
        assert result.company_color_primary == "#0f6e50"
        assert result.company_name == "Empresa Nueva"

    # ── Resultado y transacción ───────────────────────────────────────────────

    async def test_result_incluye_todos_los_campos(
        self, uow_with_user: FakeUnitOfWork, existing_user: User, tenant_id: TenantId
    ) -> None:
        result = await make_handler(uow_with_user).handle(
            UpdateUserCommand(user_id=existing_user.id, tenant_id=tenant_id)
        )
        assert result.user_id == existing_user.id
        assert result.email == "original@glazing.com"
        assert result.is_active is True

    async def test_commit_ejecutado(
        self, uow_with_user: FakeUnitOfWork, existing_user: User, tenant_id: TenantId
    ) -> None:
        await make_handler(uow_with_user).handle(
            UpdateUserCommand(
                user_id=existing_user.id, tenant_id=tenant_id, full_name="Cualquiera"
            )
        )
        assert uow_with_user.committed is True

    # ── Error handling ────────────────────────────────────────────────────────

    async def test_usuario_no_encontrado_lanza_not_found(
        self, fake_uow: FakeUnitOfWork, tenant_id: TenantId
    ) -> None:
        with pytest.raises(NotFoundError):
            await make_handler(fake_uow).handle(
                UpdateUserCommand(user_id=uuid4(), tenant_id=tenant_id)
            )
