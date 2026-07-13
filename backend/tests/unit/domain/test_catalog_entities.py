"""Tests unitarios para entidades y value objects del catálogo.

NO hay DB ni frameworks: puro dominio Python.
"""

from decimal import Decimal
from uuid import uuid4

import pytest

from centy.domain.catalog.entities import Brand, GlassType, Product, ProductCategory
from centy.domain.catalog.value_objects import ApplicationType, Percentage
from centy.domain.shared.exceptions import BusinessRuleViolationError, ValidationError
from centy.domain.shared.value_objects import TenantId

# ── Helpers ───────────────────────────────────────────────────────────────────


def make_tenant() -> TenantId:
    return TenantId(uuid4())


def make_brand(**overrides) -> Brand:  # type: ignore[no-untyped-def]
    defaults: dict = dict(
        tenant_id=make_tenant(),
        name="3M",
        color="#0f6e50",
    )
    defaults.update(overrides)
    return Brand.create(**defaults)


def make_category(**overrides) -> ProductCategory:  # type: ignore[no-untyped-def]
    defaults: dict = dict(
        tenant_id=make_tenant(),
        name="Solar",
    )
    defaults.update(overrides)
    return ProductCategory.create(**defaults)


def make_glass_type(**overrides) -> GlassType:  # type: ignore[no-untyped-def]
    defaults: dict = dict(
        tenant_id=make_tenant(),
        name="Monolítico",
    )
    defaults.update(overrides)
    return GlassType.create(**defaults)


def make_product(**overrides) -> Product:  # type: ignore[no-untyped-def]
    defaults: dict = dict(
        tenant_id=make_tenant(),
        name="FX-5 Carbono",
        brand_id=uuid4(),
        sale_price_per_m2=Decimal("1500.00"),
        purchase_price_per_m2=Decimal("800.00"),
        uv_percentage=Decimal("99"),
        irr_percentage=Decimal("72"),
        tser_percentage=Decimal("58"),
        warranty_years=5,
        category_id=uuid4(),
        application_types=["WINDOW"],
    )
    defaults.update(overrides)
    return Product.create(**defaults)


# ── Percentage ────────────────────────────────────────────────────────────────


class TestPercentage:
    @pytest.mark.parametrize("value", ["0", "0.00", "50", "99.99", "100"])
    def test_acepta_rango_valido(self, value: str) -> None:
        p = Percentage(Decimal(value))
        assert Decimal("0") <= p.value <= Decimal("100")

    def test_redondea_a_dos_decimales(self) -> None:
        p = Percentage(Decimal("50.123"))
        assert p.value == Decimal("50.12")

    def test_rechaza_negativo(self) -> None:
        with pytest.raises(ValidationError, match="rango"):
            Percentage(Decimal("-0.01"))

    def test_rechaza_mayor_100(self) -> None:
        with pytest.raises(ValidationError, match="rango"):
            Percentage(Decimal("100.01"))

    def test_str_incluye_simbolo_porcentaje(self) -> None:
        p = Percentage(Decimal("75"))
        assert "%" in str(p)


# ── ApplicationType ───────────────────────────────────────────────────────────


class TestApplicationType:
    def test_valores_existentes(self) -> None:
        assert ApplicationType.WINDOW == "WINDOW"
        assert ApplicationType.AUTOMOTIVE == "AUTOMOTIVE"

    def test_construccion_desde_string(self) -> None:
        assert ApplicationType("WINDOW") is ApplicationType.WINDOW

    def test_string_invalido_lanza_value_error(self) -> None:
        with pytest.raises(ValueError):
            ApplicationType("MARITIME")


# ── Brand.create ──────────────────────────────────────────────────────────────


class TestBrandCreate:
    def test_crea_con_datos_validos(self) -> None:
        b = make_brand()
        assert b.name == "3M"
        assert b.color == "#0f6e50"
        assert b.is_active is True
        assert b.logo_url is None

    def test_asigna_id_automaticamente(self) -> None:
        b = make_brand()
        assert b.id is not None

    def test_stripea_nombre(self) -> None:
        b = make_brand(name="  Madico  ")
        assert b.name == "Madico"

    def test_rechaza_nombre_vacio(self) -> None:
        with pytest.raises(BusinessRuleViolationError, match="vacío"):
            make_brand(name="   ")

    def test_rechaza_nombre_mayor_100_chars(self) -> None:
        with pytest.raises(BusinessRuleViolationError, match="100"):
            make_brand(name="A" * 101)

    @pytest.mark.parametrize("color", ["#0f6e50", "#FFFFFF", "#000000", "#aabbcc"])
    def test_acepta_colores_hex_validos(self, color: str) -> None:
        b = make_brand(color=color)
        assert b.color == color

    @pytest.mark.parametrize("bad", ["red", "#xyz", "#12345", "0f6e50", ""])
    def test_rechaza_colores_invalidos(self, bad: str) -> None:
        with pytest.raises(ValidationError, match="Color inválido"):
            make_brand(color=bad)

    def test_acepta_logo_url(self) -> None:
        b = make_brand(logo_url="https://cdn.example.com/logo.png")
        assert b.logo_url == "https://cdn.example.com/logo.png"

    def test_dos_marcas_tienen_ids_distintos(self) -> None:
        b1 = make_brand()
        b2 = make_brand()
        assert b1.id != b2.id


