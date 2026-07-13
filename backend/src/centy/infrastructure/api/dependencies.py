from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

import redis.asyncio as aioredis
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from centy.application.auth.handlers import (
    LoginHandler,
    LogoutHandler,
    RefreshTokenHandler,
)
from centy.application.auth.password_reset_handlers import (
    ForgotPasswordHandler,
    ResetPasswordHandler,
    ValidateResetTokenHandler,
)
from centy.application.catalog.handlers import (
    CreateBrandHandler,
    CreateCategoryHandler,
    CreateGlassTypeHandler,
    CreateProductHandler,
    DeleteBrandHandler,
    DeleteCategoryHandler,
    DeleteGlassTypeHandler,
    DeleteProductHandler,
    GetBrandHandler,
    GetCategoryHandler,
    GetGlassTypeHandler,
    GetProductHandler,
    ListBrandsHandler,
    ListCategoriesHandler,
    ListGlassTypesHandler,
    ListProductsHandler,
    UpdateBrandHandler,
    UpdateCategoryHandler,
    UpdateGlassTypeHandler,
    UpdateProductHandler,
)
from centy.application.customers.handlers import (
    CreateCustomerHandler,
    CreateCustomerLabelHandler,
    DeactivateCustomerHandler,
    DeleteCustomerLabelHandler,
    GetCustomerHandler,
    ListCustomerLabelsHandler,
    ListCustomersHandler,
    UpdateCustomerHandler,
    UpdateCustomerLabelHandler,
)
from centy.application.email.handlers import (
    ConnectGmailHandler,
    DisconnectGmailHandler,
    GetGmailAuthUrlHandler,
    GetGmailStatusHandler,
    SendQuoteEmailHandler,
)
from centy.application.ports.auth import IPasswordHasher, ITokenService
from centy.application.ports.cache import ICacheService
from centy.application.ports.storage import IObjectStorage
from centy.application.pricing.handlers import (
    DeletePriceOverrideHandler,
    GetEffectivePriceListHandler,
    SetPriceOverrideHandler,
)
from centy.application.quotes.handlers import (
    CreateQuoteHandler,
    DeleteQuoteHandler,
    GetQuoteHandler,
    GetQuoteStatsHandler,
    ListQuotesHandler,
    UpdateQuoteHandler,
    UpdateQuoteStatusHandler,
)
from centy.application.users.handlers import (
    AssignRoleHandler,
    CreateUserHandler,
    DeactivateUserHandler,
    GetUserHandler,
    ListUsersHandler,
    UpdateUserHandler,
)
from centy.application.warranties.handlers import (
    GenerateWarrantiesHandler,
    GetWarrantyHandler,
    ListWarrantiesByQuoteHandler,
    ListWarrantiesHandler,
    SendWarrantiesEmailHandler,
)
from centy.domain.shared.exceptions import AuthorizationError
from centy.infrastructure.auth.bcrypt_hasher import BcryptPasswordHasher
from centy.infrastructure.auth.jwt_service import JwtTokenService
from centy.infrastructure.cache.redis_cache import RedisCacheService
from centy.infrastructure.config.settings import Settings, get_settings
from centy.infrastructure.email.gmail_oauth_sender import GmailOAuthSender
from centy.infrastructure.email.gmail_oauth_service import GmailOAuthService
from centy.infrastructure.persistence.database import get_session, get_session_factory
from centy.infrastructure.persistence.repositories.customer_repo import (
    SQLAlchemyCustomerLabelRepository,
    SQLAlchemyCustomerRepository,
)
from centy.infrastructure.persistence.repositories.email_config_repo import (
    SQLAlchemyEmailConfigRepository,
)
from centy.infrastructure.persistence.repositories.password_reset_repo import (
    SQLAlchemyPasswordResetTokenRepository,
)
from centy.infrastructure.persistence.repositories.price_list_repo import (
    SQLAlchemyPriceListItemRepository,
)
from centy.infrastructure.persistence.repositories.product_repo import (
    SQLAlchemyBrandRepository,
    SQLAlchemyGlassTypeRepository,
    SQLAlchemyProductCategoryRepository,
    SQLAlchemyProductRepository,
)
from centy.infrastructure.persistence.repositories.quote_repo import (
    SQLAlchemyQuoteRepository,
)
from centy.infrastructure.persistence.repositories.user_repo import (
    SQLAlchemyUserRepository,
)
from centy.infrastructure.persistence.repositories.warranty_repo import (
    SQLAlchemyWarrantyRepository,
)
from centy.infrastructure.persistence.unit_of_work import SQLAlchemyUnitOfWork
from centy.infrastructure.storage.local_storage import LocalObjectStorage
from centy.infrastructure.storage.r2_storage import R2ObjectStorage

