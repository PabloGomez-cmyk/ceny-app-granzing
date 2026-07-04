from dataclasses import dataclass
from decimal import Decimal
from enum import StrEnum

from centy.domain.shared.exceptions import ValidationError


class ApplicationType(StrEnum):
    WINDOW = "WINDOW"
    AUTOMOTIVE = "AUTOMOTIVE"


@dataclass(frozen=True)
class Percentage:
    """Porcentaje entre 0.00 y 100.00 inclusive."""

    value: Decimal

    def __post_init__(self) -> None:
        v = Decimal(str(self.value)).quantize(Decimal("0.01"))
        object.__setattr__(self, "value", v)
        if not (Decimal("0") <= v <= Decimal("100")):
            raise ValidationError(f"Porcentaje fuera de rango (0-100): {v}")

    def __str__(self) -> str:
        return f"{self.value}%"