# ── Brand.update ──────────────────────────────────────────────────────────────


class TestBrandUpdate:
    def test_actualiza_nombre(self) -> None:
        b = make_brand(name="Viejo")
        b.update(name="Nuevo")
        assert b.name == "Nuevo"

    def test_actualiza_color(self) -> None:
        b = make_brand(color="#0f6e50")
        b.update(color="#3b82f6")
        assert b.color == "#3b82f6"

    def test_set_logo_url(self) -> None:
        b = make_brand()
        b.update(logo_url="https://cdn.example.com/logo.png")
        assert b.logo_url == "https://cdn.example.com/logo.png"

    def test_clear_logo_borra_url(self) -> None:
        b = make_brand(logo_url="https://cdn.example.com/logo.png")
        b.update(clear_logo=True)
        assert b.logo_url is None

    def test_clear_logo_tiene_prioridad_sobre_logo_url(self) -> None:
        b = make_brand(logo_url="https://cdn.example.com/old.png")
        b.update(logo_url="https://cdn.example.com/new.png", clear_logo=True)
        assert b.logo_url is None

    def test_nombre_vacio_en_update_lanza_error(self) -> None:
        b = make_brand()
        with pytest.raises(BusinessRuleViolationError, match="vacío"):
            b.update(name="   ")

    def test_color_invalido_en_update_lanza_error(self) -> None:
        b = make_brand()
        with pytest.raises(ValidationError):
            b.update(color="rojo")

    def test_none_no_modifica_campos(self) -> None:
        b = make_brand(name="Invariante", color="#0f6e50")
        b.update()
        assert b.name == "Invariante"
        assert b.color == "#0f6e50"


# ── Brand.deactivate / reactivate ─────────────────────────────────────────────


class TestBrandCicloDeVida:
    def test_deactivate_pone_is_active_false(self) -> None:
        b = make_brand()
        b.deactivate()
        assert b.is_active is False

    def test_deactivate_ya_inactiva_lanza_error(self) -> None:
        b = make_brand()
        b.deactivate()
        with pytest.raises(BusinessRuleViolationError, match="ya está inactiva"):
            b.deactivate()

    def test_reactivate_pone_is_active_true(self) -> None:
        b = make_brand()
        b.deactivate()
        b.reactivate()
        assert b.is_active is True

    def test_reactivate_ya_activa_lanza_error(self) -> None:
        b = make_brand()
        with pytest.raises(BusinessRuleViolationError, match="ya está activa"):
            b.reactivate()


# ── ProductCategory ───────────────────────────────────────────────────────────


class TestProductCategoryCreate:
    def test_crea_con_datos_validos(self) -> None:
        c = make_category()
        assert c.name == "Solar"
        assert c.is_active is True

    def test_stripea_nombre(self) -> None:
        c = make_category(name="  Decorativo  ")
        assert c.name == "Decorativo"

    def test_rechaza_nombre_vacio(self) -> None:
        with pytest.raises(BusinessRuleViolationError, match="vacío"):
            make_category(name="   ")

    def test_rechaza_nombre_mayor_100_chars(self) -> None:
        with pytest.raises(BusinessRuleViolationError, match="100"):
            make_category(name="A" * 101)


class TestProductCategoryMutaciones:
    def test_rename_actualiza_nombre(self) -> None:
        c = make_category(name="Viejo")
        c.rename("Nuevo")
        assert c.name == "Nuevo"

    def test_rename_vacio_lanza_error(self) -> None:
        c = make_category()
        with pytest.raises(BusinessRuleViolationError, match="vacío"):
            c.rename("")

    def test_rename_largo_lanza_error(self) -> None:
        c = make_category()
        with pytest.raises(BusinessRuleViolationError, match="100"):
            c.rename("X" * 101)

    def test_deactivate_pone_is_active_false(self) -> None:
        c = make_category()
        c.deactivate()
        assert c.is_active is False

    def test_deactivate_ya_inactiva_lanza_error(self) -> None:
        c = make_category()
        c.deactivate()
        with pytest.raises(BusinessRuleViolationError, match="ya está inactiva"):
            c.deactivate()

    def test_reactivate_pone_is_active_true(self) -> None:
        c = make_category()
        c.deactivate()
        c.reactivate()
        assert c.is_active is True

    def test_reactivate_ya_activa_lanza_error(self) -> None:
        c = make_category()
        with pytest.raises(BusinessRuleViolationError, match="ya está activa"):
            c.reactivate()


