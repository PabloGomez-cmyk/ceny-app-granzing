"""Tests para los use cases de autenticación: Login, Refresh, Logout."""

import json

import pytest

from centy.application.auth.commands import (
    LoginCommand,
    LogoutCommand,
    RefreshTokenCommand,
)
from centy.application.auth.handlers import (
    LoginHandler,
    LogoutHandler,
    RefreshTokenHandler,
)
from centy.domain.shared.exceptions import AuthorizationError
from centy.domain.shared.value_objects import Email, TenantId
from centy.domain.users.entities import Role, User
from centy.domain.users.value_objects import HashedPassword
from tests.conftest import (
    FakeCacheService,
    FakePasswordHasher,
    FakeTokenService,
    FakeUserRepository,
)


def make_login_handler(
    repo: FakeUserRepository,
    hasher: FakePasswordHasher,
    tokens: FakeTokenService,
    cache: FakeCacheService,
) -> LoginHandler:
    return LoginHandler(
        user_repo=repo, hasher=hasher, token_service=tokens, cache=cache
    )


@pytest.fixture
def repo_with_operator(tenant_id: TenantId) -> FakeUserRepository:
    repo = FakeUserRepository()
    user = User.create(
        tenant_id=tenant_id,
        email=Email("op@glazing.com"),
        hashed_password=HashedPassword("fake:pass123"),
        full_name="Operador",
        role=Role.OPERATOR,
    )
    import asyncio

    asyncio.get_event_loop().run_until_complete(repo.save(user))
    return repo


class TestLoginHandler:
    async def test_login_exitoso_retorna_tokens(
        self,
        tenant_id: TenantId,
        repo_with_operator: FakeUserRepository,
        fake_hasher: FakePasswordHasher,
        fake_tokens: FakeTokenService,
        fake_cache: FakeCacheService,
    ) -> None:
        handler = make_login_handler(
            repo_with_operator, fake_hasher, fake_tokens, fake_cache
        )
        result = await handler.handle(
            LoginCommand(
                email="op@glazing.com", password="pass123", tenant_id=tenant_id
            )
        )

        assert result.access_token.startswith("access|")
        assert result.refresh_token.startswith("refresh|")
        assert result.email == "op@glazing.com"
        assert result.role == Role.OPERATOR.value
        assert result.token_type == "bearer"

    async def test_login_almacena_refresh_jti_en_cache(
        self,
        tenant_id: TenantId,
        repo_with_operator: FakeUserRepository,
        fake_hasher: FakePasswordHasher,
        fake_tokens: FakeTokenService,
        fake_cache: FakeCacheService,
    ) -> None:
        handler = make_login_handler(
            repo_with_operator, fake_hasher, fake_tokens, fake_cache
        )
        result = await handler.handle(
            LoginCommand(
                email="op@glazing.com", password="pass123", tenant_id=tenant_id
            )
        )

        jti = result.refresh_token.split("|")[2]
        assert await fake_cache.get(f"rt:{jti}") is not None

    async def test_password_incorrecto_lanza_auth_error(
        self,
        tenant_id: TenantId,
        repo_with_operator: FakeUserRepository,
        fake_hasher: FakePasswordHasher,
        fake_tokens: FakeTokenService,
        fake_cache: FakeCacheService,
    ) -> None:
        handler = make_login_handler(
            repo_with_operator, fake_hasher, fake_tokens, fake_cache
        )
        with pytest.raises(AuthorizationError, match="incorrectos"):
            await handler.handle(
                LoginCommand(
                    email="op@glazing.com", password="WRONG", tenant_id=tenant_id
                )
            )

    async def test_usuario_inexistente_lanza_auth_error(
        self,
        tenant_id: TenantId,
        fake_hasher: FakePasswordHasher,
        fake_tokens: FakeTokenService,
        fake_cache: FakeCacheService,
    ) -> None:
        handler = make_login_handler(
            FakeUserRepository(), fake_hasher, fake_tokens, fake_cache
        )
        with pytest.raises(AuthorizationError):
            await handler.handle(
                LoginCommand(
                    email="nadie@glazing.com", password="x", tenant_id=tenant_id
                )
            )

    async def test_login_almacena_claims_completos_en_json(
        self,
        tenant_id: TenantId,
        repo_with_operator: FakeUserRepository,
        fake_hasher: FakePasswordHasher,
        fake_tokens: FakeTokenService,
        fake_cache: FakeCacheService,
    ) -> None:
        handler = make_login_handler(
            repo_with_operator, fake_hasher, fake_tokens, fake_cache
        )
        result = await handler.handle(
            LoginCommand(
                email="op@glazing.com", password="pass123", tenant_id=tenant_id
            )
        )

        jti = result.refresh_token.split("|")[2]
        raw = await fake_cache.get(f"rt:{jti}")
        assert raw is not None

        claims = json.loads(raw)
        assert claims["user_id"] != ""
        assert claims["role"] == "OPERATOR"
        assert claims["email"] == "op@glazing.com"
        assert claims["tenant_id"] == str(tenant_id)

    async def test_usuario_inactivo_lanza_auth_error(
        self,
        tenant_id: TenantId,
        fake_hasher: FakePasswordHasher,
        fake_tokens: FakeTokenService,
        fake_cache: FakeCacheService,
    ) -> None:
        repo = FakeUserRepository()
        user = User.create(
            tenant_id=tenant_id,
            email=Email("inactivo@glazing.com"),
            hashed_password=HashedPassword("fake:pass"),
            full_name="Inactivo",
            role=Role.OPERATOR,
        )
        user.deactivate()
        await repo.save(user)

        handler = make_login_handler(repo, fake_hasher, fake_tokens, fake_cache)
        with pytest.raises(AuthorizationError, match="desactivada"):
            await handler.handle(
                LoginCommand(
                    email="inactivo@glazing.com", password="pass", tenant_id=tenant_id
                )
            )


