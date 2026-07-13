"""Tests unitarios para entidades y reglas de negocio del módulo Quotes.

Cubre: GlassPane, Quote.create(), transiciones de estado, QuoteCalculator con IVA.
Sin DB, sin frameworks: Python puro.
"""

from decimal import Decimal
from uuid import uuid4

import pytest

from centy.domain.quotes.entities import GlassPane, Quote, QuoteLine
from centy.domain.quotes.services import QuoteCalculator
from centy.domain.quotes.value_objects import FilmMode, LocationType, QuoteStatus
from centy.domain.shared.exceptions import BusinessRuleViolationError
from centy.domain.shared.value_objects import TenantId

# ── Helpers ───────────────────────────────────────────────────────────────────


def make_pane(
    pane_id: str = "v01",
    width_cm: float = 100,
    height_cm: float = 100,
    quantity: int = 1,
    location: LocationType = LocationType.SUPERFICIE,
) -> GlassPane:
    return GlassPane(
        pane_id=pane_id,
        glass_type_id=None,
        glass_type_name="Monolítico",
        width_cm=Decimal(str(width_cm)),
        height_cm=Decimal(str(height_cm)),
        location=location,
        quantity=quantity,
    )


def make_line(
    pane_ids: list[str] | None = None,
    price_per_m2: float = 1000,
    surface_m2: float = 1.0,
    purchase_price_per_m2: float | None = None,
) -> QuoteLine:
    s = Decimal(str(surface_m2))
    p = Decimal(str(price_per_m2))
    snapshot: dict = {"name": "Film Solar"}
    if purchase_price_per_m2 is not None:
        snapshot["purchase_price_per_m2"] = str(purchase_price_per_m2)
    return QuoteLine(
        product_id=uuid4(),
        product_snapshot=snapshot,
        glass_pane_ids=pane_ids or ["v01"],
        price_per_m2=p,
        surface_m2=s,
        subtotal=(p * s).quantize(Decimal("0.01")),
    )


def make_quote(**overrides) -> Quote:
    defaults: dict = dict(
        tenant_id=TenantId(uuid4()),
        created_by_user_id=uuid4(),
        quote_number="P-0001",
        customer_id=None,
        customer_snapshot=None,
        film_mode=FilmMode.SINGLE,
        glass_panes=[make_pane()],
        lines=[make_line()],
        height_surcharge_pct=Decimal("0"),
        travel_cost=Decimal("0"),
        discount_pct=Decimal("0"),
        tax_pct=Decimal("0"),
        commercial_conditions="",
        cut_plan_snapshot={},
        valid_until="2026-12-31",
    )
    defaults.update(overrides)
    return Quote.create(**defaults)


# ── GlassPane.surface_m2 ──────────────────────────────────────────────────────


class TestGlassPaneSurface:
    def test_surface_calcula_correctamente(self) -> None:
        pane = make_pane(width_cm=200, height_cm=150, quantity=2)
        # 2m x 1.5m x 2 = 6 m2
        assert pane.surface_m2 == Decimal("6.00")

    def test_surface_unitario(self) -> None:
        pane = make_pane(width_cm=100, height_cm=100, quantity=1)
        assert pane.surface_m2 == Decimal("1.00")


# ── Quote.create() — validaciones ─────────────────────────────────────────────


class TestQuoteCreate:
    def test_crea_quote_valido(self) -> None:
        q = make_quote()
        assert q.status == QuoteStatus.DRAFT
        assert q.tax_pct == Decimal("0")

    def test_sin_vidrios_lanza_error(self) -> None:
        with pytest.raises(BusinessRuleViolationError, match="vidrio"):
            make_quote(glass_panes=[])

    def test_sin_laminas_lanza_error(self) -> None:
        with pytest.raises(BusinessRuleViolationError, match="lámina"):
            make_quote(lines=[])

    def test_descuento_mayor_50_lanza_error(self) -> None:
        with pytest.raises(BusinessRuleViolationError, match="descuento"):
            make_quote(discount_pct=Decimal("51"))

    def test_recargo_mayor_50_lanza_error(self) -> None:
        with pytest.raises(BusinessRuleViolationError, match="descuento"):
            make_quote(discount_pct=Decimal("-51"))

    def test_descuento_en_limite_aceptado(self) -> None:
        q = make_quote(discount_pct=Decimal("50"))
        assert q.discount_pct == Decimal("50")

    def test_tax_pct_default_es_cero(self) -> None:
        q = make_quote()
        assert q.tax_pct == Decimal("0")

    def test_tax_pct_21_se_almacena(self) -> None:
        q = make_quote(tax_pct=Decimal("21"))
        assert q.tax_pct == Decimal("21")


