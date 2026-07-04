"""Tests unitarios para la entidad User y sus value objects.

Cada regla de negocio del dominio tiene su test aquí.
NO hay DB, NO hay frameworks: puro Python.
"""

from uuid import uuid4

import pytest

from centy.domain.shared.exceptions import BusinessRuleViolationError, ValidationError
from centy.domain.shared.value_objects import Email, TenantId
from centy.domain.users.entities import Role, User
from centy.domain.users.value_objects import HashedPassword

# ── Helpers ──────────────────────────────────────────────────────────────────


def make_user(**overrides) -> User:  # type: ignore[no-untyped-def]
    defaults: dict = dict(
        tenant_id=TenantId(uuid4()),
        email=Email("operator@glazing.com"),
        hashed_password=HashedPassword("$2b$12$fakehash"),
        full_name="María García",
        role=Role.OPERATOR,
    )
    defaults.update(overrides)
    return User.create(**defaults)


# ── User.create ───────────────────────────────────────────────────────────────


class TestUserCreate:
    def test_creates_active_by_default(self) -> None:
        user = make_user()
        assert user.is_active is True

    def test_assigns_uuid_automatically(self) -> None:
        user = make_user()
        assert user.id is not None

    def test_strips_full_name_whitespace(self) -> None:
        user = make_user(full_name="  Juan Pérez  ")
        assert user.full_name == "Juan Pérez"

    def test_rejects_empty_full_name(self) -> None:
        with pytest.raises(BusinessRuleViolationError, match="nombre completo"):
            make_user(full_name="   ")

    def test_two_users_are_not_equal_even_with_same_email(self) -> None:
        email = Email("same@glazing.com")
        user_a = make_user(email=email)
        user_b = make_user(email=email)
        assert user_a != user_b


# ── User.deactivate / reactivate ─────────────────────────────────────────────


class TestUserLifecycle:
    def test_deactivate_active_user(self) -> None:
        user = make_user()
        user.deactivate()
        assert user.is_active is False

    def test_deactivate_already_inactive_raises(self) -> None:
        user = make_user()
        user.deactivate()
        with pytest.raises(BusinessRuleViolationError, match="ya está inactivo"):
            user.deactivate()

    def test_reactivate_inactive_user(self) -> None:
        user = make_user()
        user.deactivate()
        user.reactivate()
        assert user.is_active is True

    def test_reactivate_active_user_raises(self) -> None:
        user = make_user()
        with pytest.raises(BusinessRuleViolationError, match="ya está activo"):
            user.reactivate()


# ── Role ─────────────────────────────────────────────────────────────────────


class TestUserRole:
    def test_assign_role_changes_role(self) -> None:
        user = make_user(role=Role.OPERATOR)
        user.assign_role(Role.ADMIN)
        assert user.role == Role.ADMIN

    def test_is_admin_true_for_admin(self) -> None:
        user = make_user(role=Role.ADMIN)
        assert user.is_admin() is True
        assert user.is_operator() is False

    def test_is_operator_true_for_operator(self) -> None:
        user = make_user(role=Role.OPERATOR)
        assert user.is_operator() is True
        assert user.is_admin() is False


# ── Email value object ────────────────────────────────────────────────────────


class TestEmail:
    def test_valid_email_accepted(self) -> None:
        email = Email("user@example.com")
        assert email.value == "user@example.com"

    @pytest.mark.parametrize(
        "bad",
        [
            "not-an-email",
            "missing@domain",
            "@nodomain.com",
            "spaces in@email.com",
            "",
        ],
    )
    def test_invalid_emails_rejected(self, bad: str) -> None:
        with pytest.raises(ValidationError):
            Email(bad)

    def test_email_equality_is_value_based(self) -> None:
        assert Email("a@b.com") == Email("a@b.com")
        assert Email("a@b.com") != Email("c@b.com")


# ── HashedPassword value object ───────────────────────────────────────────────


class TestHashedPassword:
    def test_empty_value_raises(self) -> None:
        with pytest.raises(ValidationError):
            HashedPassword("")

    def test_repr_does_not_expose_value(self) -> None:
        hp = HashedPassword("$2b$12$secret")
        assert "secret" not in repr(hp)


# ── Campos de empresa ─────────────────────────────────────────────────────────


