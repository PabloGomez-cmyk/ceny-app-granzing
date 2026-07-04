"""Tests para el value object Money."""

from decimal import Decimal

import pytest

from centy.domain.shared.exceptions import ValidationError
from centy.domain.shared.value_objects import Money


def ars(amount: str) -> Money:
    return Money(Decimal(amount), "ARS")


class TestMoneyCreation:
    def test_valid_amount(self) -> None:
        m = ars("100.50")
        assert m.amount == Decimal("100.50")

    def test_zero_is_valid(self) -> None:
        m = ars("0")
        assert m.amount == Decimal("0")

    def test_negative_raises(self) -> None:
        with pytest.raises(ValidationError, match="negativo"):
            ars("-1")


class TestMoneyArithmetic:
    def test_add(self) -> None:
        assert ars("100") + ars("50") == ars("150")

    def test_sub(self) -> None:
        assert ars("100") - ars("50") == ars("50")

    def test_sub_to_zero(self) -> None:
        assert ars("100") - ars("100") == ars("0")

    def test_sub_resulting_negative_raises(self) -> None:
        with pytest.raises(ValidationError, match="negativo"):
            ars("50") - ars("100")

    def test_mul(self) -> None:
        result = ars("100") * Decimal("0.21")
        assert result.amount == Decimal("21.00")

    def test_different_currencies_raise(self) -> None:
        usd = Money(Decimal("100"), "USD")
        with pytest.raises(ValidationError, match="monedas distintas"):
            ars("100") + usd


class TestMoneyComparison:
    def test_lt(self) -> None:
        assert ars("50") < ars("100")

    def test_le(self) -> None:
        assert ars("100") <= ars("100")

    def test_gt(self) -> None:
        assert ars("100") > ars("50")

    def test_ge(self) -> None:
        assert ars("100") >= ars("100")

    def test_equality(self) -> None:
        assert ars("100") == ars("100")
        assert ars("100") != ars("99.99")
