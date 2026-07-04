from dataclasses import dataclass
from uuid import UUID

from centy.domain.shared.value_objects import TenantId
from centy.domain.users.entities import Role


@dataclass(frozen=True)
class CreateUserCommand:
    tenant_id: TenantId
    email: str
    password: str
    full_name: str
    role: Role


@dataclass(frozen=True)
class DeactivateUserCommand:
    user_id: UUID
    tenant_id: TenantId


@dataclass(frozen=True)
class ReactivateUserCommand:
    user_id: UUID
    tenant_id: TenantId


@dataclass(frozen=True)
class AssignRoleCommand:
    user_id: UUID
    tenant_id: TenantId
    new_role: Role


@dataclass(frozen=True)
class UpdateUserCommand:
    user_id: UUID
    tenant_id: TenantId
    email: str | None = None
    full_name: str | None = None
    role: Role | None = None
    is_active: bool | None = None
    password: str | None = None
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