_bearer = HTTPBearer()


@dataclass(frozen=True)
class CurrentUser:
    user_id: str
    tenant_id: str
    role: str
    email: str


# ── Singletons de infraestructura ─────────────────────────────────────────────


@lru_cache
def _get_password_hasher() -> IPasswordHasher:
    return BcryptPasswordHasher()


@lru_cache
def _get_token_service(settings: Settings = Depends(get_settings)) -> ITokenService:
    return JwtTokenService(
        private_key=settings.load_jwt_private_key(),
        public_key=settings.load_jwt_public_key(),
        access_token_expire_minutes=settings.jwt_access_token_expire_minutes,
        refresh_token_expire_days=settings.jwt_refresh_token_expire_days,
    )


_redis_client: aioredis.Redis | None = None  # type: ignore[type-arg]


def get_redis_client(settings: Settings = Depends(get_settings)) -> aioredis.Redis:  # type: ignore[type-arg]
    global _redis_client
    if _redis_client is None:
        _redis_client = aioredis.from_url(settings.redis_url, decode_responses=False)
    return _redis_client


def get_cache_service(
    redis: aioredis.Redis = Depends(get_redis_client),  # type: ignore[type-arg]
) -> ICacheService:
    return RedisCacheService(redis)


def get_uow() -> SQLAlchemyUnitOfWork:
    return SQLAlchemyUnitOfWork(get_session_factory())


_storage: IObjectStorage | None = None


def get_storage(settings: Settings = Depends(get_settings)) -> IObjectStorage:
    global _storage
    if _storage is None:
        if settings.storage_backend == "r2":
            _storage = R2ObjectStorage(
                account_id=settings.r2_account_id,
                access_key_id=settings.r2_access_key_id,
                secret_access_key=settings.r2_secret_access_key,
                bucket=settings.r2_bucket,
                public_base_url=settings.r2_public_base_url,
            )
        else:
            media_dir = Path("media")
            base_url = f"{settings.backend_base_url.rstrip('/')}/media"
            _storage = LocalObjectStorage(media_dir=media_dir, base_url=base_url)
    return _storage


# ── Auth handlers ─────────────────────────────────────────────────────────────


async def get_login_handler(
    settings: Settings = Depends(get_settings),
    cache: ICacheService = Depends(get_cache_service),
    session: AsyncSession = Depends(get_session),
) -> LoginHandler:
    token_service = JwtTokenService(
        private_key=settings.load_jwt_private_key(),
        public_key=settings.load_jwt_public_key(),
        access_token_expire_minutes=settings.jwt_access_token_expire_minutes,
        refresh_token_expire_days=settings.jwt_refresh_token_expire_days,
    )
    return LoginHandler(
        user_repo=SQLAlchemyUserRepository(session),
        hasher=BcryptPasswordHasher(),
        token_service=token_service,
        cache=cache,
    )


def get_refresh_handler(
    settings: Settings = Depends(get_settings),
    cache: ICacheService = Depends(get_cache_service),
) -> RefreshTokenHandler:
    token_service = JwtTokenService(
        private_key=settings.load_jwt_private_key(),
        public_key=settings.load_jwt_public_key(),
        access_token_expire_minutes=settings.jwt_access_token_expire_minutes,
        refresh_token_expire_days=settings.jwt_refresh_token_expire_days,
    )
    return RefreshTokenHandler(token_service=token_service, cache=cache)


def get_logout_handler(
    settings: Settings = Depends(get_settings),
    cache: ICacheService = Depends(get_cache_service),
) -> LogoutHandler:
    token_service = JwtTokenService(
        private_key=settings.load_jwt_private_key(),
        public_key=settings.load_jwt_public_key(),
        access_token_expire_minutes=settings.jwt_access_token_expire_minutes,
        refresh_token_expire_days=settings.jwt_refresh_token_expire_days,
    )
    return LogoutHandler(token_service=token_service, cache=cache)


# ── Users handlers ────────────────────────────────────────────────────────────


def get_create_user_handler() -> CreateUserHandler:
    return CreateUserHandler(uow=get_uow(), hasher=BcryptPasswordHasher())


async def get_user_handler(
    session: AsyncSession = Depends(get_session),
) -> GetUserHandler:
    return GetUserHandler(repo=SQLAlchemyUserRepository(session))


async def get_list_users_handler(
    session: AsyncSession = Depends(get_session),
) -> ListUsersHandler:
    return ListUsersHandler(repo=SQLAlchemyUserRepository(session))


