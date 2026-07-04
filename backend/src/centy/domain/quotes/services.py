from dataclasses import dataclass
from decimal import Decimal

from centy.domain.quotes.entities import Quote
from centy.domain.quotes.value_objects import LocationType


@dataclass(frozen=True)
class QuoteTotals:
    materials_subtotal: Decimal
    height_surcharge: Decimal
    travel_cost: Decimal
    subtotal: Decimal
    discount_amount: Decimal
    tax_amount: Decimal
    total: Decimal


class QuoteCalculator:
    """Servicio de dominio puro: calcula los totales financieros de un Quote."""

    def calculate(self, quote: Quote) -> QuoteTotals:
        materials_subtotal = sum(
            (line.subtotal for line in quote.lines), Decimal("0")
        )

        altura_pane_ids = {
            p.pane_id for p in quote.glass_panes if p.location == LocationType.ALTURA
        }

        height_base_cost = Decimal("0")
        for line in quote.lines:
            for pane_id in line.glass_pane_ids:
                if pane_id in altura_pane_ids:
                    pane = next((p for p in quote.glass_panes if p.pane_id == pane_id), None)
                    if pane:
                        height_base_cost += pane.surface_m2 * line.price_per_m2

        height_surcharge = (height_base_cost * quote.height_surcharge_pct / 100).quantize(Decimal("0.01"))

        subtotal = materials_subtotal + height_surcharge + quote.travel_cost

        discount_amount = (subtotal * quote.discount_pct / 100).quantize(Decimal("0.01"))
        taxable_amount = subtotal - discount_amount
        tax_amount = (taxable_amount * quote.tax_pct / 100).quantize(Decimal("0.01"))
        total = taxable_amount + tax_amount

        return QuoteTotals(
            materials_subtotal=materials_subtotal,
            height_surcharge=height_surcharge,
            travel_cost=quote.travel_cost,
            subtotal=subtotal,
            discount_amount=discount_amount,
            tax_amount=tax_amount,
            total=total,
        )