# ── Quote.has_altura_panes ────────────────────────────────────────────────────


class TestQuoteAlturaFlag:
    def test_sin_panes_altura_es_false(self) -> None:
        q = make_quote(glass_panes=[make_pane(location=LocationType.SUPERFICIE)])
        assert q.has_altura_panes is False

    def test_con_pane_altura_es_true(self) -> None:
        q = make_quote(
            glass_panes=[
                make_pane("v01", location=LocationType.SUPERFICIE),
                make_pane("v02", location=LocationType.ALTURA),
            ],
            lines=[make_line(pane_ids=["v01", "v02"])],
        )
        assert q.has_altura_panes is True


# ── Transiciones de estado ────────────────────────────────────────────────────


class TestQuoteStatusTransitions:
    def test_submit_draft_a_sent(self) -> None:
        q = make_quote()
        q.submit()
        assert q.status == QuoteStatus.SENT

    def test_submit_no_draft_lanza_error(self) -> None:
        q = make_quote()
        q.submit()
        with pytest.raises(BusinessRuleViolationError):
            q.submit()

    def test_accept_sent_a_accepted(self) -> None:
        q = make_quote()
        q.submit()
        q.accept()
        assert q.status == QuoteStatus.ACCEPTED

    def test_accept_sin_sent_lanza_error(self) -> None:
        q = make_quote()
        with pytest.raises(BusinessRuleViolationError):
            q.accept()

    def test_invoice_accepted_a_invoiced(self) -> None:
        q = make_quote()
        q.submit()
        q.accept()
        q.invoice()
        assert q.status == QuoteStatus.INVOICED

    def test_complete_invoiced_a_completed(self) -> None:
        q = make_quote()
        q.submit()
        q.accept()
        q.invoice()
        q.complete()
        assert q.status == QuoteStatus.COMPLETED

    def test_complete_sin_invoiced_lanza_error(self) -> None:
        q = make_quote()
        with pytest.raises(BusinessRuleViolationError, match="facturados"):
            q.complete()

    def test_cancel_completed_lanza_error(self) -> None:
        q = make_quote()
        q.submit()
        q.accept()
        q.invoice()
        q.complete()
        with pytest.raises(BusinessRuleViolationError, match="facturado o terminado"):
            q.cancel()

    def test_cancel_desde_cualquier_estado_no_invoiced(self) -> None:
        for setup in [
            lambda q: None,
            lambda q: q.submit(),
        ]:
            q = make_quote()
            setup(q)
            q.cancel()
            assert q.status == QuoteStatus.CANCELLED

    def test_cancel_invoiced_lanza_error(self) -> None:
        q = make_quote()
        q.submit()
        q.accept()
        q.invoice()
        with pytest.raises(BusinessRuleViolationError, match="facturado"):
            q.cancel()

    def test_cancel_ya_cancelado_lanza_error(self) -> None:
        q = make_quote()
        q.cancel()
        with pytest.raises(BusinessRuleViolationError, match="cancelado"):
            q.cancel()


# ── QuoteCalculator ───────────────────────────────────────────────────────────


