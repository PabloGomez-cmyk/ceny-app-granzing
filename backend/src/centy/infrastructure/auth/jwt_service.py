from datetime import UTC, datetime, timedelta
from uuid import uuid4

from jose import JWTError, jwt

from centy.application.ports.auth import ITokenService
from centy.domain.shared.exceptions import AuthorizationError

_ALGORITHM = "RS256"


class JwtTokenService(ITokenService):
    """JWT RS256: private key firma, public key verifica.

    Los refresh tokens incluyen un claim `jti` (UUID) para permitir
    revocación individual sin invalidar todos los tokens del usuario.
    """

    def __init__(
        self,
        private_key: str,
        public_key: str,
        access_token_expire_minutes: int,
        refresh_token_expire_days: int,
    ) -> None:
        self._private_key = private_key
        self._public_key = public_key
        self._access_delta = timedelta(minutes=access_token_expire_minutes)
        self._refresh_delta = timedelta(days=refresh_token_expire_days)

    def create_access_token(self, subject: str, extra_claims: dict[str, str]) -> str:
        now = datetime.now(UTC)
        payload: dict[str, object] = {
            "sub": subject,
            "iat": now,
            "exp": now + self._access_delta,
            "type": "access",
            **extra_claims,
        }
        return jwt.encode(payload, self._private_key, algorithm=_ALGORITHM)

    def create_refresh_token(self, subject: str) -> str:
        now = datetime.now(UTC)
        payload: dict[str, object] = {
            "sub": subject,
            "iat": now,
            "exp": now + self._refresh_delta,
            "type": "refresh",
            "jti": str(uuid4()),
        }
        return jwt.encode(payload, self._private_key, algorithm=_ALGORITHM)

    def decode_access_token(self, token: str) -> dict[str, str]:
        return self._decode(token, expected_type="access")

    def decode_refresh_token(self, token: str) -> dict[str, str]:
        return self._decode(token, expected_type="refresh")

    def _decode(self, token: str, expected_type: str) -> dict[str, str]:
        try:
            payload: dict[str, str] = jwt.decode(
                token, self._public_key, algorithms=[_ALGORITHM]
            )
        except JWTError as exc:
            raise AuthorizationError(f"Token inválido: {exc}") from exc

        if payload.get("type") != expected_type:
            raise AuthorizationError(
                f"Se esperaba token tipo '{expected_type}', recibido '{payload.get('type')}'"
            )
        return payload
