import asyncio
import base64
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build  # type: ignore[import-untyped]
from googleapiclient.errors import HttpError  # type: ignore[import-untyped]

from centy.application.ports.email import EmailMessage, IEmailSender, UserEmailConfig
from centy.domain.shared.exceptions import BusinessRuleViolationError


class GmailOAuthSender(IEmailSender):
    def __init__(self, client_id: str, client_secret: str) -> None:
        self._client_id = client_id
        self._client_secret = client_secret

    async def send(self, *, config: UserEmailConfig, message: EmailMessage) -> None:
        client_id = self._client_id
        client_secret = self._client_secret

        def _send() -> None:
            creds = Credentials(
                token=config.access_token,
                refresh_token=config.refresh_token,
                token_uri="https://oauth2.googleapis.com/token",
                client_id=client_id,
                client_secret=client_secret,
            )
            service = build("gmail", "v1", credentials=creds, cache_discovery=False)

            if message.attachment_pdf_base64:
                # Email mixto: texto HTML + adjunto PDF
                msg: MIMEMultipart = MIMEMultipart("mixed")
                msg.attach(MIMEText(message.html_body, "html", "utf-8"))
                pdf_bytes = base64.b64decode(message.attachment_pdf_base64)
                attachment = MIMEApplication(pdf_bytes, _subtype="pdf")
                filename = message.attachment_filename or "presupuesto.pdf"
                attachment.add_header(
                    "Content-Disposition", "attachment", filename=filename
                )
                msg.attach(attachment)
            else:
                msg = MIMEMultipart("alternative")
                msg.attach(MIMEText(message.html_body, "html", "utf-8"))

            msg["Subject"] = message.subject
            if message.from_name:
                msg["From"] = f"{message.from_name} <{config.gmail_email}>"
            else:
                msg["From"] = config.gmail_email
            msg["To"] = message.to

            raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
            try:
                service.users().messages().send(
                    userId="me", body={"raw": raw}
                ).execute()
            except HttpError as exc:
                raise BusinessRuleViolationError(
                    f"Error al enviar el email por Gmail: {exc}"
                ) from exc

        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, _send)
