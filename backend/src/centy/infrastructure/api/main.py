from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncGenerator

import sentry_sdk
import structlog
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from centy.domain.shared.exceptions import (
    AuthorizationError,
    BusinessRuleViolationError,
    ConflictError,
    DomainError,
    NotFoundError,
    ValidationError,
)
from centy.infrastructure.api.routers import auth, customers, users
from centy.infrastructure.api.routers import gmail as gmail_router
from centy.infrastructure.api.routers import products as products_router
from centy.infrastructure.api.routers import quotes as quotes_router
from centy.infrastructure.api.routers import uploads as uploads_router
from centy.infrastructure.api.routers import warranties as warranties_router
from centy.infrastructure.config.settings import get_settings
from centy.infrastructure.persistence.database import init_db
from centy.infrastructure.persistence.models import (  # noqa: F401
    BrandModel,
    CustomerLabelModel,
    CustomerModel,
    GlassTypeModel,
    GlassPaneModel,
    ProductCategoryModel,
    ProductGlassTypeModel,
    ProductModel,
    QuoteLineModel,
    QuoteModel,
    UserEmailConfigModel,
    UserModel,
    PasswordResetTokenModel,
    WarrantyModel,
)

log = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    settings = get_settings()
    init_db(settings.database_url)
    log.info("base_de_datos_inicializada", environment=settings.environment)
    if settings.sentry_dsn:
        sentry_sdk.init(dsn=settings.sentry_dsn, environment=settings.environment)
    yield
    log.info("servidor_apagado")


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="Glazing Platform API",
        version="1.0.0",
        docs_url="/docs" if not settings.is_production else None,
        redoc_url="/redoc" if not settings.is_production else None,
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Traducción de errores de dominio a HTTP ────────────────────────────────

    @app.exception_handler(NotFoundError)
    async def not_found_handler(request: Request, exc: NotFoundError) -> JSONResponse:
        return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content={"detail": str(exc)})

    @app.exception_handler(ConflictError)
    async def conflict_handler(request: Request, exc: ConflictError) -> JSONResponse:
        return JSONResponse(status_code=status.HTTP_409_CONFLICT, content={"detail": str(exc)})

    @app.exception_handler(AuthorizationError)
    async def auth_error_handler(request: Request, exc: AuthorizationError) -> JSONResponse:
        return JSONResponse(status_code=status.HTTP_401_UNAUTHORIZED, content={"detail": str(exc)})

    @app.exception_handler(ValidationError)
    async def validation_handler(request: Request, exc: ValidationError) -> JSONResponse:
        return JSONResponse(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, content={"detail": str(exc)})

    @app.exception_handler(BusinessRuleViolationError)
    async def business_rule_handler(request: Request, exc: BusinessRuleViolationError) -> JSONResponse:
        return JSONResponse(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, content={"detail": str(exc)})

    @app.exception_handler(DomainError)
    async def domain_error_handler(request: Request, exc: DomainError) -> JSONResponse:
        log.warning("domain_error_no_manejado", error=str(exc))
        return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content={"detail": str(exc)})

    # ── Routers ───────────────────────────────────────────────────────────────

    app.include_router(auth.router, prefix="/api/v1")
    app.include_router(users.router, prefix="/api/v1")
    app.include_router(customers.router, prefix="/api/v1")
    app.include_router(products_router.router, prefix="/api/v1")
    app.include_router(uploads_router.router, prefix="/api/v1")
    app.include_router(quotes_router.router, prefix="/api/v1")
    app.include_router(warranties_router.router, prefix="/api/v1")
    app.include_router(gmail_router.router, prefix="/api/v1")

    # Servir archivos subidos localmente — solo cuando storage_backend="local" (dev).
    # En producción los archivos se sirven directamente desde R2 (storage_backend="r2").
    if settings.storage_backend == "local":
        media_dir = Path("media")
        media_dir.mkdir(exist_ok=True)
        app.mount("/media", StaticFiles(directory=str(media_dir)), name="media")

    @app.get("/health", tags=["infra"])
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
