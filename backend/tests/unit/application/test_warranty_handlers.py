"""Tests de use cases del módulo Warranties (generar, listar, enviar por email).

Usa repositorios en memoria — sin DB, sin FastAPI.
"""

from datetime import UTC, datetime
from decimal import Decimal
from types import TracebackType
from typing import Self
from uuid import UUID, uuid4

import pytest

from centy.application.ports.email import (
    EmailMessage,
    IEmailConfigRepository,
    IEmailSender,
    IGmailOAuthService,
    OAuthTokens,
    UserEmailConfig,
)
from centy.application.ports.repositories import IQuoteRepository, IWarrantyRepository
from centy.application.ports.unit_of_work import IUnitOfWork
from centy.application.warranties.commands import (
    GenerateWarrantiesCommand,
    SendWarrantiesEmailCommand,
)
from centy.application.warranties.handlers import (
    GenerateWarrantiesHandler,
    GetWarrantyHandler,
    ListWarrantiesHandler,
    SendWarrantiesEmailHandler,
)
from centy.application.warranties.queries import GetWarrantyQuery, ListWarrantiesQuery
from centy.domain.catalog.entities import Brand, Product
from centy.domain.catalog.value_objects import ApplicationType
from centy.domain.quotes.entities import GlassPane, Quote, QuoteLine
from centy.domain.quotes.value_objects import FilmMode, LocationType, QuoteStatus
from centy.domain.shared.exceptions import (
    AuthorizationError,
    BusinessRuleViolationError,
    NotFoundError,
)
from centy.domain.shared.value_objects import TenantId
from centy.domain.warranties.entities import Warranty
from tests.conftest import FakeBrandRepository, FakeProductRepository

# ── Fakes ─────────────────────────────────────────────────────────────────────


class FakeQuoteRepository(IQuoteRepository):
    def __init__(self) -> None:
        self._store: dict[UUID, Quote] = {}

    async def get_by_id(self, quote_id: UUID, tenant_id: TenantId) -> Quote | None:
        q = self._store.get(quote_id)
        return q if q and q.tenant_id == tenant_id else None

    async def save(self, quote: Quote) -> None:
        self._store[quote.id] = quote

    async def list_by_tenant(self, tenant_id: TenantId) -> list[Quote]:
        return [q for q in self._store.values() if q.tenant_id == tenant_id]

    async def list_by_user(self, user_id: UUID, tenant_id: TenantId) -> list[Quote]:
        return [
            q
            for q in self._store.values()
            if q.tenant_id == tenant_id and q.created_by_user_id == user_id
        ]

    async def delete(self, quote_id: UUID, tenant_id: TenantId) -> None:
        self._store.pop(quote_id, None)

    async def next_sequence(self, tenant_id: TenantId, user_id: UUID) -> int:
        return len(self._store) + 1


class FakeWarrantyRepository(IWarrantyRepository):
    def __init__(self) -> None:
        self._store: dict[UUID, Warranty] = {}

    async def get_by_id(
        self, warranty_id: UUID, tenant_id: TenantId
    ) -> Warranty | None:
        w = self._store.get(warranty_id)
        return w if w and w.tenant_id == tenant_id else None

    async def save(self, warranty: Warranty) -> None:
        self._store[warranty.id] = warranty

    async def list_by_tenant(self, tenant_id: TenantId) -> list[Warranty]:
        return [w for w in self._store.values() if w.tenant_id == tenant_id]

    async def list_by_user(self, user_id: UUID, tenant_id: TenantId) -> list[Warranty]:
        return [
            w
            for w in self._store.values()
            if w.tenant_id == tenant_id and w.created_by_user_id == user_id
        ]

    async def list_by_quote(
        self, quote_id: UUID, tenant_id: TenantId
    ) -> list[Warranty]:
        return [
            w
            for w in self._store.values()
            if w.tenant_id == tenant_id and w.quote_id == quote_id
        ]

    async def next_sequence(self, tenant_id: TenantId) -> int:
        return len([w for w in self._store.values() if w.tenant_id == tenant_id]) + 1


class FakeWarrantyUnitOfWork(IUnitOfWork):
    def __init__(
        self,
        quote_repo: FakeQuoteRepository,
        warranty_repo: FakeWarrantyRepository,
        product_repo: FakeProductRepository,
        brand_repo: FakeBrandRepository,
    ) -> None:
        from tests.conftest import (
            FakeCustomerLabelRepository,
            FakeCustomerRepository,
            FakeGlassTypeRepository,
            FakeProductCategoryRepository,
            FakeUserRepository,
        )

        self.users = FakeUserRepository()
        self.customers = FakeCustomerRepository()
        self.customer_labels = FakeCustomerLabelRepository()
        self.brands = brand_repo
        self.product_categories = FakeProductCategoryRepository()
        self.glass_types = FakeGlassTypeRepository()
        self.products = product_repo
        self.quotes = quote_repo
        self.warranties = warranty_repo
        self.committed = False

    async def __aenter__(self) -> Self:
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: TracebackType | None,
    ) -> None:
        pass

    async def commit(self) -> None:
        self.committed = True

    async def rollback(self) -> None:
        pass


