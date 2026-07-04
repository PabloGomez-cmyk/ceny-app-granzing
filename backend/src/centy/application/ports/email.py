from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from uuid import UUID


@dataclass
class UserEmailConfig:
    user_id: UUID
    tenant_id: str
    gmail_email: str
    access_token: str  # plain text — encryption vive en la infra
    refresh_token: str  # plain text — encryption vive en la infra
    token_expiry: datetime
    created_at: datetime
    updated_at: datetime


@dataclass(frozen=True)
class OAuthTokens:
    access_token: str
    refresh_token: str
    gmail_email: str
    token_expiry: datetime


@dataclass(frozen=True)
class EmailMessage:
    to: str
    subject: str
    html_body: str
    from_name: str | None = None
    attachment_pdf_base64: str | None = None  # PDF adjunto codificado en base64
    attachment_filename: str | None = None  # Nombre del archivo adjunto


class IEmailSender(ABC):
    @abstractmethod
    async def send(self, *, config: UserEmailConfig, message: EmailMessage) -> None:
        """Envía un email usando las credenciales OAuth2 del usuario."""
        ...


class IGmailOAuthService(ABC):
    @abstractmethod
    def get_auth_url(self, redirect_uri: str) -> str:
        """Genera la URL de autorización OAuth2 de Google."""
        ...

    @abstractmethod
    async def exchange_code(self, code: str, redirect_uri: str) -> OAuthTokens:
        """Intercambia el authorization code por tokens OAuth2."""
        ...

    @abstractmethod
    async def refresh_if_needed(self, config: UserEmailConfig) -> UserEmailConfig:
        """Refresca el access token si está expirado. Retorna config actualizada."""
        ...


class IEmailConfigRepository(ABC):
    @abstractmethod
    async def get_by_user_id(
        self, user_id: UUID, tenant_id: str
    ) -> UserEmailConfig | None:
        """Retorna la config de Gmail del usuario o None si no configuró."""
        ...

    @abstractmethod
    async def save(self, config: UserEmailConfig) -> None:
        """Crea o actualiza la config Gmail del usuario."""
        ...

    @abstractmethod
    async def delete(self, user_id: UUID, tenant_id: str) -> None:
        """Elimina la config Gmail del usuario (disconnect)."""
        ...

    @abstractmethod
    async def get_admin_config(self, tenant_id: str) -> UserEmailConfig | None:
        """Retorna la config Gmail del primer Admin activo del tenant, para emails internos."""
        ...

    @abstractmethod
    async def get_any_for_tenant(self, tenant_id: str) -> UserEmailConfig | None:
        """Fallback: retorna cualquier config Gmail activa del tenant."""
        ...
