"""Tests de use cases del módulo Quotes (CreateQuote, UpdateQuote, estado, permisos).

Usa repositorios en memoria — sin DB, sin FastAPI.
"""

from decimal import Decimal
from types import TracebackType
from typing import Self
from uuid import UUID, uuid4

import pytest

from centy.application.ports.repositories import IQuoteRepository
from centy.application.ports.unit_of_work import IUnitOfWork
from centy.application.quotes.commands import (
    CreateQuoteCommand,
    DeleteQuoteCommand,
    GlassPaneInput,
    QuoteLineInput,
    UpdateQuoteCommand,
    UpdateQuoteStatusCommand,
)
from centy.application.quotes.handlers import (
    CreateQuoteHandler,
    DeleteQuoteHandler,
    GetQuoteHandler,
    UpdateQuoteHandler,
    UpdateQuoteStatusHandler,
)
from centy.application.quotes.queries import GetQuoteQuery
from centy.domain.quotes.entities import Quote
from centy.domain.quotes.value_objects import FilmMode, LocationType, QuoteStatus
from centy.domain.shared.exceptions import AuthorizationError, NotFoundError
from centy.domain.shared.value_objects import TenantId

# ── Fake repo ─────────────────────────────────────────────────────────────────


class FakeQuoteRepository(IQuoteRepository):
    def __init__(self) -> None:
        self._store: dict[UUID, Quote] = {}
        self._seq: int = 0

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
        self._seq += 1
        return self._seq


class FakeQuoteUnitOfWork(IUnitOfWork):
    def __init__(self, repo: FakeQuoteRepository) -> None:
        from tests.conftest import (
            FakeBrandRepository,
            FakeCustomerLabelRepository,
            FakeCustomerRepository,
            FakeGlassTypeRepository,
            FakeProductCategoryRepository,
            FakeProductRepository,
            FakeUserRepository,
        )

        self.users = FakeUserRepository()
        self.customers = FakeCustomerRepository()
        self.customer_labels = FakeCustomerLabelRepository()
        self.brands = FakeBrandRepository()
        self.product_categories = FakeProductCategoryRepository()
        self.glass_types = FakeGlassTypeRepository()
        self.products = FakeProductRepository()
        self.quotes = repo
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


# ── Fixtures ──────────────────────────────────────────────────────────────────


@pytest.fixture
def tenant_id() -> TenantId:
    return TenantId(uuid4())


@pytest.fixture
def quote_repo() -> FakeQuoteRepository:
    return FakeQuoteRepository()


@pytest.fixture
def uow(quote_repo: FakeQuoteRepository) -> FakeQuoteUnitOfWork:
    return FakeQuoteUnitOfWork(repo=quote_repo)


def _pane_input(
    pane_id: str = "v01", location: LocationType = LocationType.SUPERFICIE
) -> GlassPaneInput:
    return GlassPaneInput(
        pane_id=pane_id,
        glass_type_id=None,
        glass_type_name="Monolítico",
        width_cm=Decimal("100"),
        height_cm=Decimal("100"),
        location=location,
        quantity=1,
        notes=None,
        sort_order=0,
    )


def _line_input(
    pane_ids: list[str] | None = None, price: float = 1000.0
) -> QuoteLineInput:
    p = Decimal(str(price))
    return QuoteLineInput(
        product_id=uuid4(),
        product_snapshot={"name": "Film Solar"},
        glass_pane_ids=pane_ids or ["v01"],
        price_per_m2=p,
        surface_m2=Decimal("1.00"),
        subtotal=p,
    )


def _create_cmd(
    tenant_id: TenantId,
    user_id: UUID,
    *,
    tax_pct: Decimal = Decimal("0"),
    discount_pct: Decimal = Decimal("0"),
    travel_cost: Decimal = Decimal("0"),
) -> CreateQuoteCommand:
    return CreateQuoteCommand(
        tenant_id=tenant_id,
        created_by_user_id=user_id,
        customer_id=None,
        customer_snapshot=None,
        film_mode=FilmMode.SINGLE,
        glass_panes=[_pane_input()],
        lines=[_line_input()],
        height_surcharge_pct=Decimal("0"),
        travel_cost=travel_cost,
        discount_pct=discount_pct,
        tax_pct=tax_pct,
        gap_cm=Decimal("3"),
        commercial_conditions="",
        cut_plan_snapshot={},
        valid_until="2026-12-31",
    )