class FakeEmailConfigRepository(IEmailConfigRepository):
    def __init__(self, config: UserEmailConfig | None = None) -> None:
        self._config = config

    async def get_by_user_id(
        self, user_id: UUID, tenant_id: str
    ) -> UserEmailConfig | None:
        return self._config

    async def save(self, config: UserEmailConfig) -> None:
        self._config = config

    async def delete(self, user_id: UUID, tenant_id: str) -> None:
        self._config = None

    async def get_admin_config(self, tenant_id: str) -> UserEmailConfig | None:
        return self._config

    async def get_any_for_tenant(self, tenant_id: str) -> UserEmailConfig | None:
        return self._config


class FakeGmailOAuthService(IGmailOAuthService):
    def get_auth_url(self, redirect_uri: str) -> str:
        return "https://example.com/auth"

    async def exchange_code(self, code: str, redirect_uri: str) -> OAuthTokens:
        raise NotImplementedError

    async def refresh_if_needed(self, config: UserEmailConfig) -> UserEmailConfig:
        return config


class FakeEmailSender(IEmailSender):
    def __init__(self) -> None:
        self.sent_messages: list[EmailMessage] = []

    async def send(self, *, config: UserEmailConfig, message: EmailMessage) -> None:
        self.sent_messages.append(message)


# ── Helpers ───────────────────────────────────────────────────────────────────


def make_product(
    tenant_id: TenantId, brand_id: UUID, warranty_years: int = 5
) -> Product:
    return Product.create(
        tenant_id=tenant_id,
        name="Black Silver",
        brand_id=brand_id,
        category_id=uuid4(),
        sale_price_per_m2=Decimal("1000"),
        purchase_price_per_m2=Decimal("500"),
        uv_percentage=Decimal("83"),
        irr_percentage=Decimal("76"),
        tser_percentage=Decimal("52.3"),
        warranty_years=warranty_years,
        roll_width_cm=Decimal("152"),
        roll_length_m=Decimal("30"),
        application_types=[ApplicationType.WINDOW.value],
        compatible_glass_ids=[],
        technical_sheet_url=None,
    )


def make_brand(tenant_id: TenantId) -> Brand:
    return Brand.create(tenant_id=tenant_id, name="3M", color="#0f6e50", logo_url=None)


def make_quote(
    tenant_id: TenantId,
    user_id: UUID,
    product_id: UUID,
    status: QuoteStatus = QuoteStatus.COMPLETED,
) -> Quote:
    pane = GlassPane(
        pane_id="v01",
        glass_type_id=None,
        glass_type_name="Monolítico",
        width_cm=Decimal("100"),
        height_cm=Decimal("100"),
        location=LocationType.SUPERFICIE,
        quantity=1,
    )
    line = QuoteLine(
        product_id=product_id,
        product_snapshot={"name": "Black Silver"},
        glass_pane_ids=["v01"],
        price_per_m2=Decimal("1000"),
        surface_m2=Decimal("1.00"),
        subtotal=Decimal("1000.00"),
    )
    q = Quote.create(
        tenant_id=tenant_id,
        created_by_user_id=user_id,
        quote_number="P-0001",
        customer_id=None,
        customer_snapshot={"name": "Pablo Gómez", "email": "pablo@example.com"},
        film_mode=FilmMode.SINGLE,
        glass_panes=[pane],
        lines=[line],
        height_surcharge_pct=Decimal("0"),
        travel_cost=Decimal("0"),
        discount_pct=Decimal("0"),
        tax_pct=Decimal("0"),
        commercial_conditions="",
        cut_plan_snapshot={},
        valid_until="2026-12-31",
    )
    q.status = status
    return q


# ── Fixtures ──────────────────────────────────────────────────────────────────


@pytest.fixture
def tenant_id() -> TenantId:
    return TenantId(uuid4())


@pytest.fixture
def quote_repo() -> FakeQuoteRepository:
    return FakeQuoteRepository()


@pytest.fixture
def warranty_repo() -> FakeWarrantyRepository:
    return FakeWarrantyRepository()


@pytest.fixture
def product_repo() -> FakeProductRepository:
    return FakeProductRepository()


