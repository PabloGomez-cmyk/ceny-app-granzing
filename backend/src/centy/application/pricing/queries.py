from dataclasses import dataclass
from uuid import UUID

from centy.domain.shared.value_objects import TenantId


@dataclass(frozen=True)
class GetEffectivePriceListQuery:
    tenant_id: TenantId
    requester_user_id: UUID
    requester_role: str
    user_id: UUID