# ── CreateQuoteHandler ────────────────────────────────────────────────────────


class TestCreateQuoteHandler:
    @pytest.mark.asyncio
    async def test_crea_quote_y_asigna_numero(
        self, uow: FakeQuoteUnitOfWork, tenant_id: TenantId
    ) -> None:
        user_id = uuid4()
        result = await CreateQuoteHandler(uow).handle(_create_cmd(tenant_id, user_id))
        assert result.quote_number == "P-0001"
        assert uow.committed is True

    @pytest.mark.asyncio
    async def test_sin_iva_tax_amount_es_cero(
        self, uow: FakeQuoteUnitOfWork, tenant_id: TenantId
    ) -> None:
        result = await CreateQuoteHandler(uow).handle(
            _create_cmd(tenant_id, uuid4(), tax_pct=Decimal("0"))
        )
        assert result.totals.tax_amount == Decimal("0.00")
        assert result.tax_pct == Decimal("0")

    @pytest.mark.asyncio
    async def test_con_iva_21_calcula_correctamente(
        self, uow: FakeQuoteUnitOfWork, tenant_id: TenantId
    ) -> None:
        # materials $1000, IVA 21% → tax $210, total $1210
        result = await CreateQuoteHandler(uow).handle(
            _create_cmd(tenant_id, uuid4(), tax_pct=Decimal("21"))
        )
        assert result.tax_pct == Decimal("21")
        assert result.totals.tax_amount == Decimal("210.00")
        assert result.totals.total == Decimal("1210.00")

    @pytest.mark.asyncio
    async def test_iva_21_con_descuento_10(
        self, uow: FakeQuoteUnitOfWork, tenant_id: TenantId
    ) -> None:
        # subtotal $1000, descuento 10% → taxable $900, IVA 21% → $189, total $1089
        result = await CreateQuoteHandler(uow).handle(
            _create_cmd(
                tenant_id, uuid4(), discount_pct=Decimal("10"), tax_pct=Decimal("21")
            )
        )
        assert result.totals.discount_amount == Decimal("100.00")
        assert result.totals.tax_amount == Decimal("189.00")
        assert result.totals.total == Decimal("1089.00")

    @pytest.mark.asyncio
    async def test_iva_21_con_viaticos(
        self, uow: FakeQuoteUnitOfWork, tenant_id: TenantId
    ) -> None:
        # materials $1000 + travel $500 = $1500, IVA 21% → $315, total $1815
        result = await CreateQuoteHandler(uow).handle(
            _create_cmd(
                tenant_id, uuid4(), travel_cost=Decimal("500"), tax_pct=Decimal("21")
            )
        )
        assert result.totals.subtotal == Decimal("1500.00")
        assert result.totals.tax_amount == Decimal("315.00")
        assert result.totals.total == Decimal("1815.00")

    @pytest.mark.asyncio
    async def test_numeros_se_incrementan_por_usuario(
        self, uow: FakeQuoteUnitOfWork, tenant_id: TenantId
    ) -> None:
        user_id = uuid4()
        r1 = await CreateQuoteHandler(uow).handle(_create_cmd(tenant_id, user_id))
        r2 = await CreateQuoteHandler(uow).handle(_create_cmd(tenant_id, user_id))
        assert r1.quote_number == "P-0001"
        assert r2.quote_number == "P-0002"


# ── GetQuoteHandler ───────────────────────────────────────────────────────────


