import re
from dataclasses import dataclass
from uuid import UUID

from centy.domain.shared.entity import Entity
from centy.domain.shared.exceptions import BusinessRuleViolationError, ValidationError
from centy.domain.shared.value_objects import Email, TenantId

_COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")

DEFAULT_LABEL_COLORS = [
    "#10b981",  # emerald
    "#3b82f6",  # blue
    "#8b5cf6",  # violet
    "#f59e0b",  # amber
    "#ef4444",  # red
    "#06b6d4",  # cyan
    "#ec4899",  # pink
    "#84cc16",  # lime
]


@dataclass(kw_only=True)
class CustomerLabel(Entity):
    """Etiqueta definida por el usuario para clasificar clientes.

    Reemplaza el enum CustomerType fijo por etiquetas configurables por
    cada operador. Un operador puede tener múltiples etiquetas con colores
    distintos (Residencial, Comercial, VIP, etc.).
    """

    tenant_id: TenantId
    owner_user_id: UUID
    name: str
    color: str = "#10b981"
    is_active: bool = True

    @classmethod
    def create(
        cls,
        *,
        tenant_id: TenantId,
        owner_user_id: UUID,
        name: str,
        color: str = "#10b981",
    ) -> "CustomerLabel":
        name = name.strip()
        if not name:
            raise BusinessRuleViolationError(
                "El nombre de la etiqueta no puede estar vacío"
            )
        if len(name) > 50:
            raise BusinessRuleViolationError(
                "El nombre de la etiqueta no puede superar los 50 caracteres"
            )
        if not _COLOR_RE.match(color):
            raise ValidationError(
                f"Color inválido: '{color}'. Usar formato hex #RRGGBB"
            )
        return cls(
            tenant_id=tenant_id,
            owner_user_id=owner_user_id,
            name=name,
            color=color,
        )

    def rename(self, new_name: str) -> None:
        new_name = new_name.strip()
        if not new_name:
            raise BusinessRuleViolationError(
                "El nombre de la etiqueta no puede estar vacío"
            )
        if len(new_name) > 50:
            raise BusinessRuleViolationError(
                "El nombre de la etiqueta no puede superar los 50 caracteres"
            )
        self.name = new_name

    def change_color(self, new_color: str) -> None:
        if not _COLOR_RE.match(new_color):
            raise ValidationError(
                f"Color inválido: '{new_color}'. Usar formato hex #RRGGBB"
            )
        self.color = new_color

    def deactivate(self) -> None:
        if not self.is_active:
            raise BusinessRuleViolationError("La etiqueta ya está inactiva")
        self.is_active = False


@dataclass(kw_only=True)
class Customer(Entity):
    """Cliente perteneciente a un usuario operativo."""

    tenant_id: TenantId
    owner_user_id: UUID
    name: str
    email: Email | None = None
    phone: str | None = None
    address: str | None = None  # Calle y número
    city: str | None = None
    province: str | None = None
    neighborhood: str | None = None  # Barrio / Localidad
    postal_code: str | None = None
    label_id: UUID | None = None
    notes: str | None = None
    is_active: bool = True

    @classmethod
    def create(
        cls,
        *,
        tenant_id: TenantId,
        owner_user_id: UUID,
        name: str,
        email: str | None = None,
        phone: str | None = None,
        address: str | None = None,
        city: str | None = None,
        province: str | None = None,
        neighborhood: str | None = None,
        postal_code: str | None = None,
        label_id: UUID | None = None,
        notes: str | None = None,
    ) -> "Customer":
        name = name.strip()
        if not name:
            raise BusinessRuleViolationError(
                "El nombre del cliente no puede estar vacío"
            )
        if len(name) > 200:
            raise BusinessRuleViolationError(
                "El nombre del cliente no puede superar los 200 caracteres"
            )
        return cls(
            tenant_id=tenant_id,
            owner_user_id=owner_user_id,
            name=name,
            email=Email(email) if email else None,
            phone=phone.strip() or None if phone else None,
            address=address.strip() or None if address else None,
            city=city.strip() or None if city else None,
            province=province.strip() or None if province else None,
            neighborhood=neighborhood.strip() or None if neighborhood else None,
            postal_code=postal_code.strip() or None if postal_code else None,
            label_id=label_id,
            notes=notes.strip() or None if notes else None,
        )

    def update(
        self,
        *,
        name: str | None = None,
        email: str | None = None,
        phone: str | None = None,
        address: str | None = None,
        city: str | None = None,
        province: str | None = None,
        neighborhood: str | None = None,
        postal_code: str | None = None,
        label_id: UUID | None = None,
        clear_label: bool = False,
        notes: str | None = None,
    ) -> None:
        if name is not None:
            name = name.strip()
            if not name:
                raise BusinessRuleViolationError(
                    "El nombre del cliente no puede estar vacío"
                )
            if len(name) > 200:
                raise BusinessRuleViolationError(
                    "El nombre del cliente no puede superar los 200 caracteres"
                )
            self.name = name
        if email is not None:
            self.email = Email(email) if email else None
        if phone is not None:
            self.phone = phone.strip() or None
        if address is not None:
            self.address = address.strip() or None
        if city is not None:
            self.city = city.strip() or None
        if province is not None:
            self.province = province.strip() or None
        if neighborhood is not None:
            self.neighborhood = neighborhood.strip() or None
        if postal_code is not None:
            self.postal_code = postal_code.strip() or None
        if clear_label:
            self.label_id = None
        elif label_id is not None:
            self.label_id = label_id
        if notes is not None:
            self.notes = notes.strip() or None

    def deactivate(self) -> None:
        if not self.is_active:
            raise BusinessRuleViolationError("El cliente ya está inactivo")
        self.is_active = False

    def reactivate(self) -> None:
        if self.is_active:
            raise BusinessRuleViolationError("El cliente ya está activo")
        self.is_active = True