@pytest.fixture
def brand_repo() -> FakeBrandRepository:
    return FakeBrandRepository()


@pytest.fixture
def uow(
    quote_repo: FakeQuoteRepository,
    warranty_repo: FakeWarrantyRepository,
    product_repo: FakeProductRepository,
    brand_repo: FakeBrandRepository,
) -> FakeWarrantyUnitOfWork:
    return FakeWarrantyUnitOfWork(quote_repo, warranty_repo, product_repo, brand_repo)


# ── GenerateWarrantiesHandler ─────────────────────────────────────────────────


class TestGenerateWarrantiesHandler:
    @pytest.mark.asyncio
    async def test_genera_una_garantia_por_linea(
        self,
        uow: FakeWarrantyUnitOfWork,
        tenant_id: TenantId,
    ) -> None:
        user_id = uuid4()
        brand = make_brand(tenant_id)
        await uow.brands.save(brand)
        product = make_product(tenant_id, brand.id, warranty_years=5)
        await uow.products.save(product)
        quote = make_quote(tenant_id, user_id, product.id)
        await uow.quotes.save(quote)

        results = await GenerateWarrantiesHandler(uow).handle(
            GenerateWarrantiesCommand(
                quote_id=quote.id,
                tenant_id=tenant_id,
                requester_user_id=user_id,
                requester_role="OPERATOR",
            )
        )
        assert len(results) == 1
        assert results[0].warranty_number == "G-0001"
        assert results[0].warranty_years == 5
        assert results[0].is_valid is True
        assert uow.committed is True

    @pytest.mark.asyncio
    async def test_rechaza_si_quote_no_esta_completed(
        self,
        uow: FakeWarrantyUnitOfWork,
        tenant_id: TenantId,
    ) -> None:
        user_id = uuid4()
        brand = make_brand(tenant_id)
        await uow.brands.save(brand)
        product = make_product(tenant_id, brand.id)
        await uow.products.save(product)
        quote = make_quote(tenant_id, user_id, product.id, status=QuoteStatus.INVOICED)
        await uow.quotes.save(quote)

        with pytest.raises(BusinessRuleViolationError, match="terminadas"):
            await GenerateWarrantiesHandler(uow).handle(
                GenerateWarrantiesCommand(
                    quote_id=quote.id,
                    tenant_id=tenant_id,
                    requester_user_id=user_id,
                    requester_role="OPERATOR",
                )
            )

    @pytest.mark.asyncio
    async def test_rechaza_generar_dos_veces(
        self,
        uow: FakeWarrantyUnitOfWork,
        tenant_id: TenantId,
    ) -> None:
        user_id = uuid4()
        brand = make_brand(tenant_id)
        await uow.brands.save(brand)
        product = make_product(tenant_id, brand.id)
        await uow.products.save(product)
        quote = make_quote(tenant_id, user_id, product.id)
        await uow.quotes.save(quote)

        cmd = GenerateWarrantiesCommand(
            quote_id=quote.id,
            tenant_id=tenant_id,
            requester_user_id=user_id,
            requester_role="OPERATOR",
        )
        await GenerateWarrantiesHandler(uow).handle(cmd)
        with pytest.raises(BusinessRuleViolationError, match="ya fueron generadas"):
            await GenerateWarrantiesHandler(uow).handle(cmd)

    @pytest.mark.asyncio
    async def test_operator_ajeno_no_puede_generar(
        self,
        uow: FakeWarrantyUnitOfWork,
        tenant_id: TenantId,
    ) -> None:
        owner_id = uuid4()
        other_id = uuid4()
        brand = make_brand(tenant_id)
        await uow.brands.save(brand)
        product = make_product(tenant_id, brand.id)
        await uow.products.save(product)
        quote = make_quote(tenant_id, owner_id, product.id)
        await uow.quotes.save(quote)

        with pytest.raises(AuthorizationError):
            await GenerateWarrantiesHandler(uow).handle(
                GenerateWarrantiesCommand(
                    quote_id=quote.id,
                    tenant_id=tenant_id,
                    requester_user_id=other_id,
                    requester_role="OPERATOR",
                )
            )


# ── ListWarrantiesHandler / GetWarrantyHandler ────────────────────────────────


