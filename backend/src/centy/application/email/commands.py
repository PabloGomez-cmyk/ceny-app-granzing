from dataclasses import dataclass
from uuid import UUID


@dataclass(frozen=True)
class GetGmailAuthUrlCommand:
    redirect_uri: str


@dataclass(frozen=True)
class ConnectGmailCommand:
    user_id: UUID
    tenant_id: str
    authorization_code: str
    redirect_uri: str


@dataclass(frozen=True)
class DisconnectGmailCommand:
    user_id: UUID
    tenant_id: str


@dataclass(frozen=True)
class SendQuoteEmailCommand:
    quote_id: str
    sender_user_id: UUID
    tenant_id: str
    recipient_email: str
    recipient_name: str | None
    custom_message: str | None
    pdf_base64: str | None = None