class TestGetQuoteHandler:
    @pytest.mark.asyncio
    async def test_owner_puede_ver_su_quote(
        self,
        uow: FakeQuoteUnitOfWork,
        quote_repo: FakeQuoteRepository,
        tenant_id: TenantId,
    ) -> None:
        user_id = uuid4()
        created = await CreateQuoteHandler(uow).handle(_create_cmd(tenant_id, user_id))
        result = await GetQuoteHandler(quote_repo).handle(
            GetQuoteQuery(
                quote_id=UUID(created.quote_id),
                tenant_id=tenant_id,
                requester_user_id=user_id,
                requester_role="OPERATOR",
            )
        )
        assert result.quote_id == created.quote_id

    @pytest.mark.asyncio
    async def test_admin_puede_ver_cualquier_quote(
        self,
        uow: FakeQuoteUnitOfWork,
        quote_repo: FakeQuoteRepository,
        tenant_id: TenantId,
    ) -> None:
        owner_id = uuid4()
        admin_id = uuid4()
        created = await CreateQuoteHandler(uow).handle(_create_cmd(tenant_id, owner_id))
        result = await GetQuoteHandler(quote_repo).handle(
            GetQuoteQuery(
                quote_id=UUID(created.quote_id),
                tenant_id=tenant_id,
                requester_user_id=admin_id,
                requester_role="ADMIN",
            )
        )
        assert result.quote_id == created.quote_id

    @pytest.mark.asyncio
    async def test_otro_operator_no_puede_ver(
        self,
        uow: FakeQuoteUnitOfWork,
        quote_repo: FakeQuoteRepository,
        tenant_id: TenantId,
    ) -> None:
        owner_id = uuid4()
        other_id = uuid4()
        created = await CreateQuoteHandler(uow).handle(_create_cmd(tenant_id, owner_id))
        with pytest.raises(AuthorizationError):
            await GetQuoteHandler(quote_repo).handle(
                GetQuoteQuery(
                    quote_id=UUID(created.quote_id),
                    tenant_id=tenant_id,
                    requester_user_id=other_id,
                    requester_role="OPERATOR",
                )
            )

    @pytest.mark.asyncio
    async def test_quote_inexistente_lanza_not_found(
        self, quote_repo: FakeQuoteRepository, tenant_id: TenantId
    ) -> None:
        with pytest.raises(NotFoundError):
            await GetQuoteHandler(quote_repo).handle(
                GetQuoteQuery(
                    quote_id=uuid4(),
                    tenant_id=tenant_id,
                    requester_user_id=uuid4(),
                    requester_role="ADMIN",
                )
            )


# ── UpdateQuoteStatusHandler ──────────────────────────────────────────────────


class TestUpdateQuoteStatusHandler:
    @pytest.mark.asyncio
    async def test_draft_a_sent(
        self, uow: FakeQuoteUnitOfWork, tenant_id: TenantId
    ) -> None:
        user_id = uuid4()
        created = await CreateQuoteHandler(uow).handle(_create_cmd(tenant_id, user_id))
        result = await UpdateQuoteStatusHandler(uow).handle(
            UpdateQuoteStatusCommand(
                quote_id=UUID(created.quote_id),
                tenant_id=tenant_id,
                requester_user_id=user_id,
                requester_role="OPERATOR",
                new_status=QuoteStatus.SENT,
            )
        )
        assert result.status == QuoteStatus.SENT.value

    @pytest.mark.asyncio
    async def test_flujo_completo_draft_sent_accepted_invoiced(
        self, uow: FakeQuoteUnitOfWork, tenant_id: TenantId
    ) -> None:
        user_id = uuid4()
        created = await CreateQuoteHandler(uow).handle(_create_cmd(tenant_id, user_id))
        qid = UUID(created.quote_id)

        for new_status, expected in [
            (QuoteStatus.SENT, "SENT"),
            (QuoteStatus.ACCEPTED, "ACCEPTED"),
            (QuoteStatus.INVOICED, "INVOICED"),
        ]:
            result = await UpdateQuoteStatusHandler(uow).handle(
                UpdateQuoteStatusCommand(
                    quote_id=qid,
                    tenant_id=tenant_id,
                    requester_user_id=user_id,
                    requester_role="OPERATOR",
                    new_status=new_status,
                )
            )
            assert result.status == expected

    @pytest.mark.asyncio
    async def test_operator_ajeno_no_puede_cambiar_estado(
        self, uow: FakeQuoteUnitOfWork, tenant_id: TenantId
    ) -> None:
        owner_id = uuid4()
        other_id = uuid4()
        created = await CreateQuoteHandler(uow).handle(_create_cmd(tenant_id, owner_id))
        with pytest.raises(AuthorizationError):
            await UpdateQuoteStatusHandler(uow).handle(
                UpdateQuoteStatusCommand(
                    quote_id=UUID(created.quote_id),
                    tenant_id=tenant_id,
                    requester_user_id=other_id,
                    requester_role="OPERATOR",
                    new_status=QuoteStatus.SENT,
                )
            )