# ── GlassType ─────────────────────────────────────────────────────────────────


class TestGlassTypeCreate:
    def test_crea_con_datos_validos(self) -> None:
        g = make_glass_type()
        assert g.name == "Monolítico"
        assert g.is_active is True

    def test_stripea_nombre(self) -> None:
        g = make_glass_type(name="  DVH  ")
        assert g.name == "DVH"

    def test_rechaza_nombre_vacio(self) -> None:
        with pytest.raises(BusinessRuleViolationError, match="vacío"):
            make_glass_type(name="   ")

    def test_rechaza_nombre_mayor_100_chars(self) -> None:
        with pytest.raises(BusinessRuleViolationError, match="100"):
            make_glass_type(name="A" * 101)


class TestGlassTypeMutaciones:
    def test_rename_actualiza_nombre(self) -> None:
        g = make_glass_type(name="Monolítico")
        g.rename("Laminado")
        assert g.name == "Laminado"

    def test_rename_vacio_lanza_error(self) -> None:
        g = make_glass_type()
        with pytest.raises(BusinessRuleViolationError, match="vacío"):
            g.rename("")

    def test_deactivate_pone_is_active_false(self) -> None:
        g = make_glass_type()
        g.deactivate()
        assert g.is_active is False

    def test_deactivate_ya_inactivo_lanza_error(self) -> None:
        g = make_glass_type()
        g.deactivate()
        with pytest.raises(BusinessRuleViolationError, match="ya está inactivo"):
            g.deactivate()

    def test_reactivate_pone_is_active_true(self) -> None:
        g = make_glass_type()
        g.deactivate()
        g.reactivate()
        assert g.is_active is True

    def test_reactivate_ya_activo_lanza_error(self) -> None:
        g = make_glass_type()
        with pytest.raises(BusinessRuleViolationError, match="ya está activo"):
            g.reactivate()


# ── Product.create ────────────────────────────────────────────────────────────


class TestProductCreate:
    def test_crea_con_datos_minimos(self) -> None:
        p = make_product()
        assert p.name == "FX-5 Carbono"
        assert p.is_active is True
        assert p.technical_sheet_url is None
        assert p.compatible_glass_ids == []

    def test_asigna_id_automaticamente(self) -> None:
        p = make_product()
        assert p.id is not None

    def test_crea_con_multiples_application_types(self) -> None:
        p = make_product(application_types=["WINDOW", "AUTOMOTIVE"])
        types = [t.value for t in p.application_types]
        assert "WINDOW" in types
        assert "AUTOMOTIVE" in types

    def test_crea_con_compatible_glass_ids(self) -> None:
        ids = [uuid4(), uuid4()]
        p = make_product(compatible_glass_ids=ids)
        assert p.compatible_glass_ids == ids

    def test_crea_con_technical_sheet_url(self) -> None:
        p = make_product(technical_sheet_url="https://cdn.example.com/sheet.pdf")
        assert p.technical_sheet_url == "https://cdn.example.com/sheet.pdf"

    def test_stripea_nombre(self) -> None:
        p = make_product(name="  FX-5  ")
        assert p.name == "FX-5"

    def test_rechaza_nombre_vacio(self) -> None:
        with pytest.raises(BusinessRuleViolationError, match="vacío"):
            make_product(name="   ")

    def test_rechaza_nombre_mayor_200_chars(self) -> None:
        with pytest.raises(BusinessRuleViolationError, match="200"):
            make_product(name="A" * 201)

    def test_rechaza_warranty_years_negativo(self) -> None:
        with pytest.raises(BusinessRuleViolationError, match="negativos"):
            make_product(warranty_years=-1)

    def test_warranty_years_cero_es_valido(self) -> None:
        p = make_product(warranty_years=0)
        assert p.warranty_years == 0

    def test_rechaza_application_types_vacio(self) -> None:
        with pytest.raises(BusinessRuleViolationError, match="al menos una"):
            make_product(application_types=[])

    def test_rechaza_application_type_invalido(self) -> None:
        with pytest.raises(ValidationError, match="inválido"):
            make_product(application_types=["MARITIME"])

    def test_porcentajes_se_validan(self) -> None:
        with pytest.raises(ValidationError, match="rango"):
            make_product(uv_percentage=Decimal("101"))

    def test_sale_price_se_guarda_correctamente(self) -> None:
        p = make_product(sale_price_per_m2=Decimal("2500.50"))
        assert p.sale_price_per_m2.amount == Decimal("2500.50")

    def test_purchase_price_se_guarda_correctamente(self) -> None:
        p = make_product(purchase_price_per_m2=Decimal("900.25"))
        assert p.purchase_price_per_m2.amount == Decimal("900.25")

    def test_no_exige_purchase_price_menor_o_igual_a_sale_price(self) -> None:
        # Decisión de producto: no hay validación de rango entre costo y
        # precio de venta — un producto puede crearse con costo > precio
        # de venta (por ejemplo, mientras se carga el catálogo).
        p = make_product(
            sale_price_per_m2=Decimal("100.00"),
            purchase_price_per_m2=Decimal("500.00"),
        )
        assert p.purchase_price_per_m2.amount > p.sale_price_per_m2.amount


