from dataclasses import dataclass, field
from datetime import UTC, datetime
from uuid import UUID

from centy.domain.users.value_objects import UserId


@dataclass(frozen=True)
class UserCreated:
    user_id: UserId
    tenant_id: UUID
    email: str
    role: str
    occurred_at: datetime = field(default_factory=lambda: datetime.now(UTC))


@dataclass(frozen=True)
class UserDeactivated:
    user_id: UserId
    tenant_id: UUID
    occurred_at: datetime = field(default_factory=lambda: datetime.now(UTC))


@dataclass(frozen=True)
class UserRoleAssigned:
    user_id: UserId
    tenant_id: UUID
    new_role: str
    occurred_at: datetime = field(default_factory=lambda: datetime.now(UTC))
