"""Tests unitarios para la entidad Warranty.

Cubre: create() calcula bien expires_at, rechaza warranty_years inválido,
is_valid según fecha. Sin DB, sin frameworks.
"""

from datetime import date, timedelta
from uuid import uuid4

import pytest

from centy.domain.shared.exceptions import BusinessRuleViolationError
from centy.domain.shared.value_objects import TenantId
from centy.domain.warranties.entities import Warranty


def make_warranty(
    warranty_years: int = 5,
    vehicle_model: str | None = None,
    license_plate: str | None = None,
) -> Warranty:
    return Warranty.create(
        tenant_id=TenantId(uuid4()),
        quote_id=uuid4(),
        quote_line_id=uuid4(),
        product_id=uuid4(),
        product_snapshot={"name": "Black Silver", "brand_name": "3M"},
        warranty_number="G-0001",
        customer_snapshot={"name": "Pablo Gómez"},
        created_by_user_id=uuid4(),
        warranty_years=warranty_years,
        vehicle_model=vehicle_model,
        license_plate=license_plate,
    )


class TestWarrantyCreate:
    def test_expires_at_es_hoy_mas_warranty_years(self) -> None:
        w = make_warranty(warranty_years=5)
        expected = date.today().replace(year=date.today().year + 5)
        assert w.expires_at == expected

    def test_warranty_years_cero_lanza_error(self) -> None:
        with pytest.raises(BusinessRuleViolationError, match="garantía válida"):
            make_warranty(warranty_years=0)

    def test_warranty_years_negativo_lanza_error(self) -> None:
        with pytest.raises(BusinessRuleViolationError, match="garantía válida"):
            make_warranty(warranty_years=-1)

    def test_sent_at_default_es_none(self) -> None:
        w = make_warranty()
        assert w.sent_at is None

    def test_vehicle_model_y_license_plate_son_none_por_defecto(self) -> None:
        w = make_warranty()
        assert w.vehicle_model is None
        assert w.license_plate is None

    def test_acepta_vehicle_model_y_license_plate(self) -> None:
        w = make_warranty(vehicle_model="Toyota Corolla 2021", license_plate="AB123CD")
        assert w.vehicle_model == "Toyota Corolla 2021"
        assert w.license_plate == "AB123CD"


class TestWarrantyIsValid:
    def test_es_valida_si_no_vencio(self) -> None:
        w = make_warranty(warranty_years=5)
        assert w.is_valid is True

    def test_no_es_valida_si_vencio(self) -> None:
        w = make_warranty(warranty_years=1)
        w.expires_at = date.today() - timedelta(days=1)
        assert w.is_valid is False

    def test_es_valida_el_dia_exacto_de_vencimiento(self) -> None:
        w = make_warranty(warranty_years=1)
        w.expires_at = date.today()
        assert w.is_valid is True