# ── Product.update ────────────────────────────────────────────────────────────


class TestProductUpdate:
    def test_actualiza_nombre(self) -> None:
        p = make_product(name="Viejo")
        p.update(name="Nuevo")
        assert p.name == "Nuevo"

    def test_actualiza_precio(self) -> None:
        p = make_product()
        p.update(sale_price_per_m2=Decimal("3000"))
        assert p.sale_price_per_m2.amount == Decimal("3000")

    def test_actualiza_purchase_price(self) -> None:
        p = make_product()
        p.update(purchase_price_per_m2=Decimal("1200"))
        assert p.purchase_price_per_m2.amount == Decimal("1200")

    def test_actualiza_porcentajes(self) -> None:
        p = make_product()
        p.update(
            uv_percentage=Decimal("95"),
            irr_percentage=Decimal("65"),
            tser_percentage=Decimal("50"),
        )
        assert p.uv_percentage.value == Decimal("95.00")
        assert p.irr_percentage.value == Decimal("65.00")
        assert p.tser_percentage.value == Decimal("50.00")

    def test_actualiza_warranty_years(self) -> None:
        p = make_product(warranty_years=5)
        p.update(warranty_years=10)
        assert p.warranty_years == 10

    def test_actualiza_application_types(self) -> None:
        p = make_product(application_types=["WINDOW"])
        p.update(application_types=["AUTOMOTIVE"])
        assert p.application_types[0] == ApplicationType.AUTOMOTIVE

    def test_actualiza_compatible_glass_ids(self) -> None:
        p = make_product()
        new_ids = [uuid4()]
        p.update(compatible_glass_ids=new_ids)
        assert p.compatible_glass_ids == new_ids

    def test_set_technical_sheet_url(self) -> None:
        p = make_product()
        p.update(technical_sheet_url="https://cdn.example.com/sheet.pdf")
        assert p.technical_sheet_url == "https://cdn.example.com/sheet.pdf"

    def test_clear_technical_sheet(self) -> None:
        p = make_product(technical_sheet_url="https://cdn.example.com/sheet.pdf")
        p.update(clear_technical_sheet=True)
        assert p.technical_sheet_url is None

    def test_warranty_negativo_en_update_lanza_error(self) -> None:
        p = make_product()
        with pytest.raises(BusinessRuleViolationError, match="negativos"):
            p.update(warranty_years=-1)

    def test_application_types_vacio_en_update_lanza_error(self) -> None:
        p = make_product()
        with pytest.raises(BusinessRuleViolationError, match="al menos una"):
            p.update(application_types=[])

    def test_none_no_modifica_campos(self) -> None:
        p = make_product(name="Invariante", warranty_years=5)
        p.update()
        assert p.name == "Invariante"
        assert p.warranty_years == 5


# ── Product.deactivate / reactivate ──────────────────────────────────────────


class TestProductCicloDeVida:
    def test_deactivate_pone_is_active_false(self) -> None:
        p = make_product()
        p.deactivate()
        assert p.is_active is False

    def test_deactivate_ya_inactivo_lanza_error(self) -> None:
        p = make_product()
        p.deactivate()
        with pytest.raises(BusinessRuleViolationError, match="ya está inactivo"):
            p.deactivate()

    def test_reactivate_pone_is_active_true(self) -> None:
        p = make_product()
        p.deactivate()
        p.reactivate()
        assert p.is_active is True

    def test_reactivate_ya_activo_lanza_error(self) -> None:
        p = make_product()
        with pytest.raises(BusinessRuleViolationError, match="ya está activo"):
            p.reactivate()