class TestUserCompanyFields:
    def test_company_fields_none_por_defecto(self) -> None:
        user = make_user()
        assert user.company_name is None
        assert user.company_logo_url is None

    def test_company_address_fields_none_por_defecto(self) -> None:
        user = make_user()
        assert user.company_street is None
        assert user.company_city is None
        assert user.company_province is None
        assert user.company_postal_code is None
        assert user.company_cuit is None

    def test_company_color_fields_none_por_defecto(self) -> None:
        user = make_user()
        assert user.company_color_primary is None
        assert user.company_color_secondary is None

    def test_default_commercial_conditions_none_por_defecto(self) -> None:
        user = make_user()
        assert user.default_commercial_conditions is None

    def test_company_color_fields_se_pueden_asignar_en_creacion(self) -> None:
        user = User(
            tenant_id=TenantId(uuid4()),
            email=Email("x@glazing.com"),
            hashed_password=HashedPassword("$2b$12$fakehash"),
            full_name="Test",
            role=Role.OPERATOR,
            company_color_primary="#0f6e50",
            company_color_secondary="#e8f5f0",
            default_commercial_conditions="Válido 30 días. Pago 50/50.",
        )
        assert user.company_color_primary == "#0f6e50"
        assert user.company_color_secondary == "#e8f5f0"
        assert user.default_commercial_conditions == "Válido 30 días. Pago 50/50."

    def test_company_fields_se_pueden_asignar_en_creacion(self) -> None:
        user = User(
            tenant_id=TenantId(uuid4()),
            email=Email("x@glazing.com"),
            hashed_password=HashedPassword("$2b$12$fakehash"),
            full_name="Test",
            role=Role.OPERATOR,
            company_name="Glazing Sur",
            company_logo_url="https://example.com/logo.png",
            company_street="Av. Corrientes 1234",
            company_city="Buenos Aires",
            company_province="CABA",
            company_postal_code="C1043",
            company_cuit="30-12345678-9",
        )
        assert user.company_name == "Glazing Sur"
        assert user.company_logo_url == "https://example.com/logo.png"
        assert user.company_street == "Av. Corrientes 1234"
        assert user.company_city == "Buenos Aires"
        assert user.company_province == "CABA"
        assert user.company_postal_code == "C1043"
        assert user.company_cuit == "30-12345678-9"


# ── User.update_profile ───────────────────────────────────────────────────────