def get_deactivate_handler() -> DeactivateUserHandler:
    return DeactivateUserHandler(uow=get_uow())


def get_assign_role_handler() -> AssignRoleHandler:
    return AssignRoleHandler(uow=get_uow())


def get_update_user_handler() -> UpdateUserHandler:
    return UpdateUserHandler(uow=get_uow(), hasher=BcryptPasswordHasher())


# ── Customers handlers ────────────────────────────────────────────────────────


def get_create_customer_handler() -> CreateCustomerHandler:
    return CreateCustomerHandler(uow=get_uow())


async def get_list_customers_handler(
    session: AsyncSession = Depends(get_session),
) -> ListCustomersHandler:
    return ListCustomersHandler(repo=SQLAlchemyCustomerRepository(session))


async def get_customer_handler(
    session: AsyncSession = Depends(get_session),
) -> GetCustomerHandler:
    return GetCustomerHandler(repo=SQLAlchemyCustomerRepository(session))


def get_update_customer_handler() -> UpdateCustomerHandler:
    return UpdateCustomerHandler(uow=get_uow())


def get_deactivate_customer_handler() -> DeactivateCustomerHandler:
    return DeactivateCustomerHandler(uow=get_uow())


# ── CustomerLabel handlers ────────────────────────────────────────────────────


def get_create_label_handler() -> CreateCustomerLabelHandler:
    return CreateCustomerLabelHandler(uow=get_uow())


async def get_list_labels_handler(
    session: AsyncSession = Depends(get_session),
) -> ListCustomerLabelsHandler:
    return ListCustomerLabelsHandler(repo=SQLAlchemyCustomerLabelRepository(session))


def get_update_label_handler() -> UpdateCustomerLabelHandler:
    return UpdateCustomerLabelHandler(uow=get_uow())


def get_delete_label_handler() -> DeleteCustomerLabelHandler:
    return DeleteCustomerLabelHandler(uow=get_uow())


# ── Pricing handlers ─────────────────────────────────────────────────────────


async def get_effective_price_list_handler(
    session: AsyncSession = Depends(get_session),
) -> GetEffectivePriceListHandler:
    return GetEffectivePriceListHandler(
        products_repo=SQLAlchemyProductRepository(session),
        brands_repo=SQLAlchemyBrandRepository(session),
        price_list_repo=SQLAlchemyPriceListItemRepository(session),
        users_repo=SQLAlchemyUserRepository(session),
    )


def get_set_price_override_handler() -> SetPriceOverrideHandler:
    return SetPriceOverrideHandler(uow=get_uow())


def get_delete_price_override_handler() -> DeletePriceOverrideHandler:
    return DeletePriceOverrideHandler(uow=get_uow())


# ── RBAC ─────────────────────────────────────────────────────────────────────


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
    settings: Settings = Depends(get_settings),
) -> CurrentUser:
    token_service = JwtTokenService(
        private_key=settings.load_jwt_private_key(),
        public_key=settings.load_jwt_public_key(),
        access_token_expire_minutes=settings.jwt_access_token_expire_minutes,
        refresh_token_expire_days=settings.jwt_refresh_token_expire_days,
    )
    try:
        payload = token_service.decode_access_token(credentials.credentials)
    except AuthorizationError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    return CurrentUser(
        user_id=payload["sub"],
        tenant_id=payload["tenant_id"],
        role=payload["role"],
        email=payload["email"],
    )


async def require_admin(
    current_user: CurrentUser = Depends(get_current_user),
) -> CurrentUser:
    if current_user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requiere rol ADMIN",
        )
    return current_user


# ── Brand handlers ────────────────────────────────────────────────────────────


def get_create_brand_handler() -> CreateBrandHandler:
    return CreateBrandHandler(uow=get_uow())


async def get_brand_handler(
    session: AsyncSession = Depends(get_session),
) -> GetBrandHandler:
    return GetBrandHandler(repo=SQLAlchemyBrandRepository(session))


async def get_list_brands_handler(
    session: AsyncSession = Depends(get_session),
) -> ListBrandsHandler:
    return ListBrandsHandler(repo=SQLAlchemyBrandRepository(session))


def get_update_brand_handler() -> UpdateBrandHandler:
    return UpdateBrandHandler(uow=get_uow())


def get_delete_brand_handler() -> DeleteBrandHandler:
    return DeleteBrandHandler(uow=get_uow())


# ── Category handlers ─────────────────────────────────────────────────────────


def get_create_category_handler() -> CreateCategoryHandler:
    return CreateCategoryHandler(uow=get_uow())


async def get_category_handler(
    session: AsyncSession = Depends(get_session),
) -> GetCategoryHandler:
    return GetCategoryHandler(repo=SQLAlchemyProductCategoryRepository(session))


