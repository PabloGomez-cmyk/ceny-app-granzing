from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from centy.application.ports.email import (
    EmailMessage,
    IEmailConfigRepository,
    IEmailSender,
    IGmailOAuthService,
)
from centy.application.ports.repositories import (
    IQuoteRepository,
    IUserRepository,
    IWarrantyRepository,
)
from centy.application.ports.unit_of_work import IUnitOfWork
from centy.application.warranties.commands import (
    GenerateWarrantiesCommand,
    SendWarrantiesEmailCommand,
)
from centy.application.warranties.queries import (
    GetWarrantyQuery,
    ListWarrantiesByQuoteQuery,
    ListWarrantiesQuery,
)
from centy.domain.quotes.value_objects import QuoteStatus
from centy.domain.shared.exceptions import (
    AuthorizationError,
    BusinessRuleViolationError,
    NotFoundError,
)
from centy.domain.shared.value_objects import TenantId
from centy.domain.warranties.entities import Warranty

# ── Result dataclasses ────────────────────────────────────────────────────────


@dataclass(frozen=True)
class WarrantyResult:
    warranty_id: str
    tenant_id: str
    quote_id: str
    quote_line_id: str
    product_id: str
    product_snapshot: dict[str, Any]
    warranty_number: str
    customer_snapshot: dict[str, Any] | None
    created_by_user_id: str
    warranty_years: int
    expires_at: str
    is_valid: bool
    sent_at: str | None
    created_at: str


def _warranty_result(w: Warranty) -> WarrantyResult:
    return WarrantyResult(
        warranty_id=str(w.id),
        tenant_id=str(w.tenant_id),
        quote_id=str(w.quote_id),
        quote_line_id=str(w.quote_line_id),
        product_id=str(w.product_id),
        product_snapshot=w.product_snapshot,
        warranty_number=w.warranty_number,
        customer_snapshot=w.customer_snapshot,
        created_by_user_id=str(w.created_by_user_id),
        warranty_years=w.warranty_years,
        expires_at=w.expires_at.isoformat(),
        is_valid=w.is_valid,
        sent_at=w.sent_at.isoformat() if w.sent_at else None,
        created_at=w.created_at.isoformat(),
    )


def _can_access(warranty: Warranty, user_id: UUID, role: str) -> bool:
    return role == "ADMIN" or warranty.created_by_user_id == user_id


def _build_warranty_number(seq: int) -> str:
    return f"G-{seq:04d}"


# ── Handlers ──────────────────────────────────────────────────────────────────


class GenerateWarrantiesHandler:
    def __init__(self, uow: IUnitOfWork) -> None:
        self._uow = uow

    async def handle(self, command: GenerateWarrantiesCommand) -> list[WarrantyResult]:
        async with self._uow as uow:
            quote = await uow.quotes.get_by_id(command.quote_id, command.tenant_id)
            if quote is None:
                raise NotFoundError(f"Presupuesto {command.quote_id} no encontrado")
            if (
                quote.created_by_user_id != command.requester_user_id
                and command.requester_role != "ADMIN"
            ):
                raise AuthorizationError(
                    "No tiene permiso para generar garantías de esta venta"
                )
            if quote.status != QuoteStatus.COMPLETED:
                raise BusinessRuleViolationError(
                    "Solo se pueden generar garantías de ventas terminadas"
                )

            existing = await uow.warranties.list_by_quote(quote.id, command.tenant_id)
            if existing:
                raise BusinessRuleViolationError(
                    "Las garantías de esta venta ya fueron generadas"
                )

            warranties: list[Warranty] = []
            for line in quote.lines:
                product = await uow.products.get_by_id(
                    line.product_id, command.tenant_id
                )
                if product is None:
                    raise BusinessRuleViolationError(
                        f"El producto {line.product_id} de la línea ya no existe en el catálogo"
                    )
                brand = await uow.brands.get_by_id(product.brand_id, command.tenant_id)

                seq = await uow.warranties.next_sequence(command.tenant_id)
                warranty = Warranty.create(
                    tenant_id=command.tenant_id,
                    quote_id=quote.id,
                    quote_line_id=line.line_id,
                    product_id=product.id,
                    product_snapshot={
                        "name": product.name,
                        "brand_name": brand.name if brand else "",
                        "uv_pct": str(product.uv_percentage.value),
                        "irr_pct": str(product.irr_percentage.value),
                        "tser_pct": str(product.tser_percentage.value),
                    },
                    warranty_number=_build_warranty_number(seq),
                    customer_snapshot=quote.customer_snapshot,
                    created_by_user_id=quote.created_by_user_id,
                    warranty_years=product.warranty_years,
                )
                await uow.warranties.save(warranty)
                warranties.append(warranty)

            await uow.commit()

        return [_warranty_result(w) for w in warranties]


