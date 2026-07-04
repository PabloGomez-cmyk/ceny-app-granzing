from dataclasses import dataclass
from typing import NewType
from uuid import UUID

from centy.domain.shared.exceptions import ValidationError

UserId = NewType("UserId", UUID)


@dataclass(frozen=True)
class HashedPassword:
    """Contraseña ya hasheada con bcrypt.

    El dominio nunca manipula contraseñas en texto plano.
    El hashing ocurre en la capa de infraestructura (IPasswordHasher).
    """

    value: str

    def __post_init__(self) -> None:
        if not self.value:
            raise ValidationError("HashedPassword no puede estar vacío")

    def __repr__(self) -> str:
        return "HashedPassword(***)"
