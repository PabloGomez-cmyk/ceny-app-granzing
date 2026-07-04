from dataclasses import dataclass
from uuid import UUID

from centy.domain.shared.value_objects import TenantId


@dataclass(frozen=True)
class GetWarrantyQuery:
    warranty_id: UUID
    tenant_id: TenantId
    requester_user_id: UUID
    requester_role: str


@dataclass(frozen=True)
class ListWarrantiesQuery:
    tenant_id: TenantId
    requester_user_id: UUID
    requester_role: str


@dataclass(frozen=True)
class ListWarrantiesByQuoteQuery:
    quote_id: UUID
    tenant_id: TenantId
    requester_user_id: UUID
    requester_role: str