class ListWarrantiesHandler:
    def __init__(self, repo: IWarrantyRepository) -> None:
        self._repo = repo

    async def handle(self, query: ListWarrantiesQuery) -> list[WarrantyResult]:
        if query.requester_role == "ADMIN":
            warranties = await self._repo.list_by_tenant(query.tenant_id)
        else:
            warranties = await self._repo.list_by_user(
                query.requester_user_id, query.tenant_id
            )
        return [_warranty_result(w) for w in warranties]


class ListWarrantiesByQuoteHandler:
    def __init__(self, repo: IWarrantyRepository) -> None:
        self._repo = repo

    async def handle(self, query: ListWarrantiesByQuoteQuery) -> list[WarrantyResult]:
        warranties = await self._repo.list_by_quote(query.quote_id, query.tenant_id)
        visible = [
            w
            for w in warranties
            if _can_access(w, query.requester_user_id, query.requester_role)
        ]
        return [_warranty_result(w) for w in visible]


class GetWarrantyHandler:
    def __init__(self, repo: IWarrantyRepository) -> None:
        self._repo = repo

    async def handle(self, query: GetWarrantyQuery) -> WarrantyResult:
        warranty = await self._repo.get_by_id(query.warranty_id, query.tenant_id)
        if warranty is None:
            raise NotFoundError(f"Garantía {query.warranty_id} no encontrada")
        if not _can_access(warranty, query.requester_user_id, query.requester_role):
            raise AuthorizationError("No tiene permiso para ver esta garantía")
        return _warranty_result(warranty)


class SendWarrantiesEmailHandler:
    def __init__(
        self,
        oauth: IGmailOAuthService,
        email_config_repo: IEmailConfigRepository,
        sender: IEmailSender,
        quote_repo: IQuoteRepository,
        warranty_repo: IWarrantyRepository,
        user_repo: IUserRepository,
    ) -> None:
        self._oauth = oauth
        self._email_config_repo = email_config_repo
        self._sender = sender
        self._quote_repo = quote_repo
        self._warranty_repo = warranty_repo
        self._user_repo = user_repo

    async def handle(self, cmd: SendWarrantiesEmailCommand) -> None:
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

        warranties = await self._warranty_repo.list_by_quote(quote.id, tenant_id)
        if not warranties:
            raise BusinessRuleViolationError(
                "Esta venta todavía no tiene garantías generadas"
            )

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

        html_body = _build_warranty_html(
            warranties=warranties,
            quote_number=quote.quote_number,
            recipient_name=recipient,
            from_company=from_name or "Glazing",
            custom_message=cmd.custom_message,
        )

        await self._sender.send(
            config=fresh_config,
            message=EmailMessage(
                to=cmd.recipient_email,
                subject=f"Garantía oficial - Presupuesto #{quote.quote_number} - {from_name or 'Glazing'}",
                html_body=html_body,
                from_name=from_name,
            ),
        )

        now = datetime.now(UTC)
        for w in warranties:
            w.sent_at = now
            await self._warranty_repo.save(w)


