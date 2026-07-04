from dataclasses import dataclass
from uuid import UUID

from centy.domain.shared.value_objects import TenantId


@dataclass(frozen=True)
class GetQuoteQuery:
    quote_id: UUID
    tenant_id: TenantId
    requester_user_id: UUID
    requester_role: str


@dataclass(frozen=True)
class ListQuotesQuery:
    tenant_id: TenantId
    requester_user_id: UUID
    requester_role: str


@dataclass(frozen=True)
class GetQuoteStatsQuery:
    tenant_id: TenantId
