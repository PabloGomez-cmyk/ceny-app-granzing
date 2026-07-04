import secrets
import uuid as _uuid_mod
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import UUID

from centy.application.ports.auth import IPasswordHasher
from centy.application.ports.email import (
    EmailMessage,
    IEmailConfigRepository,
    IEmailSender,
    IGmailOAuthService,
)
from centy.application.ports.repositories import (
    IPasswordResetTokenRepository,
    IUserRepository,
    PasswordResetToken,
)
from centy.domain.shared.exceptions import BusinessRuleViolationError, NotFoundError
from centy.domain.shared.value_objects import Email, TenantId
from centy.domain.users.value_objects import HashedPassword

_TOKEN_TTL_HOURS = 1


@dataclass(frozen=True)
class ForgotPasswordCommand:
    email: str
    tenant_id: str
    frontend_base_url: str


@dataclass(frozen=True)
class ResetPasswordCommand:
    token: str
    new_password: str


@dataclass(frozen=True)
class ValidateResetTokenResult:
    valid: bool
    email: str | None = None


class ForgotPasswordHandler:
    def __init__(
        self,
        user_repo: IUserRepository,
        token_repo: IPasswordResetTokenRepository,
        email_config_repo: IEmailConfigRepository,
        oauth: IGmailOAuthService,
        sender: IEmailSender,
    ) -> None:
        self._user_repo = user_repo
        self._token_repo = token_repo
        self._email_config_repo = email_config_repo
        self._oauth = oauth
        self._sender = sender

    async def handle(self, cmd: ForgotPasswordCommand) -> None:
        tenant_uuid: UUID = (
            UUID(cmd.tenant_id)
            if _is_uuid(cmd.tenant_id)
            else _uuid_mod.uuid5(_uuid_mod.NAMESPACE_DNS, cmd.tenant_id)
        )
        tenant_id = TenantId(tenant_uuid)
        tenant_id_str = str(tenant_uuid)

        user = await self._user_repo.get_by_email(Email(cmd.email), tenant_id)
        if user is None or not user.is_active:
            # No revelar si el email existe o no — respuesta silenciosa
            return

        token_str = secrets.token_urlsafe(48)
        now = datetime.now(tz=UTC)
        token = PasswordResetToken(
            token=token_str,
            user_id=user.id,
            tenant_id=tenant_id_str,  # UUID string, compatible con columna UUID
            expires_at=now + timedelta(hours=_TOKEN_TTL_HOURS),
            used_at=None,
            created_at=now,
        )
        await self._token_repo.save(token)

        # Primero intentar con el Gmail del admin; si no tiene, usar cualquier Gmail del tenant
        admin_config = await self._email_config_repo.get_admin_config(tenant_id_str)
        if admin_config is None:
            admin_config = await self._email_config_repo.get_any_for_tenant(
                tenant_id_str
            )
        if admin_config is None:
            # Ningún usuario del tenant tiene Gmail configurado — imposible enviar
            return

        fresh_config = await self._oauth.refresh_if_needed(admin_config)
        if fresh_config.access_token != admin_config.access_token:
            await self._email_config_repo.save(fresh_config)

        reset_url = (
            f"{cmd.frontend_base_url.rstrip('/')}/reset-password?token={token_str}"
        )
        html_body = _build_reset_email_html(
            user_name=user.full_name,
            reset_url=reset_url,
            ttl_hours=_TOKEN_TTL_HOURS,
        )

        await self._sender.send(
            config=fresh_config,
            message=EmailMessage(
                to=cmd.email,
                subject="Recuperación de contraseña - Glazing Platform",
                html_body=html_body,
                from_name=user.company_name or "Glazing Platform",
            ),
        )


class ValidateResetTokenHandler:
    def __init__(
        self, token_repo: IPasswordResetTokenRepository, user_repo: IUserRepository
    ) -> None:
        self._token_repo = token_repo
        self._user_repo = user_repo

    async def handle(self, token_str: str) -> ValidateResetTokenResult:
        token = await self._token_repo.get(token_str)
        if token is None or token.used_at is not None:
            return ValidateResetTokenResult(valid=False)

        expires_at = token.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=UTC)
        if expires_at < datetime.now(tz=UTC):
            return ValidateResetTokenResult(valid=False)

        tid = TenantId(UUID(token.tenant_id))
        user = await self._user_repo.get_by_id(token.user_id, tid)
        email = str(user.email) if user else None
        return ValidateResetTokenResult(valid=True, email=email)


class ResetPasswordHandler:
    def __init__(
        self,
        token_repo: IPasswordResetTokenRepository,
        user_repo: IUserRepository,
        hasher: IPasswordHasher,
    ) -> None:
        self._token_repo = token_repo
        self._user_repo = user_repo
        self._hasher = hasher

    async def handle(self, cmd: ResetPasswordCommand) -> None:
        token = await self._token_repo.get(cmd.token)
        if token is None or token.used_at is not None:
            raise BusinessRuleViolationError(
                "El enlace es inválido o ya fue utilizado."
            )

        expires_at = token.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=UTC)
        if expires_at < datetime.now(tz=UTC):
            raise BusinessRuleViolationError("El enlace expiró. Solicitá uno nuevo.")

        if len(cmd.new_password) < 8:
            raise BusinessRuleViolationError(
                "La contraseña debe tener al menos 8 caracteres."
            )

        tenant_id = TenantId(UUID(token.tenant_id))
        user = await self._user_repo.get_by_id(token.user_id, tenant_id)
        if user is None or not user.is_active:
            raise NotFoundError("Usuario no encontrado.")

        new_hash = self._hasher.hash(cmd.new_password)
        user.hashed_password = HashedPassword(new_hash.value)
        await self._user_repo.save(user)
        await self._token_repo.mark_used(cmd.token)


def _is_uuid(value: str) -> bool:
    try:
        UUID(value)
        return True
    except ValueError:
        return False


def _build_reset_email_html(user_name: str, reset_url: str, ttl_hours: int) -> str:
    return f"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Recuperación de contraseña</title>
</head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:Arial,Helvetica,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:40px auto;background:#fff;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.08);overflow:hidden">
    <tr>
      <td style="background:#0f6e50;padding:28px 32px">
        <p style="margin:0;font-size:22px;font-weight:bold;color:#fff">Glazing Platform</p>
        <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,.75)">Recuperación de contraseña</p>
      </td>
    </tr>
    <tr>
      <td style="padding:32px">
        <p style="margin:0 0 8px;font-size:13px;color:#6b7280">Hola,</p>
        <p style="margin:0 0 24px;font-size:18px;font-weight:bold;color:#0f172a">{user_name}</p>
        <p style="margin:0 0 24px;color:#374151;font-size:14px">
          Recibimos una solicitud para restablecer la contraseña de tu cuenta.
          Hacé clic en el botón para crear una nueva contraseña.
        </p>
        <a href="{reset_url}" style="display:inline-block;background:#0f6e50;color:#fff;text-decoration:none;border-radius:8px;padding:12px 24px;font-size:14px;font-weight:600">
          Restablecer contraseña →
        </a>
        <p style="margin:24px 0 0;font-size:12px;color:#94a3b8">
          Este enlace expira en {ttl_hours} hora{"s" if ttl_hours != 1 else ""}.
          Si no solicitaste este cambio, podés ignorar este mensaje.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 32px;border-top:1px solid #f1f5f9">
        <p style="margin:0;font-size:12px;color:#94a3b8">
          Por seguridad, nunca compartás este enlace con nadie.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>"""
