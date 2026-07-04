from uuid import UUID

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession

from centy.application.email.commands import (
    ConnectGmailCommand,
    DisconnectGmailCommand,
    GetGmailAuthUrlCommand,
    SendQuoteEmailCommand,
)
from centy.application.email.handlers import (
    ConnectGmailHandler,
    DisconnectGmailHandler,
    GetGmailAuthUrlHandler,
    GetGmailStatusHandler,
    SendQuoteEmailHandler,
)
from centy.infrastructure.api.dependencies import (
    CurrentUser,
    get_connect_gmail_handler,
    get_current_user,
    get_disconnect_gmail_handler,
    get_gmail_auth_url_handler,
    get_gmail_status_handler,
    get_send_quote_email_handler,
    get_session,
)
from centy.infrastructure.config.settings import Settings, get_settings

router = APIRouter(tags=["gmail"])


# ── Request bodies ─────────────────────────────────────────────────────────────


class ConnectBody(BaseModel):
    code: str
    redirect_uri: str


class SendQuoteEmailBody(BaseModel):
    recipient_email: EmailStr
    recipient_name: str | None = None
    custom_message: str | None = None
    pdf_base64: str | None = None


# ── Settings / Gmail endpoints ─────────────────────────────────────────────────


@router.get("/settings/gmail/status")
async def get_gmail_status(
    current_user: CurrentUser = Depends(get_current_user),
    handler: GetGmailStatusHandler = Depends(get_gmail_status_handler),
) -> dict:
    result = await handler.handle(
        user_id=UUID(current_user.user_id),
        tenant_id=current_user.tenant_id,
    )
    return {"connected": result.connected, "gmail_email": result.gmail_email}


@router.get("/settings/gmail/auth-url")
async def get_gmail_auth_url(
    redirect_uri: str,
    _: CurrentUser = Depends(get_current_user),
    handler: GetGmailAuthUrlHandler = Depends(get_gmail_auth_url_handler),
) -> dict:
    cmd = GetGmailAuthUrlCommand(redirect_uri=redirect_uri)
    result = handler.handle(cmd)
    return {"url": result.url}


@router.post("/settings/gmail/connect")
async def connect_gmail(
    body: ConnectBody,
    current_user: CurrentUser = Depends(get_current_user),
    handler: ConnectGmailHandler = Depends(get_connect_gmail_handler),
) -> dict:
    cmd = ConnectGmailCommand(
        user_id=UUID(current_user.user_id),
        tenant_id=current_user.tenant_id,
        authorization_code=body.code,
        redirect_uri=body.redirect_uri,
    )
    result = await handler.handle(cmd)
    return {"connected": result.connected, "gmail_email": result.gmail_email}


@router.delete("/settings/gmail/disconnect", status_code=status.HTTP_204_NO_CONTENT)
async def disconnect_gmail(
    current_user: CurrentUser = Depends(get_current_user),
    handler: DisconnectGmailHandler = Depends(get_disconnect_gmail_handler),
) -> None:
    cmd = DisconnectGmailCommand(
        user_id=UUID(current_user.user_id),
        tenant_id=current_user.tenant_id,
    )
    await handler.handle(cmd)


# ── Quotes / send-email endpoint ───────────────────────────────────────────────


@router.post("/quotes/{quote_id}/send-email", status_code=status.HTTP_204_NO_CONTENT)
async def send_quote_email(
    quote_id: str,
    body: SendQuoteEmailBody,
    current_user: CurrentUser = Depends(get_current_user),
    handler: SendQuoteEmailHandler = Depends(get_send_quote_email_handler),
    settings: Settings = Depends(get_settings),
    session: AsyncSession = Depends(get_session),
) -> None:
    cmd = SendQuoteEmailCommand(
        quote_id=quote_id,
        sender_user_id=UUID(current_user.user_id),
        tenant_id=current_user.tenant_id,
        recipient_email=str(body.recipient_email),
        recipient_name=body.recipient_name,
        custom_message=body.custom_message,
        frontend_base_url=settings.frontend_base_url,
        pdf_base64=body.pdf_base64,
    )
    await handler.handle(cmd)
    await session.commit()
