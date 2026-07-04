"""Tests unitarios para las entidades Customer y CustomerLabel.

NO hay DB ni frameworks: puro dominio Python.
"""

from uuid import uuid4

import pytest

from centy.domain.customers.entities import Customer, CustomerLabel
from centy.domain.shared.exceptions import BusinessRuleViolationError, ValidationError
from centy.domain.shared.value_objects import TenantId

# ── Helpers ───────────────────────────────────────────────────────────────────


def make_label(**overrides) -> CustomerLabel:  # type: ignore[no-untyped-def]
    defaults: dict = dict(
        tenant_id=TenantId(uuid4()),
        owner_user_id=uuid4(),
        name="Residencial",
        color="#10b981",
    )
    defaults.update(overrides)
    return CustomerLabel.create(**defaults)


def make_customer(**overrides) -> Customer:  # type: ignore[no-untyped-def]
    defaults: dict = dict(
        tenant_id=TenantId(uuid4()),
        owner_user_id=uuid4(),
        name="María González",
    )
    defaults.update(overrides)
    return Customer.create(**defaults)


# ── CustomerLabel.create ──────────────────────────────────────────────────────


class TestCustomerLabelCreate:
    def test_crea_con_datos_validos(self) -> None:
        lb = make_label()
        assert lb.name == "Residencial"
        assert lb.color == "#10b981"
        assert lb.is_active is True

    def test_asigna_id_automaticamente(self) -> None:
        lb = make_label()
        assert lb.id is not None

    def test_stripea_nombre(self) -> None:
        lb = make_label(name="  Comercial  ")
        assert lb.name == "Comercial"

    def test_rechaza_nombre_vacio(self) -> None:
        with pytest.raises(BusinessRuleViolationError, match="vacío"):
            make_label(name="   ")

    def test_rechaza_nombre_mayor_50_chars(self) -> None:
        with pytest.raises(BusinessRuleViolationError, match="50"):
            make_label(name="A" * 51)

    @pytest.mark.parametrize("color", ["#10b981", "#FFFFFF", "#000000", "#aabbcc"])
    def test_acepta_colores_hex_validos(self, color: str) -> None:
        lb = make_label(color=color)
        assert lb.color == color

    @pytest.mark.parametrize("bad_color", ["red", "#xyz", "#12345", "10b981", ""])
    def test_rechaza_colores_invalidos(self, bad_color: str) -> None:
        with pytest.raises(ValidationError, match="Color inválido"):
            make_label(color=bad_color)

    def test_dos_etiquetas_tienen_ids_distintos(self) -> None:
        lb1 = make_label()
        lb2 = make_label()
        assert lb1.id != lb2.id


# ── CustomerLabel.rename / change_color / deactivate ─────────────────────────


class TestCustomerLabelMutaciones:
    def test_rename_actualiza_nombre(self) -> None:
        lb = make_label(name="Viejo")
        lb.rename("Nuevo")
        assert lb.name == "Nuevo"

    def test_rename_stripea_espacios(self) -> None:
        lb = make_label()
        lb.rename("  Con Espacios  ")
        assert lb.name == "Con Espacios"

    def test_rename_nombre_vacio_lanza_error(self) -> None:
        lb = make_label()
        with pytest.raises(BusinessRuleViolationError, match="vacío"):
            lb.rename("")

    def test_rename_nombre_largo_lanza_error(self) -> None:
        lb = make_label()
        with pytest.raises(BusinessRuleViolationError, match="50"):
            lb.rename("X" * 51)

    def test_change_color_actualiza_color(self) -> None:
        lb = make_label(color="#10b981")
        lb.change_color("#3b82f6")
        assert lb.color == "#3b82f6"

    def test_change_color_invalido_lanza_error(self) -> None:
        lb = make_label()
        with pytest.raises(ValidationError, match="Color inválido"):
            lb.change_color("azul")

    def test_deactivate_pone_is_active_false(self) -> None:
        lb = make_label()
        lb.deactivate()
        assert lb.is_active is False

    def test_deactivate_ya_inactiva_lanza_error(self) -> None:
        lb = make_label()
        lb.deactivate()
        with pytest.raises(BusinessRuleViolationError, match="ya está inactiva"):
            lb.deactivate()


# ── Customer.create ───────────────────────────────────────────────────────────


