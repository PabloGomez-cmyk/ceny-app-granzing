from dataclasses import dataclass
from enum import StrEnum

from centy.domain.shared.entity import Entity
from centy.domain.shared.exceptions import BusinessRuleViolationError
from centy.domain.shared.value_objects import Email, TenantId
from centy.domain.users.value_objects import HashedPassword


class Role(StrEnum):
    ADMIN = "ADMIN"
    OPERATOR = "OPERATOR"


@dataclass(kw_only=True)
class User(Entity):
    tenant_id: TenantId
    email: Email
    hashed_password: HashedPassword
    full_name: str
    role: Role
    is_active: bool = True
    company_name: str | None = None
    company_logo_url: str | None = None
    company_street: str | None = None
    company_city: str | None = None
    company_province: str | None = None
    company_postal_code: str | None = None
    company_cuit: str | None = None
    company_color_primary: str | None = None
    company_color_secondary: str | None = None
    default_commercial_conditions: str | None = None

    @classmethod
    def create(
        cls,
        tenant_id: TenantId,
        email: Email,
        hashed_password: HashedPassword,
        full_name: str,
        role: Role,
    ) -> "User":
        if not full_name.strip():
            raise BusinessRuleViolationError("El nombre completo no puede estar vacío")
        return cls(
            tenant_id=tenant_id,
            email=email,
            hashed_password=hashed_password,
            full_name=full_name.strip(),
            role=role,
        )

    def update_profile(
        self,
        *,
        full_name: str | None = None,
        company_name: str | None = None,
        company_logo_url: str | None = None,
        company_street: str | None = None,
        company_city: str | None = None,
        company_province: str | None = None,
        company_postal_code: str | None = None,
        company_cuit: str | None = None,
        company_color_primary: str | None = None,
        company_color_secondary: str | None = None,
        default_commercial_conditions: str | None = None,
    ) -> None:
        if full_name is not None:
            if not full_name.strip():
                raise BusinessRuleViolationError(
                    "El nombre completo no puede estar vacío"
                )
            self.full_name = full_name.strip()
        if company_name is not None:
            self.company_name = company_name or None
        if company_logo_url is not None:
            self.company_logo_url = company_logo_url or None
        if company_street is not None:
            self.company_street = company_street or None
        if company_city is not None:
            self.company_city = company_city or None
        if company_province is not None:
            self.company_province = company_province or None
        if company_postal_code is not None:
            self.company_postal_code = company_postal_code or None
        if company_cuit is not None:
            self.company_cuit = company_cuit or None
        if company_color_primary is not None:
            self.company_color_primary = company_color_primary or None
        if company_color_secondary is not None:
            self.company_color_secondary = company_color_secondary or None
        if default_commercial_conditions is not None:
            self.default_commercial_conditions = default_commercial_conditions or None

    def deactivate(self) -> None:
        if not self.is_active:
            raise BusinessRuleViolationError("El usuario ya está inactivo")
        self.is_active = False

    def reactivate(self) -> None:
        if self.is_active:
            raise BusinessRuleViolationError("El usuario ya está activo")
        self.is_active = True

    def assign_role(self, new_role: Role) -> None:
        self.role = new_role

    def change_password(self, new_hashed_password: HashedPassword) -> None:
        self.hashed_password = new_hashed_password

    def is_admin(self) -> bool:
        return self.role == Role.ADMIN

    def is_operator(self) -> bool:
        return self.role == Role.OPERATOR
