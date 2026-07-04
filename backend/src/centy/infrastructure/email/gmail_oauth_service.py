import base64
import json
import urllib.parse
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx

from centy.application.ports.email import (
    IGmailOAuthService,
    OAuthTokens,
    UserEmailConfig,
)
from centy.domain.shared.exceptions import BusinessRuleViolationError

SCOPES = [
    "https://www.googleapis.com/auth/gmail.send",
    "openid",
    "email",
]

_GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
_GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"


class GmailOAuthService(IGmailOAuthService):
    def __init__(self, client_id: str, client_secret: str) -> None:
        self._client_id = client_id
        self._client_secret = client_secret

    def get_auth_url(self, redirect_uri: str) -> str:
        params: dict[str, str] = {
            "client_id": self._client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": " ".join(SCOPES),
            "access_type": "offline",
            "prompt": "consent",  # fuerza refresh_token en cada autorización
            "include_granted_scopes": "true",
        }
        return f"{_GOOGLE_AUTH_URL}?{urllib.parse.urlencode(params)}"

    async def exchange_code(self, code: str, redirect_uri: str) -> OAuthTokens:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                _GOOGLE_TOKEN_URL,
                data={
                    "client_id": self._client_id,
                    "client_secret": self._client_secret,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": redirect_uri,
                },
            )

        if response.status_code != 200:
            body = response.json()
            raise BusinessRuleViolationError(
                f"Error al conectar Gmail: {body.get('error_description') or body.get('error')}"
            )

        tokens: dict[str, Any] = response.json()

        gmail_email = _extract_email_from_id_token(tokens.get("id_token", ""))
        if not gmail_email:
            raise BusinessRuleViolationError(
                "No se pudo obtener el email de la cuenta de Gmail. "
                "Asegurate de autorizar el scope 'email'."
            )

        expires_in: int = tokens.get("expires_in", 3600)
        expiry = datetime.now(tz=UTC) + timedelta(seconds=expires_in)

        return OAuthTokens(
            access_token=tokens["access_token"],
            refresh_token=tokens.get("refresh_token", ""),
            gmail_email=gmail_email,
            token_expiry=expiry,
        )

    async def refresh_if_needed(self, config: UserEmailConfig) -> UserEmailConfig:
        now = datetime.now(tz=UTC)
        expiry = config.token_expiry
        if expiry.tzinfo is None:
            expiry = expiry.replace(tzinfo=UTC)

        if expiry > now:
            return config

        async with httpx.AsyncClient() as client:
            response = await client.post(
                _GOOGLE_TOKEN_URL,
                data={
                    "client_id": self._client_id,
                    "client_secret": self._client_secret,
                    "refresh_token": config.refresh_token,
                    "grant_type": "refresh_token",
                },
            )

        if response.status_code != 200:
            body = response.json()
            raise BusinessRuleViolationError(
                "El token de Gmail expiró y no puede renovarse. "
                "Reconectá tu cuenta en Ajustes → Correo. "
                f"({body.get('error_description') or body.get('error')})"
            )

        tokens: dict[str, Any] = response.json()
        expires_in = tokens.get("expires_in", 3600)
        new_expiry = datetime.now(tz=UTC) + timedelta(seconds=expires_in)

        return UserEmailConfig(
            user_id=config.user_id,
            tenant_id=config.tenant_id,
            gmail_email=config.gmail_email,
            access_token=tokens["access_token"],
            refresh_token=config.refresh_token,  # Google no rota el refresh token
            token_expiry=new_expiry,
            created_at=config.created_at,
            updated_at=datetime.now(tz=UTC),
        )


def _extract_email_from_id_token(id_token: str) -> str:
    """Decodifica el payload del JWT sin verificar firma (solo para leer el email)."""
    if not id_token:
        return ""
    try:
        parts = id_token.split(".")
        if len(parts) < 2:
            return ""
        payload = parts[1]
        # Base64url → base64 estándar con padding
        payload += "=" * (4 - len(payload) % 4)
        data = json.loads(base64.urlsafe_b64decode(payload))
        return data.get("email", "")
    except Exception:
        return ""