# ── UpdateQuoteHandler ────────────────────────────────────────────────────────


class TestUpdateQuoteHandler:
    def _update_cmd(
        self,
        quote_id: UUID,
        tenant_id: TenantId,
        user_id: UUID,
        role: str = "OPERATOR",
        *,
        tax_pct: Decimal = Decimal("21"),
    ) -> UpdateQuoteCommand:
        return UpdateQuoteCommand(
            quote_id=quote_id,
            tenant_id=tenant_id,
            requester_user_id=user_id,
            requester_role=role,
            customer_id=None,
            customer_snapshot=None,
            film_mode=FilmMode.SINGLE,
            glass_panes=[_pane_input()],
            lines=[_line_input()],
            height_surcharge_pct=Decimal("0"),
            travel_cost=Decimal("0"),
            discount_pct=Decimal("0"),
            tax_pct=tax_pct,
            gap_cm=Decimal("3"),
            commercial_conditions="",
            cut_plan_snapshot={},
            valid_until="2026-12-31",
        )

    @pytest.mark.asyncio
    async def test_actualiza_tax_pct(
        self, uow: FakeQuoteUnitOfWork, tenant_id: TenantId
    ) -> None:
        user_id = uuid4()
        created = await CreateQuoteHandler(uow).handle(
            _create_cmd(tenant_id, user_id, tax_pct=Decimal("0"))
        )
        updated = await UpdateQuoteHandler(uow).handle(
            self._update_cmd(
                UUID(created.quote_id), tenant_id, user_id, tax_pct=Decimal("21")
            )
        )
        assert updated.tax_pct == Decimal("21")
        assert updated.totals.tax_amount == Decimal("210.00")

    @pytest.mark.asyncio
    async def test_invoiced_no_se_puede_editar(
        self, uow: FakeQuoteUnitOfWork, tenant_id: TenantId
    ) -> None:
        user_id = uuid4()
        created = await CreateQuoteHandler(uow).handle(_create_cmd(tenant_id, user_id))
        qid = UUID(created.quote_id)
        for status in [QuoteStatus.SENT, QuoteStatus.ACCEPTED, QuoteStatus.INVOICED]:
            await UpdateQuoteStatusHandler(uow).handle(
                UpdateQuoteStatusCommand(
                    quote_id=qid,
                    tenant_id=tenant_id,
                    requester_user_id=user_id,
                    requester_role="OPERATOR",
                    new_status=status,
                )
            )
        from centy.domain.shared.exceptions import DomainError

        with pytest.raises(DomainError, match="facturado"):
            await UpdateQuoteHandler(uow).handle(
                self._update_cmd(qid, tenant_id, user_id)
            )


# ── DeleteQuoteHandler ────────────────────────────────────────────────────────


class TestDeleteQuoteHandler:
    @pytest.mark.asyncio
    async def test_elimina_quote_propio(
        self,
        uow: FakeQuoteUnitOfWork,
        quote_repo: FakeQuoteRepository,
        tenant_id: TenantId,
    ) -> None:
        user_id = uuid4()
        created = await CreateQuoteHandler(uow).handle(_create_cmd(tenant_id, user_id))
        qid = UUID(created.quote_id)
        await DeleteQuoteHandler(uow).handle(
            DeleteQuoteCommand(
                quote_id=qid,
                tenant_id=tenant_id,
                requester_user_id=user_id,
                requester_role="OPERATOR",
            )
        )
        assert await quote_repo.get_by_id(qid, tenant_id) is None

    @pytest.mark.asyncio
    async def test_operator_ajeno_no_puede_eliminar(
        self, uow: FakeQuoteUnitOfWork, tenant_id: TenantId
    ) -> None:
        owner_id = uuid4()
        other_id = uuid4()
        created = await CreateQuoteHandler(uow).handle(_create_cmd(tenant_id, owner_id))
        with pytest.raises(AuthorizationError):
            await DeleteQuoteHandler(uow).handle(
                DeleteQuoteCommand(
                    quote_id=UUID(created.quote_id),
                    tenant_id=tenant_id,
                    requester_user_id=other_id,
                    requester_role="OPERATOR",
                )
            )
