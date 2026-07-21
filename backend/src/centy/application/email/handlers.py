from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID

from centy.application.email.commands import (
    ConnectGmailCommand,
    DisconnectGmailCommand,
    GetGmailAuthUrlCommand,
    SendQuoteEmailCommand,
)
from centy.application.ports.email import (
    EmailMessage,
    IEmailConfigRepository,
    IEmailSender,
    IGmailOAuthService,
    UserEmailConfig,
)
from centy.application.ports.repositories import IQuoteRepository, IUserRepository
from centy.domain.shared.exceptions import BusinessRuleViolationError, NotFoundError
from centy.domain.shared.value_objects import TenantId


@dataclass(frozen=True)
class GmailStatusResult:
    connected: bool
    gmail_email: str | None


@dataclass(frozen=True)
class GmailAuthUrlResult:
    url: str


class GetGmailAuthUrlHandler:
    def __init__(self, oauth: IGmailOAuthService) -> None:
        self._oauth = oauth

    def handle(self, cmd: GetGmailAuthUrlCommand) -> GmailAuthUrlResult:
        url = self._oauth.get_auth_url(cmd.redirect_uri)
        return GmailAuthUrlResult(url=url)


class GetGmailStatusHandler:
    def __init__(self, repo: IEmailConfigRepository) -> None:
        self._repo = repo

    async def handle(self, user_id: UUID, tenant_id: str) -> GmailStatusResult:
        config = await self._repo.get_by_user_id(user_id, tenant_id)
        if config is None:
            return GmailStatusResult(connected=False, gmail_email=None)
        return GmailStatusResult(connected=True, gmail_email=config.gmail_email)


class ConnectGmailHandler:
    def __init__(self, oauth: IGmailOAuthService, repo: IEmailConfigRepository) -> None:
        self._oauth = oauth
        self._repo = repo

    async def handle(self, cmd: ConnectGmailCommand) -> GmailStatusResult:
        tokens = await self._oauth.exchange_code(
            cmd.authorization_code, cmd.redirect_uri
        )
        now = datetime.now(tz=UTC)
        config = UserEmailConfig(
            user_id=cmd.user_id,
            tenant_id=cmd.tenant_id,
            gmail_email=tokens.gmail_email,
            access_token=tokens.access_token,
            refresh_token=tokens.refresh_token,
            token_expiry=tokens.token_expiry,
            created_at=now,
            updated_at=now,
        )
        await self._repo.save(config)
        return GmailStatusResult(connected=True, gmail_email=tokens.gmail_email)


class DisconnectGmailHandler:
    def __init__(self, repo: IEmailConfigRepository) -> None:
        self._repo = repo

    async def handle(self, cmd: DisconnectGmailCommand) -> None:
        await self._repo.delete(cmd.user_id, cmd.tenant_id)


class SendQuoteEmailHandler:
    def __init__(
        self,
        oauth: IGmailOAuthService,
        email_config_repo: IEmailConfigRepository,
        sender: IEmailSender,
        quote_repo: IQuoteRepository,
        user_repo: IUserRepository,
    ) -> None:
        self._oauth = oauth
        self._email_config_repo = email_config_repo
        self._sender = sender
        self._quote_repo = quote_repo
        self._user_repo = user_repo

    async def handle(self, cmd: SendQuoteEmailCommand) -> None:
        tenant_id = TenantId(UUID(cmd.tenant_id))

        config = await self._email_config_repo.get_by_user_id(
            cmd.sender_user_id, cmd.tenant_id
        )
        if config is None:
            raise BusinessRuleViolationError(
                "No tenés Gmail configurado. Configuralo en Ajustes → Correo."
            )

        quote = await self._quote_repo.get_by_id(UUID(cmd.quote_id), tenant_id)
        if quote is None:
            raise NotFoundError(f"Presupuesto {cmd.quote_id} no encontrado")

        sender_user = await self._user_repo.get_by_id(cmd.sender_user_id, tenant_id)
        from_name: str | None = None
        if sender_user:
            from_name = sender_user.company_name or sender_user.full_name

        fresh_config = await self._oauth.refresh_if_needed(config)
        if fresh_config.access_token != config.access_token:
            await self._email_config_repo.save(fresh_config)

        customer_name = (
            quote.customer_snapshot.get("name", "Cliente")
            if quote.customer_snapshot
            else "Cliente"
        )
        recipient = cmd.recipient_name or customer_name
        total_str = f"${quote.totals.total:,.2f}" if hasattr(quote, "totals") else ""

        html_body = _build_quote_html(
            quote_number=quote.quote_number,
            customer_name=customer_name,
            recipient_name=recipient,
            total=total_str,
            from_company=from_name or "Glazing",
            custom_message=cmd.custom_message,
            has_pdf=cmd.pdf_base64 is not None,
        )

        await self._sender.send(
            config=fresh_config,
            message=EmailMessage(
                to=cmd.recipient_email,
                subject=f"Presupuesto #{quote.quote_number} - {from_name or 'Glazing'}",
                html_body=html_body,
                from_name=from_name,
                attachment_pdf_base64=cmd.pdf_base64,
                attachment_filename=f"{quote.quote_number}.pdf",
            ),
        )

        # Avanzar estado a SENT si estaba en DRAFT
        if quote.status.value == "DRAFT":
            quote.submit()
            await self._quote_repo.save(quote)


def _build_quote_html(
    quote_number: str,
    customer_name: str,
    recipient_name: str,
    total: str,
    from_company: str,
    custom_message: str | None,
    has_pdf: bool,
) -> str:
    custom_block = (
        f'<p style="margin:0 0 16px;color:#374151;font-size:14px;">{custom_message}</p>'
        if custom_message
        else ""
    )
    pdf_note = (
        '<p style="margin:0;color:#374151;font-size:14px">'
        "Encontrás el detalle completo en el <strong>PDF adjunto</strong> a este correo."
        "</p>"
        if has_pdf
        else ""
    )
    return f"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Presupuesto #{quote_number}</title>
</head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:Arial,Helvetica,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:40px auto;background:#fff;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.08);overflow:hidden">
    <tr>
      <td style="background:#0f6e50;padding:28px 32px">
        <p style="margin:0;font-size:22px;font-weight:bold;color:#fff">{from_company}</p>
        <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,.75)">Plataforma de presupuestos</p>
      </td>
    </tr>
    <tr>
      <td style="padding:32px">
        <p style="margin:0 0 8px;font-size:13px;color:#6b7280">Estimado/a</p>
        <p style="margin:0 0 24px;font-size:18px;font-weight:bold;color:#0f172a">{recipient_name},</p>
        {custom_block}
        <p style="margin:0 0 24px;color:#374151;font-size:14px">
          Te enviamos el presupuesto <strong>#{quote_number}</strong>
          {f'con el total de <strong style="color:#0f6e50">{total}</strong>.' if total else "."}
        </p>
        {'<div style="background:#f8fafc;border:1px solid #e2e6f0;border-radius:10px;padding:20px;margin-bottom:24px"><p style="margin:0 0 4px;font-size:12px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:.5px">Total del presupuesto</p><p style="margin:0;font-size:28px;font-weight:bold;color:#0f6e50">' + total + "</p></div>" if total else ""}
        {pdf_note}
      </td>
    </tr>
    <tr>
      <td style="padding:20px 32px;border-top:1px solid #f1f5f9">
        <p style="margin:0;font-size:12px;color:#94a3b8">
          Este presupuesto fue enviado por {from_company} a través de Glazing Platform.
          Si recibiste este mensaje por error, podés ignorarlo.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>"""
