from dataclasses import dataclass
from uuid import UUID

from centy.domain.shared.value_objects import TenantId


@dataclass(frozen=True)
class CreateCustomerCommand:
    tenant_id: TenantId
    owner_user_id: UUID
    name: str
    email: str | None = None
    phone: str | None = None
    address: str | None = None
    city: str | None = None
    province: str | None = None
    neighborhood: str | None = None
    postal_code: str | None = None
    label_id: UUID | None = None
    notes: str | None = None


@dataclass(frozen=True)
class UpdateCustomerCommand:
    customer_id: UUID
    tenant_id: TenantId
    requester_user_id: UUID
    requester_role: str
    name: str | None = None
    email: str | None = None
    phone: str | None = None
    address: str | None = None
    city: str | None = None
    province: str | None = None
    neighborhood: str | None = None
    postal_code: str | None = None
    label_id: UUID | None = None
    clear_label: bool = False
    notes: str | None = None
    is_active: bool | None = None


@dataclass(frozen=True)
class DeactivateCustomerCommand:
    customer_id: UUID
    tenant_id: TenantId
    requester_user_id: UUID
    requester_role: str


@dataclass(frozen=True)
class CreateCustomerLabelCommand:
    tenant_id: TenantId
    owner_user_id: UUID
    name: str
    color: str = "#10b981"


@dataclass(frozen=True)
class UpdateCustomerLabelCommand:
    label_id: UUID
    tenant_id: TenantId
    owner_user_id: UUID
    name: str | None = None
    color: str | None = None


@dataclass(frozen=True)
class DeleteCustomerLabelCommand:
    label_id: UUID
    tenant_id: TenantId
    owner_user_id: UUID