class TestUserUpdateProfile:
    def test_actualiza_full_name(self) -> None:
        user = make_user(full_name="Nombre Viejo")
        user.update_profile(full_name="Nombre Nuevo")
        assert user.full_name == "Nombre Nuevo"

    def test_full_name_se_normaliza_con_strip(self) -> None:
        user = make_user()
        user.update_profile(full_name="  Con Espacios  ")
        assert user.full_name == "Con Espacios"

    def test_full_name_vacio_lanza_error(self) -> None:
        user = make_user()
        with pytest.raises(BusinessRuleViolationError, match="nombre completo"):
            user.update_profile(full_name="   ")

    def test_actualiza_company_name(self) -> None:
        user = make_user()
        user.update_profile(company_name="Glazing Norte")
        assert user.company_name == "Glazing Norte"

    def test_actualiza_company_logo_url(self) -> None:
        user = make_user()
        user.update_profile(company_logo_url="https://cdn.example.com/logo.png")
        assert user.company_logo_url == "https://cdn.example.com/logo.png"

    def test_company_name_string_vacio_se_convierte_en_none(self) -> None:
        user = make_user()
        user.update_profile(company_name="Algo")
        user.update_profile(company_name="")
        assert user.company_name is None

    def test_company_logo_url_string_vacio_se_convierte_en_none(self) -> None:
        user = make_user()
        user.update_profile(company_logo_url="https://cdn.example.com/logo.png")
        user.update_profile(company_logo_url="")
        assert user.company_logo_url is None

    def test_sin_argumentos_no_modifica_nada(self) -> None:
        user = make_user(full_name="Sin Cambios")
        user.update_profile()
        assert user.full_name == "Sin Cambios"
        assert user.company_name is None
        assert user.company_logo_url is None

    def test_actualiza_company_street(self) -> None:
        user = make_user()
        user.update_profile(company_street="Av. Rivadavia 500")
        assert user.company_street == "Av. Rivadavia 500"

    def test_actualiza_company_city(self) -> None:
        user = make_user()
        user.update_profile(company_city="Córdoba")
        assert user.company_city == "Córdoba"

    def test_actualiza_company_province(self) -> None:
        user = make_user()
        user.update_profile(company_province="Córdoba")
        assert user.company_province == "Córdoba"

    def test_actualiza_company_postal_code(self) -> None:
        user = make_user()
        user.update_profile(company_postal_code="5000")
        assert user.company_postal_code == "5000"

    def test_actualiza_company_cuit(self) -> None:
        user = make_user()
        user.update_profile(company_cuit="30-99887766-5")
        assert user.company_cuit == "30-99887766-5"

    def test_campos_direccion_vacios_se_convierten_en_none(self) -> None:
        user = make_user()
        user.update_profile(
            company_street="Calle 1",
            company_city="Ciudad",
            company_province="Provincia",
            company_postal_code="1234",
            company_cuit="30-11111111-1",
        )
        user.update_profile(
            company_street="",
            company_city="",
            company_province="",
            company_postal_code="",
            company_cuit="",
        )
        assert user.company_street is None
        assert user.company_city is None
        assert user.company_province is None
        assert user.company_postal_code is None
        assert user.company_cuit is None

    def test_actualiza_multiples_campos_a_la_vez(self) -> None:
        user = make_user(full_name="Viejo")
        user.update_profile(
            full_name="Nuevo",
            company_name="Mi Empresa",
            company_logo_url="https://example.com/logo.png",
            company_street="Av. Corrientes 1234",
            company_city="Buenos Aires",
            company_province="CABA",
            company_postal_code="C1043",
            company_cuit="30-12345678-9",
        )
        assert user.full_name == "Nuevo"
        assert user.company_name == "Mi Empresa"
        assert user.company_logo_url == "https://example.com/logo.png"
        assert user.company_street == "Av. Corrientes 1234"
        assert user.company_city == "Buenos Aires"
        assert user.company_province == "CABA"
        assert user.company_postal_code == "C1043"
        assert user.company_cuit == "30-12345678-9"

    def test_actualiza_color_primario(self) -> None:
        user = make_user()
        user.update_profile(company_color_primary="#1a2b3c")
        assert user.company_color_primary == "#1a2b3c"

    def test_actualiza_color_secundario(self) -> None:
        user = make_user()
        user.update_profile(company_color_secondary="#ffffff")
        assert user.company_color_secondary == "#ffffff"

    def test_actualiza_condiciones_comerciales(self) -> None:
        user = make_user()
        conditions = "Presupuesto válido 15 días.\nPago: 50% anticipo."
        user.update_profile(default_commercial_conditions=conditions)
        assert user.default_commercial_conditions == conditions

    def test_color_primario_vacio_se_convierte_en_none(self) -> None:
        user = make_user()
        user.update_profile(company_color_primary="#0f6e50")
        user.update_profile(company_color_primary="")
        assert user.company_color_primary is None

    def test_color_secundario_vacio_se_convierte_en_none(self) -> None:
        user = make_user()
        user.update_profile(company_color_secondary="#e8f5f0")
        user.update_profile(company_color_secondary="")
        assert user.company_color_secondary is None

    def test_condiciones_vacias_se_convierten_en_none(self) -> None:
        user = make_user()
        user.update_profile(default_commercial_conditions="Alguna condición.")
        user.update_profile(default_commercial_conditions="")
        assert user.default_commercial_conditions is None

    def test_colores_none_no_modifican_campo_existente(self) -> None:
        user = make_user()
        user.update_profile(company_color_primary="#0f6e50")
        user.update_profile(company_name="Empresa")  # no pasa color_primary
        assert user.company_color_primary == "#0f6e50"

    def test_actualiza_todos_los_campos_branding_juntos(self) -> None:
        user = make_user()
        user.update_profile(
            company_color_primary="#0f6e50",
            company_color_secondary="#e8f5f0",
            default_commercial_conditions="Validez: 30 días.\nForma de pago: contado.",
        )
        assert user.company_color_primary == "#0f6e50"
        assert user.company_color_secondary == "#e8f5f0"
        assert (
            user.default_commercial_conditions
            == "Validez: 30 días.\nForma de pago: contado."
        )