async def get_list_categories_handler(
    session: AsyncSession = Depends(get_session),
) -> ListCategoriesHandler:
    return ListCategoriesHandler(repo=SQLAlchemyProductCategoryRepository(session))


def get_update_category_handler() -> UpdateCategoryHandler:
    return UpdateCategoryHandler(uow=get_uow())


def get_delete_category_handler() -> DeleteCategoryHandler:
    return DeleteCategoryHandler(uow=get_uow())


# ── GlassType handlers ────────────────────────────────────────────────────────


def get_create_glass_type_handler() -> CreateGlassTypeHandler:
    return CreateGlassTypeHandler(uow=get_uow())


async def get_glass_type_handler(
    session: AsyncSession = Depends(get_session),
) -> GetGlassTypeHandler:
    return GetGlassTypeHandler(repo=SQLAlchemyGlassTypeRepository(session))


async def get_list_glass_types_handler(
    session: AsyncSession = Depends(get_session),
) -> ListGlassTypesHandler:
    return ListGlassTypesHandler(repo=SQLAlchemyGlassTypeRepository(session))


def get_update_glass_type_handler() -> UpdateGlassTypeHandler:
    return UpdateGlassTypeHandler(uow=get_uow())


def get_delete_glass_type_handler() -> DeleteGlassTypeHandler:
    return DeleteGlassTypeHandler(uow=get_uow())


# ── Product handlers ──────────────────────────────────────────────────────────


def get_create_product_handler() -> CreateProductHandler:
    return CreateProductHandler(uow=get_uow())


async def get_product_handler(
    session: AsyncSession = Depends(get_session),
) -> GetProductHandler:
    return GetProductHandler(repo=SQLAlchemyProductRepository(session))


async def get_list_products_handler(
    session: AsyncSession = Depends(get_session),
) -> ListProductsHandler:
    return ListProductsHandler(repo=SQLAlchemyProductRepository(session))


def get_update_product_handler() -> UpdateProductHandler:
    return UpdateProductHandler(uow=get_uow())


def get_delete_product_handler() -> DeleteProductHandler:
    return DeleteProductHandler(uow=get_uow())


# ── Quote handlers ────────────────────────────────────────────────────────────


def get_create_quote_handler() -> CreateQuoteHandler:
    return CreateQuoteHandler(uow=get_uow())


async def get_list_quotes_handler(
    session: AsyncSession = Depends(get_session),
) -> ListQuotesHandler:
    return ListQuotesHandler(repo=SQLAlchemyQuoteRepository(session))


async def get_quote_handler(
    session: AsyncSession = Depends(get_session),
) -> GetQuoteHandler:
    return GetQuoteHandler(repo=SQLAlchemyQuoteRepository(session))


def get_update_quote_status_handler() -> UpdateQuoteStatusHandler:
    return UpdateQuoteStatusHandler(uow=get_uow())


def get_update_quote_handler() -> UpdateQuoteHandler:
    return UpdateQuoteHandler(uow=get_uow())


def get_delete_quote_handler() -> DeleteQuoteHandler:
    return DeleteQuoteHandler(uow=get_uow())


async def get_quote_stats_handler(
    session: AsyncSession = Depends(get_session),
) -> GetQuoteStatsHandler:
    return GetQuoteStatsHandler(repo=SQLAlchemyQuoteRepository(session))


# ── Warranty handlers ─────────────────────────────────────────────────────────


def get_generate_warranties_handler() -> GenerateWarrantiesHandler:
    return GenerateWarrantiesHandler(uow=get_uow())


async def get_list_warranties_handler(
    session: AsyncSession = Depends(get_session),
) -> ListWarrantiesHandler:
    return ListWarrantiesHandler(repo=SQLAlchemyWarrantyRepository(session))


async def get_list_warranties_by_quote_handler(
    session: AsyncSession = Depends(get_session),
) -> ListWarrantiesByQuoteHandler:
    return ListWarrantiesByQuoteHandler(repo=SQLAlchemyWarrantyRepository(session))


async def get_warranty_handler(
    session: AsyncSession = Depends(get_session),
) -> GetWarrantyHandler:
    return GetWarrantyHandler(repo=SQLAlchemyWarrantyRepository(session))


# ── Gmail / Email handlers ────────────────────────────────────────────────────


def _get_gmail_oauth_service(
    settings: Settings = Depends(get_settings),
) -> GmailOAuthService:
    return GmailOAuthService(
        client_id=settings.gmail_oauth_client_id,
        client_secret=settings.gmail_oauth_client_secret,
    )


