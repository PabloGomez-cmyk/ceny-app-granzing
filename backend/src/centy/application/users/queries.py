from dataclasses import dataclass
from uuid import UUID

from centy.domain.shared.value_objects import TenantId


@dataclass(frozen=True)
class GetUserByIdQuery:
    user_id: UUID
    tenant_id: TenantId


@dataclass(frozen=True)
class ListUsersQuery:
    tenant_id: TenantId