def _build_warranty_html(
    warranties: list[Warranty],
    quote_number: str,
    recipient_name: str,
    from_company: str,
    custom_message: str | None,
) -> str:
    custom_block = (
        f'<p style="margin:0 0 16px;color:#374151;font-size:14px;">{custom_message}</p>'
        if custom_message
        else ""
    )

    product_blocks = ""
    for w in warranties:
        snap = w.product_snapshot
        product_blocks += f"""
        <div style="background:#f8fafc;border:1px solid #e2e6f0;border-radius:10px;padding:20px;margin-bottom:16px">
          <p style="margin:0 0 8px;font-size:11px;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:.5px">📋 Datos de la garantía · {w.warranty_number}</p>
          <p style="margin:0 0 4px;font-size:16px;font-weight:bold;color:#0f172a">{snap.get("name", "")} <span style="font-weight:400;color:#64748b">{snap.get("brand_name", "")}</span></p>
          <p style="margin:0 0 10px;font-size:13px;color:#475569">Tiempo de garantía: <strong>{w.warranty_years} años</strong> · Vence: <strong>{w.expires_at.isoformat()}</strong></p>
          <div style="display:flex;gap:16px;font-size:12px;color:#475569">
            <span>UV: <strong style="color:#0f6e50">{snap.get("uv_pct", "-")}%</strong></span>
            <span>IRR: <strong style="color:#0f6e50">{snap.get("irr_pct", "-")}%</strong></span>
            <span>Rechazo Solar: <strong style="color:#0f6e50">{snap.get("tser_pct", "-")}%</strong></span>
          </div>
        </div>"""

    return f"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Garantía oficial - Presupuesto #{quote_number}</title>
</head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:Arial,Helvetica,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:40px auto;background:#fff;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.08);overflow:hidden">
    <tr>
      <td style="background:#0f6e50;padding:28px 32px">
        <p style="margin:0;font-size:22px;font-weight:bold;color:#fff">{from_company}</p>
        <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,.75)">Garantía oficial</p>
      </td>
    </tr>
    <tr>
      <td style="padding:32px">
        <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:14px 16px;margin-bottom:24px">
          <p style="margin:0;font-size:13px;color:#047857;font-weight:600">✓ Instalación completada con éxito</p>
          <p style="margin:4px 0 0;font-size:12px;color:#059669">Su garantía oficial ha sido emitida para el presupuesto #{quote_number}</p>
        </div>
        <p style="margin:0 0 8px;font-size:13px;color:#6b7280">Estimado/a</p>
        <p style="margin:0 0 24px;font-size:18px;font-weight:bold;color:#0f172a">{recipient_name},</p>
        {custom_block}
        <p style="margin:0 0 24px;color:#374151;font-size:14px">
          Es un placer informarle que la instalación correspondiente al presupuesto <strong>#{quote_number}</strong> ha sido completada con éxito.
          A continuación, entregamos la <strong>garantía oficial</strong> que cubre cada lámina instalada contra cualquier defecto de fabricación o falla en la adherencia durante el período adquirido.
        </p>
        {product_blocks}
        <p style="margin:24px 0 8px;font-size:13px;font-weight:700;color:#0f172a">✅ Cobertura de garantía</p>
        <p style="margin:0 0 20px;font-size:13px;color:#475569">
          La garantía cubre defectos de fabricación, despegamiento, burbujas o cambios de coloración provocados por el material. Queda excluido de cobertura cualquier daño ocasionado por mal uso, limpieza inadecuada, golpes o intervención de terceros no autorizados por {from_company}.
        </p>
        <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#0f172a">🧴 Instrucciones de cuidado</p>
        <ul style="margin:0 0 24px;padding-left:18px;font-size:13px;color:#475569">
          <li>Para conservar la lámina en óptimas condiciones, evite limpiar los vidrios durante las primeras 30 días luego de la instalación.</li>
          <li>Use paños suaves y productos de limpieza sin amoníaco ni abrasivos.</li>
          <li>No coloque adhesivos, stickers ni elementos que puedan desprender la lámina.</li>
        </ul>
        <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#0f172a">📞 Contacto para reclamos</p>
        <p style="margin:0;font-size:13px;color:#475569">
          En caso de necesitar hacer uso de su garantía o ante cualquier consulta, comuníquese con nuestro equipo. Estamos encantados de brindarle la atención que se merece.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 32px;border-top:1px solid #f1f5f9">
        <p style="margin:0;font-size:12px;color:#94a3b8">
          Documento oficial emitido por {from_company} a través de Glazing Platform.
          Si recibiste este mensaje por error, podés ignorarlo.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>"""