class TestRefreshTokenHandler:
    async def test_refresh_exitoso_rota_tokens(
        self,
        fake_tokens: FakeTokenService,
        fake_cache: FakeCacheService,
    ) -> None:
        from uuid import uuid4

        jti = str(uuid4())
        await fake_cache.set(f"rt:{jti}", "user-id-123", 3600)
        old_refresh = f"refresh|user-id-123|{jti}"

        handler = RefreshTokenHandler(token_service=fake_tokens, cache=fake_cache)
        result = await handler.handle(RefreshTokenCommand(refresh_token=old_refresh))

        assert result.access_token.startswith("access|user-id-123")
        assert result.refresh_token.startswith("refresh|user-id-123")
        assert await fake_cache.get(f"rt:{jti}") is None  # token viejo revocado

    async def test_refresh_con_json_propaga_claims_al_access_token(
        self,
        fake_tokens: FakeTokenService,
        fake_cache: FakeCacheService,
        tenant_id: TenantId,
    ) -> None:
        from uuid import uuid4

        jti = str(uuid4())
        user_id = str(uuid4())
        cached = json.dumps(
            {
                "user_id": user_id,
                "tenant_id": str(tenant_id),
                "role": "ADMIN",
                "email": "admin@glazing.com",
            }
        )
        await fake_cache.set(f"rt:{jti}", cached, 3600)
        old_refresh = f"refresh|{user_id}|{jti}"

        handler = RefreshTokenHandler(token_service=fake_tokens, cache=fake_cache)
        result = await handler.handle(RefreshTokenCommand(refresh_token=old_refresh))

        # El access token debe contener el tenant_id y role del JSON
        decoded = fake_tokens.decode_access_token(result.access_token)
        assert decoded["tenant_id"] == str(tenant_id)
        assert decoded["role"] == "ADMIN"
        assert decoded["email"] == "admin@glazing.com"

    async def test_refresh_rota_jti_y_guarda_nuevo_en_cache(
        self,
        fake_tokens: FakeTokenService,
        fake_cache: FakeCacheService,
    ) -> None:
        from uuid import uuid4

        jti = str(uuid4())
        user_id = str(uuid4())
        cached = json.dumps(
            {"user_id": user_id, "tenant_id": "", "role": "OPERATOR", "email": ""}
        )
        await fake_cache.set(f"rt:{jti}", cached, 3600)
        old_refresh = f"refresh|{user_id}|{jti}"

        handler = RefreshTokenHandler(token_service=fake_tokens, cache=fake_cache)
        result = await handler.handle(RefreshTokenCommand(refresh_token=old_refresh))

        new_jti = result.refresh_token.split("|")[2]
        assert await fake_cache.get(f"rt:{jti}") is None  # viejo revocado
        assert await fake_cache.get(f"rt:{new_jti}") is not None  # nuevo activo

    async def test_refresh_token_no_en_cache_lanza_error(
        self,
        fake_tokens: FakeTokenService,
        fake_cache: FakeCacheService,
    ) -> None:
        from uuid import uuid4

        invalid_refresh = f"refresh|user-id|{uuid4()}"
        handler = RefreshTokenHandler(token_service=fake_tokens, cache=fake_cache)
        with pytest.raises(AuthorizationError, match="expirado o revocado"):
            await handler.handle(RefreshTokenCommand(refresh_token=invalid_refresh))


class TestLogoutHandler:
    async def test_logout_revoca_refresh_token(
        self,
        fake_tokens: FakeTokenService,
        fake_cache: FakeCacheService,
    ) -> None:
        from uuid import uuid4

        jti = str(uuid4())
        await fake_cache.set(f"rt:{jti}", "user-id", 3600)
        refresh = f"refresh|user-id|{jti}"

        handler = LogoutHandler(token_service=fake_tokens, cache=fake_cache)
        await handler.handle(LogoutCommand(refresh_token=refresh))

        assert await fake_cache.get(f"rt:{jti}") is None

    async def test_logout_silencioso_con_token_invalido(
        self,
        fake_tokens: FakeTokenService,
        fake_cache: FakeCacheService,
    ) -> None:
        handler = LogoutHandler(token_service=fake_tokens, cache=fake_cache)
        # No debe lanzar excepción
        await handler.handle(LogoutCommand(refresh_token="token-inexistente"))
