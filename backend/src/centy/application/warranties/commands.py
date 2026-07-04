from dataclasses import dataclass
from uuid import UUID

from centy.domain.shared.value_objects import TenantId


@dataclass(frozen=True)
class GenerateWarrantiesCommand:
    quote_id: UUID
    tenant_id: TenantId
    requester_user_id: UUID
    requester_role: str


@dataclass(frozen=True)
class SendWarrantiesEmailCommand:
    quote_id: str
    sender_user_id: UUID
    tenant_id: str
    recipient_email: str
    recipient_name: str | None
    custom_message: str | None
    frontend_base_url: str