def _get_gmail_sender(settings: Settings = Depends(get_settings)) -> GmailOAuthSender:
    return GmailOAuthSender(
        client_id=settings.gmail_oauth_client_id,
        client_secret=settings.gmail_oauth_client_secret,
    )


def _get_email_encryption_key(settings: Settings = Depends(get_settings)) -> bytes:
    key = settings.gmail_token_encryption_key
    if not key:
        from cryptography.fernet import Fernet

        key = Fernet.generate_key().decode()
    return key.encode()


async def get_gmail_status_handler(
    session: AsyncSession = Depends(get_session),
    enc_key: bytes = Depends(_get_email_encryption_key),
) -> GetGmailStatusHandler:
    return GetGmailStatusHandler(repo=SQLAlchemyEmailConfigRepository(session, enc_key))


async def get_gmail_auth_url_handler(
    settings: Settings = Depends(get_settings),
) -> GetGmailAuthUrlHandler:
    return GetGmailAuthUrlHandler(
        oauth=GmailOAuthService(
            settings.gmail_oauth_client_id, settings.gmail_oauth_client_secret
        )
    )


async def get_connect_gmail_handler(
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
    enc_key: bytes = Depends(_get_email_encryption_key),
) -> ConnectGmailHandler:
    return ConnectGmailHandler(
        oauth=GmailOAuthService(
            settings.gmail_oauth_client_id, settings.gmail_oauth_client_secret
        ),
        repo=SQLAlchemyEmailConfigRepository(session, enc_key),
    )


async def get_disconnect_gmail_handler(
    session: AsyncSession = Depends(get_session),
    enc_key: bytes = Depends(_get_email_encryption_key),
) -> DisconnectGmailHandler:
    return DisconnectGmailHandler(
        repo=SQLAlchemyEmailConfigRepository(session, enc_key)
    )


async def get_send_quote_email_handler(
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
    enc_key: bytes = Depends(_get_email_encryption_key),
) -> SendQuoteEmailHandler:
    oauth = GmailOAuthService(
        settings.gmail_oauth_client_id, settings.gmail_oauth_client_secret
    )
    return SendQuoteEmailHandler(
        oauth=oauth,
        email_config_repo=SQLAlchemyEmailConfigRepository(session, enc_key),
        sender=GmailOAuthSender(
            settings.gmail_oauth_client_id, settings.gmail_oauth_client_secret
        ),
        quote_repo=SQLAlchemyQuoteRepository(session),
        user_repo=SQLAlchemyUserRepository(session),
    )


async def get_send_warranties_email_handler(
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
    enc_key: bytes = Depends(_get_email_encryption_key),
) -> SendWarrantiesEmailHandler:
    oauth = GmailOAuthService(
        settings.gmail_oauth_client_id, settings.gmail_oauth_client_secret
    )
    return SendWarrantiesEmailHandler(
        oauth=oauth,
        email_config_repo=SQLAlchemyEmailConfigRepository(session, enc_key),
        sender=GmailOAuthSender(
            settings.gmail_oauth_client_id, settings.gmail_oauth_client_secret
        ),
        quote_repo=SQLAlchemyQuoteRepository(session),
        warranty_repo=SQLAlchemyWarrantyRepository(session),
        user_repo=SQLAlchemyUserRepository(session),
    )


async def get_forgot_password_handler(
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
    enc_key: bytes = Depends(_get_email_encryption_key),
) -> ForgotPasswordHandler:
    oauth = GmailOAuthService(
        settings.gmail_oauth_client_id, settings.gmail_oauth_client_secret
    )
    return ForgotPasswordHandler(
        user_repo=SQLAlchemyUserRepository(session),
        token_repo=SQLAlchemyPasswordResetTokenRepository(session),
        email_config_repo=SQLAlchemyEmailConfigRepository(session, enc_key),
        oauth=oauth,
        sender=GmailOAuthSender(
            settings.gmail_oauth_client_id, settings.gmail_oauth_client_secret
        ),
    )


async def get_validate_reset_token_handler(
    session: AsyncSession = Depends(get_session),
) -> ValidateResetTokenHandler:
    return ValidateResetTokenHandler(
        token_repo=SQLAlchemyPasswordResetTokenRepository(session),
        user_repo=SQLAlchemyUserRepository(session),
    )


async def get_reset_password_handler(
    session: AsyncSession = Depends(get_session),
) -> ResetPasswordHandler:
    return ResetPasswordHandler(
        token_repo=SQLAlchemyPasswordResetTokenRepository(session),
        user_repo=SQLAlchemyUserRepository(session),
        hasher=BcryptPasswordHasher(),
    )