class TestCustomerCreate:
    def test_crea_con_nombre_minimo(self) -> None:
        c = make_customer()
        assert c.name == "María González"
        assert c.is_active is True

    def test_asigna_id_automaticamente(self) -> None:
        c = make_customer()
        assert c.id is not None

    def test_campos_opcionales_son_none_por_defecto(self) -> None:
        c = make_customer()
        assert c.email is None
        assert c.phone is None
        assert c.address is None
        assert c.city is None
        assert c.province is None
        assert c.neighborhood is None
        assert c.postal_code is None
        assert c.label_id is None
        assert c.notes is None

    def test_stripea_nombre(self) -> None:
        c = make_customer(name="  Juan Pérez  ")
        assert c.name == "Juan Pérez"

    def test_rechaza_nombre_vacio(self) -> None:
        with pytest.raises(BusinessRuleViolationError, match="vacío"):
            make_customer(name="   ")

    def test_rechaza_nombre_mayor_200_chars(self) -> None:
        with pytest.raises(BusinessRuleViolationError, match="200"):
            make_customer(name="A" * 201)

    def test_email_valido_se_guarda(self) -> None:
        c = make_customer(email="cliente@ejemplo.com")
        assert c.email is not None
        assert c.email.value == "cliente@ejemplo.com"

    def test_phone_se_stripea(self) -> None:
        c = make_customer(phone="  +54 351 555-1234  ")
        assert c.phone == "+54 351 555-1234"

    def test_campos_de_direccion_se_stripean(self) -> None:
        c = make_customer(
            address="  Av. Colón 1234  ",
            city="  Córdoba  ",
            province="Córdoba",
            neighborhood="  Nueva Córdoba  ",
            postal_code="  5000  ",
        )
        assert c.address == "Av. Colón 1234"
        assert c.city == "Córdoba"
        assert c.neighborhood == "Nueva Córdoba"
        assert c.postal_code == "5000"

    def test_label_id_se_guarda(self) -> None:
        label_id = uuid4()
        c = make_customer(label_id=label_id)
        assert c.label_id == label_id

    def test_string_vacio_para_phone_queda_none(self) -> None:
        c = make_customer(phone="   ")
        assert c.phone is None

    def test_string_vacio_para_address_queda_none(self) -> None:
        c = make_customer(address="   ")
        assert c.address is None


# ── Customer.update ───────────────────────────────────────────────────────────


class TestCustomerUpdate:
    def test_actualiza_nombre(self) -> None:
        c = make_customer(name="Viejo")
        c.update(name="Nuevo")
        assert c.name == "Nuevo"

    def test_nombre_vacio_en_update_lanza_error(self) -> None:
        c = make_customer()
        with pytest.raises(BusinessRuleViolationError, match="vacío"):
            c.update(name="   ")

    def test_actualiza_email(self) -> None:
        c = make_customer()
        c.update(email="nuevo@email.com")
        assert c.email is not None
        assert c.email.value == "nuevo@email.com"

    def test_actualiza_telefono(self) -> None:
        c = make_customer(phone="+54 351 000-0000")
        c.update(phone="+54 11 9999-9999")
        assert c.phone == "+54 11 9999-9999"

    def test_actualiza_ciudad_provincia_barrio_cp(self) -> None:
        c = make_customer()
        c.update(
            city="Rosario",
            province="Santa Fe",
            neighborhood="Centro",
            postal_code="2000",
        )
        assert c.city == "Rosario"
        assert c.province == "Santa Fe"
        assert c.neighborhood == "Centro"
        assert c.postal_code == "2000"

    def test_actualiza_direccion(self) -> None:
        c = make_customer()
        c.update(address="Sarmiento 100")
        assert c.address == "Sarmiento 100"

    def test_set_label_id(self) -> None:
        label_id = uuid4()
        c = make_customer()
        c.update(label_id=label_id)
        assert c.label_id == label_id

    def test_clear_label_quita_etiqueta(self) -> None:
        label_id = uuid4()
        c = make_customer(label_id=label_id)
        c.update(clear_label=True)
        assert c.label_id is None

    def test_clear_label_tiene_prioridad_sobre_label_id(self) -> None:
        label_id = uuid4()
        c = make_customer(label_id=label_id)
        c.update(clear_label=True, label_id=uuid4())
        assert c.label_id is None

    def test_none_no_modifica_campos(self) -> None:
        c = make_customer(name="Invariante", phone="+54 351 000-0000")
        c.update()
        assert c.name == "Invariante"
        assert c.phone == "+54 351 000-0000"

    def test_actualiza_notas(self) -> None:
        c = make_customer()
        c.update(notes="Cliente VIP")
        assert c.notes == "Cliente VIP"


# ── Customer.deactivate / reactivate ─────────────────────────────────────────


class TestCustomerCicloDeVida:
    def test_deactivate_pone_is_active_false(self) -> None:
        c = make_customer()
        c.deactivate()
        assert c.is_active is False

    def test_deactivate_ya_inactivo_lanza_error(self) -> None:
        c = make_customer()
        c.deactivate()
        with pytest.raises(BusinessRuleViolationError, match="ya está inactivo"):
            c.deactivate()

    def test_reactivate_pone_is_active_true(self) -> None:
        c = make_customer()
        c.deactivate()
        c.reactivate()
        assert c.is_active is True

    def test_reactivate_ya_activo_lanza_error(self) -> None:
        c = make_customer()
        with pytest.raises(BusinessRuleViolationError, match="ya está activo"):
            c.reactivate()

    def test_dos_clientes_tienen_ids_distintos(self) -> None:
        c1 = make_customer()
        c2 = make_customer()
        assert c1.id != c2.id