class TestListAndGetWarrantyHandler:
    @pytest.mark.asyncio
    async def test_operator_solo_ve_las_suyas(
        self,
        uow: FakeWarrantyUnitOfWork,
        warranty_repo: FakeWarrantyRepository,
        tenant_id: TenantId,
    ) -> None:
        owner_id = uuid4()
        other_id = uuid4()
        brand = make_brand(tenant_id)
        await uow.brands.save(brand)
        product = make_product(tenant_id, brand.id)
        await uow.products.save(product)
        quote = make_quote(tenant_id, owner_id, product.id)
        await uow.quotes.save(quote)

        await GenerateWarrantiesHandler(uow).handle(
            GenerateWarrantiesCommand(
                quote_id=quote.id,
                tenant_id=tenant_id,
                requester_user_id=owner_id,
                requester_role="OPERATOR",
            )
        )

        as_owner = await ListWarrantiesHandler(warranty_repo).handle(
            ListWarrantiesQuery(
                tenant_id=tenant_id,
                requester_user_id=owner_id,
                requester_role="OPERATOR",
            )
        )
        as_other = await ListWarrantiesHandler(warranty_repo).handle(
            ListWarrantiesQuery(
                tenant_id=tenant_id,
                requester_user_id=other_id,
                requester_role="OPERATOR",
            )
        )
        assert len(as_owner) == 1
        assert len(as_other) == 0

    @pytest.mark.asyncio
    async def test_get_warranty_inexistente_lanza_not_found(
        self, warranty_repo: FakeWarrantyRepository, tenant_id: TenantId
    ) -> None:
        with pytest.raises(NotFoundError):
            await GetWarrantyHandler(warranty_repo).handle(
                GetWarrantyQuery(
                    warranty_id=uuid4(),
                    tenant_id=tenant_id,
                    requester_user_id=uuid4(),
                    requester_role="ADMIN",
                )
            )


# ── SendWarrantiesEmailHandler ────────────────────────────────────────────────


class TestSendWarrantiesEmailHandler:
    @pytest.mark.asyncio
    async def test_envia_email_y_marca_sent_at(
        self,
        uow: FakeWarrantyUnitOfWork,
        quote_repo: FakeQuoteRepository,
        warranty_repo: FakeWarrantyRepository,
        tenant_id: TenantId,
    ) -> None:
        from tests.conftest import FakeUserRepository

        user_id = uuid4()
        brand = make_brand(tenant_id)
        await uow.brands.save(brand)
        product = make_product(tenant_id, brand.id)
        await uow.products.save(product)
        quote = make_quote(tenant_id, user_id, product.id)
        await uow.quotes.save(quote)

        await GenerateWarrantiesHandler(uow).handle(
            GenerateWarrantiesCommand(
                quote_id=quote.id,
                tenant_id=tenant_id,
                requester_user_id=user_id,
                requester_role="OPERATOR",
            )
        )

        now = datetime.now(UTC)
        email_config = UserEmailConfig(
            user_id=user_id,
            tenant_id=str(tenant_id),
            gmail_email="test@gmail.com",
            access_token="tok",
            refresh_token="ref",
            token_expiry=now,
            created_at=now,
            updated_at=now,
        )
        sender = FakeEmailSender()
        handler = SendWarrantiesEmailHandler(
            oauth=FakeGmailOAuthService(),
            email_config_repo=FakeEmailConfigRepository(email_config),
            sender=sender,
            quote_repo=quote_repo,
            warranty_repo=warranty_repo,
            user_repo=FakeUserRepository(),
        )

        await handler.handle(
            SendWarrantiesEmailCommand(
                quote_id=str(quote.id),
                sender_user_id=user_id,
                tenant_id=str(tenant_id),
                recipient_email="cliente@example.com",
                recipient_name=None,
                custom_message=None,
                frontend_base_url="http://localhost:3000",
            )
        )

        assert len(sender.sent_messages) == 1
        assert "Black Silver" in sender.sent_messages[0].html_body
        saved = await warranty_repo.list_by_quote(quote.id, tenant_id)
        assert all(w.sent_at is not None for w in saved)

    @pytest.mark.asyncio
    async def test_sin_gmail_configurado_lanza_error(
        self,
        quote_repo: FakeQuoteRepository,
        warranty_repo: FakeWarrantyRepository,
        tenant_id: TenantId,
    ) -> None:
        from tests.conftest import FakeUserRepository

        handler = SendWarrantiesEmailHandler(
            oauth=FakeGmailOAuthService(),
            email_config_repo=FakeEmailConfigRepository(None),
            sender=FakeEmailSender(),
            quote_repo=quote_repo,
            warranty_repo=warranty_repo,
            user_repo=FakeUserRepository(),
        )
        with pytest.raises(BusinessRuleViolationError, match="Gmail"):
            await handler.handle(
                SendWarrantiesEmailCommand(
                    quote_id=str(uuid4()),
                    sender_user_id=uuid4(),
                    tenant_id=str(tenant_id),
                    recipient_email="cliente@example.com",
                    recipient_name=None,
                    custom_message=None,
                    frontend_base_url="http://localhost:3000",
                )
            )
