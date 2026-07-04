from dataclasses import dataclass
from uuid import UUID

from centy.domain.shared.value_objects import TenantId


@dataclass(frozen=True)
class GetCustomerQuery:
    customer_id: UUID
    tenant_id: TenantId
    requester_user_id: UUID
    requester_role: str


@dataclass(frozen=True)
class ListCustomersQuery:
    tenant_id: TenantId
    requester_user_id: UUID
    requester_role: str


@dataclass(frozen=True)
class ListCustomerLabelsQuery:
    tenant_id: TenantId
    owner_user_id: UUID
