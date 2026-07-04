import re
from dataclasses import dataclass
from decimal import Decimal
from typing import NewType
from uuid import UUID

from centy.domain.shared.exceptions import ValidationError

TenantId = NewType("TenantId", UUID)

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


@dataclass(frozen=True)
class Email:
    value: str

    def __post_init__(self) -> None:
        if not _EMAIL_RE.match(self.value):
            raise ValidationError(f"Email inválido: '{self.value}'")

    def __str__(self) -> str:
        return self.value


@dataclass(frozen=True)
class Money:
    """Value object inmutable que representa un monto monetario.

    Invariante: amount >= 0. Las operaciones de sustracción que resulten
    en negativos deben ser validadas en el servicio de dominio correspondiente.
    """

    amount: Decimal
    currency: str = "ARS"

    def __post_init__(self) -> None:
        if self.amount < Decimal(0):
            raise ValidationError(
                f"Money no puede ser negativo: {self.amount} {self.currency}"
            )

    def __add__(self, other: "Money") -> "Money":
        self._assert_same_currency(other)
        return Money(self.amount + other.amount, self.currency)

    def __sub__(self, other: "Money") -> "Money":
        self._assert_same_currency(other)
        result = self.amount - other.amount
        if result < Decimal(0):
            raise ValidationError("La sustracción resulta en un monto negativo")
        return Money(result, self.currency)

    def __mul__(self, factor: Decimal) -> "Money":
        return Money((self.amount * factor).quantize(Decimal("0.01")), self.currency)

    def __lt__(self, other: "Money") -> bool:
        self._assert_same_currency(other)
        return self.amount < other.amount

    def __le__(self, other: "Money") -> bool:
        self._assert_same_currency(other)
        return self.amount <= other.amount

    def __gt__(self, other: "Money") -> bool:
        self._assert_same_currency(other)
        return self.amount > other.amount

    def __ge__(self, other: "Money") -> bool:
        self._assert_same_currency(other)
        return self.amount >= other.amount

    def _assert_same_currency(self, other: "Money") -> None:
        if self.currency != other.currency:
            raise ValidationError(
                f"No se pueden operar monedas distintas: {self.currency} vs {other.currency}"
            )

    def __str__(self) -> str:
        return f"{self.currency} {self.amount:.2f}"
