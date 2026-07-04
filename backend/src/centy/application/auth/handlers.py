import json
from dataclasses import dataclass, field

from centy.application.auth.commands import (
    LoginCommand,
    LogoutCommand,
    RefreshTokenCommand,
)
from centy.application.ports.auth import IPasswordHasher, ITokenService
from centy.application.ports.cache import ICacheService
from centy.application.ports.repositories import IUserRepository
from centy.domain.shared.exceptions import AuthorizationError
from centy.domain.shared.value_objects import Email

_REFRESH_PREFIX = "rt:"
_REFRESH_TTL_SECONDS = 7 * 24 * 3600


@dataclass(frozen=True)
class LoginResult:
    access_token: str
    refresh_token: str
    user_id: str
    email: str
    role: str
    token_type: str = field(default="bearer")


@dataclass(frozen=True)
class RefreshResult:
    access_token: str
    refresh_token: str
    token_type: str = field(default="bearer")


class LoginHandler:
    def __init__(
        self,
        user_repo: IUserRepository,
        hasher: IPasswordHasher,
        token_service: ITokenService,
        cache: ICacheService,
    ) -> None:
        self._repo = user_repo
        self._hasher = hasher
        self._tokens = token_service
        self._cache = cache

    async def handle(self, command: LoginCommand) -> LoginResult:
        user = await self._repo.get_by_email(Email(command.email), command.tenant_id)
        if user is None or not self._hasher.verify(
            command.password, user.hashed_password
        ):
            raise AuthorizationError("Email o contraseña incorrectos")

        if not user.is_active:
            raise AuthorizationError("Cuenta desactivada")

        user_id_str = str(user.id)
        access_token = self._tokens.create_access_token(
            subject=user_id_str,
            extra_claims={
                "tenant_id": str(user.tenant_id),
                "role": user.role.value,
                "email": user.email.value,
            },
        )
        refresh_token = self._tokens.create_refresh_token(subject=user_id_str)

        # Almacenar JTI + claims en Redis para poder reconstruir el access token al renovar
        payload = self._tokens.decode_refresh_token(refresh_token)
        jti = payload["jti"]
        cached_claims = json.dumps(
            {
                "user_id": user_id_str,
                "tenant_id": str(user.tenant_id),
                "role": user.role.value,
                "email": user.email.value,
            }
        )
        await self._cache.set(
            f"{_REFRESH_PREFIX}{jti}", cached_claims, _REFRESH_TTL_SECONDS
        )

        return LoginResult(
            access_token=access_token,
            refresh_token=refresh_token,
            user_id=user_id_str,
            email=user.email.value,
            role=user.role.value,
        )


class RefreshTokenHandler:
    def __init__(
        self,
        token_service: ITokenService,
        cache: ICacheService,
    ) -> None:
        self._tokens = token_service
        self._cache = cache

    async def handle(self, command: RefreshTokenCommand) -> RefreshResult:
        try:
            payload = self._tokens.decode_refresh_token(command.refresh_token)
        except Exception as e:
            raise AuthorizationError("Refresh token inválido") from e

        jti = payload["jti"]
        raw = await self._cache.get(f"{_REFRESH_PREFIX}{jti}")
        if raw is None:
            raise AuthorizationError("Refresh token expirado o revocado")

        try:
            claims = json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            # compatibilidad con entradas antiguas que solo guardaban el user_id
            claims = {"user_id": raw, "tenant_id": "", "role": "", "email": ""}

        user_id = claims["user_id"]

        # Rotación: invalida el token usado y emite uno nuevo
        await self._cache.delete(f"{_REFRESH_PREFIX}{jti}")

        new_access = self._tokens.create_access_token(
            subject=user_id,
            extra_claims={
                "tenant_id": claims["tenant_id"],
                "role": claims["role"],
                "email": claims.get("email", ""),
            },
        )
        new_refresh = self._tokens.create_refresh_token(subject=user_id)

        new_payload = self._tokens.decode_refresh_token(new_refresh)
        new_cached = json.dumps(claims | {"user_id": user_id})
        await self._cache.set(
            f"{_REFRESH_PREFIX}{new_payload['jti']}", new_cached, _REFRESH_TTL_SECONDS
        )

        return RefreshResult(access_token=new_access, refresh_token=new_refresh)


class LogoutHandler:
    def __init__(self, token_service: ITokenService, cache: ICacheService) -> None:
        self._tokens = token_service
        self._cache = cache

    async def handle(self, command: LogoutCommand) -> None:
        try:
            payload = self._tokens.decode_refresh_token(command.refresh_token)
            jti = payload["jti"]
            await self._cache.delete(f"{_REFRESH_PREFIX}{jti}")
        except Exception:
            pass  # Logout silencioso aunque el token ya no sea válido