class TestQuoteCalculator:
    calc = QuoteCalculator()

    def _quote_with(self, **overrides) -> Quote:
        return make_quote(**overrides)

    def test_total_sin_iva_sin_descuento(self) -> None:
        # 1 m² x $1000/m² = $1000 materials; todo cero → total = $1000
        q = self._quote_with(
            glass_panes=[make_pane(width_cm=100, height_cm=100)],
            lines=[make_line(price_per_m2=1000, surface_m2=1.0)],
        )
        totals = self.calc.calculate(q)
        assert totals.materials_subtotal == Decimal("1000.00")
        assert totals.subtotal == Decimal("1000.00")
        assert totals.tax_amount == Decimal("0.00")
        assert totals.total == Decimal("1000.00")

    def test_iva_21_se_aplica_sobre_subtotal(self) -> None:
        # subtotal $1000, IVA 21% → tax_amount = $210, total = $1210
        q = self._quote_with(
            glass_panes=[make_pane()],
            lines=[make_line(price_per_m2=1000, surface_m2=1.0)],
            tax_pct=Decimal("21"),
        )
        totals = self.calc.calculate(q)
        assert totals.tax_amount == Decimal("210.00")
        assert totals.total == Decimal("1210.00")

    def test_iva_se_aplica_sobre_importe_neto_despues_de_descuento(self) -> None:
        # subtotal $1000, descuento 10% → taxable $900, IVA 21% → $189, total $1089
        q = self._quote_with(
            glass_panes=[make_pane()],
            lines=[make_line(price_per_m2=1000, surface_m2=1.0)],
            discount_pct=Decimal("10"),
            tax_pct=Decimal("21"),
        )
        totals = self.calc.calculate(q)
        assert totals.discount_amount == Decimal("100.00")
        assert totals.tax_amount == Decimal("189.00")
        assert totals.total == Decimal("1089.00")

    def test_sin_iva_tax_amount_es_cero(self) -> None:
        q = self._quote_with(
            glass_panes=[make_pane()],
            lines=[make_line(price_per_m2=500, surface_m2=2.0)],
            tax_pct=Decimal("0"),
        )
        totals = self.calc.calculate(q)
        assert totals.tax_amount == Decimal("0.00")
        assert totals.total == totals.subtotal - totals.discount_amount

    def test_recargo_reduce_base_imponible_iva(self) -> None:
        # subtotal $1000, recargo 10% (discount_pct=-10) → taxable $1100, IVA 21% → $231
        q = self._quote_with(
            glass_panes=[make_pane()],
            lines=[make_line(price_per_m2=1000, surface_m2=1.0)],
            discount_pct=Decimal("-10"),
            tax_pct=Decimal("21"),
        )
        totals = self.calc.calculate(q)
        assert totals.discount_amount == Decimal("-100.00")
        assert totals.tax_amount == Decimal("231.00")
        assert totals.total == Decimal("1331.00")

    def test_viaticos_se_suman_antes_de_calcular_iva(self) -> None:
        # materials $1000 + travel $500 = subtotal $1500, IVA 21% → $315, total $1815
        q = self._quote_with(
            glass_panes=[make_pane()],
            lines=[make_line(price_per_m2=1000, surface_m2=1.0)],
            travel_cost=Decimal("500"),
            tax_pct=Decimal("21"),
        )
        totals = self.calc.calculate(q)
        assert totals.subtotal == Decimal("1500.00")
        assert totals.tax_amount == Decimal("315.00")
        assert totals.total == Decimal("1815.00")

    def test_recargo_altura_se_suma_antes_de_iva(self) -> None:
        # pane 1m² en ALTURA; price $1000; altura 30% → surcharge $300
        # subtotal = $1000 + $300 = $1300, IVA 21% → $273, total $1573
        pane = make_pane(
            "v01", width_cm=100, height_cm=100, location=LocationType.ALTURA
        )
        line = QuoteLine(
            product_id=uuid4(),
            product_snapshot={},
            glass_pane_ids=["v01"],
            price_per_m2=Decimal("1000"),
            surface_m2=Decimal("1.00"),
            subtotal=Decimal("1000.00"),
        )
        q = make_quote(
            glass_panes=[pane],
            lines=[line],
            height_surcharge_pct=Decimal("30"),
            tax_pct=Decimal("21"),
        )
        totals = self.calc.calculate(q)
        assert totals.height_surcharge == Decimal("300.00")
        assert totals.subtotal == Decimal("1300.00")
        assert totals.tax_amount == Decimal("273.00")
        assert totals.total == Decimal("1573.00")


# ── QuoteCalculator.calculate_margin ─────────────────────────────────────────


class TestQuoteCalculatorMargin:
    calc = QuoteCalculator()

    def test_todas_las_lineas_con_costo_calcula_margen(self) -> None:
        # línea 1: venta 1000, costo 600, 1m² → margen 400
        # línea 2: venta 500, costo 300, 2m² → margen 400
        q = make_quote(
            glass_panes=[make_pane("v01"), make_pane("v02")],
            lines=[
                make_line(
                    pane_ids=["v01"],
                    price_per_m2=1000,
                    surface_m2=1.0,
                    purchase_price_per_m2=600,
                ),
                make_line(
                    pane_ids=["v02"],
                    price_per_m2=500,
                    surface_m2=2.0,
                    purchase_price_per_m2=300,
                ),
            ],
        )
        assert self.calc.calculate_margin(q) == Decimal("800.00")

    def test_alguna_linea_sin_costo_devuelve_none(self) -> None:
        # quote creado antes de este feature: falta el snapshot de costo
        q = make_quote(
            lines=[
                make_line(price_per_m2=1000, surface_m2=1.0, purchase_price_per_m2=None)
            ]
        )
        assert self.calc.calculate_margin(q) is None

    def test_quote_sin_lineas_no_existe_pero_una_linea_sin_costo_es_none(self) -> None:
        # Quote.create ya exige al menos una línea (ver TestQuoteCreate), así
        # que "sin líneas" no es un estado alcanzable — se cubre el caso
        # límite de una única línea incompleta en su lugar.
        q = make_quote(
            lines=[make_line(purchase_price_per_m2=None)],
        )
        assert self.calc.calculate_margin(q) is None
