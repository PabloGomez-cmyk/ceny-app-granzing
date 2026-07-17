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
    GetQuoteStatsHandler,
    UpdateQuoteHandler,
    UpdateQuoteStatusHandler,
)
from centy.application.quotes.queries import GetQuoteQuery, GetQuoteStatsQuery
from centy.domain.catalog.entities import Product
from centy.domain.pricing.entities import PriceListItem
from centy.domain.quotes.entities import Quote
from centy.domain.quotes.value_objects import (
    FilmMode,
    LocationType,
    QuoteStatus,
    SaleType,
)
from centy.domain.shared.exceptions import AuthorizationError, NotFoundError
from centy.domain.shared.value_objects import TenantId

DEFAULT_PRODUCT_ID = uuid4()
DEFAULT_PURCHASE_PRICE = Decimal("600.00")

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
            FakePriceListItemRepository,
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
        self.price_list_items = FakePriceListItemRepository()
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
def uow(quote_repo: FakeQuoteRepository, tenant_id: TenantId) -> FakeQuoteUnitOfWork:
    u = FakeQuoteUnitOfWork(repo=quote_repo)
    product = Product.create(
        tenant_id=tenant_id,
        name="Film Solar Test",
        brand_id=uuid4(),
        sale_price_per_m2=Decimal("1000.00"),
        purchase_price_per_m2=DEFAULT_PURCHASE_PRICE,
        uv_percentage=Decimal("90"),
        irr_percentage=Decimal("70"),
        tser_percentage=Decimal("50"),
        warranty_years=5,
        category_id=uuid4(),
        application_types=["WINDOW"],
    )
    product.id = DEFAULT_PRODUCT_ID
    u.products._store[product.id] = product  # type: ignore[attr-defined]
    return u


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
    pane_ids: list[str] | None = None,
    price: float = 1000.0,
    product_id: UUID | None = None,
    product_snapshot: dict | None = None,
) -> QuoteLineInput:
    p = Decimal(str(price))
    return QuoteLineInput(
        product_id=product_id or DEFAULT_PRODUCT_ID,
        product_snapshot=product_snapshot or {"name": "Film Solar"},
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
    sale_type: SaleType = SaleType.ARCHITECTURE,
    glass_panes: list[GlassPaneInput] | None = None,
) -> CreateQuoteCommand:
    return CreateQuoteCommand(
        tenant_id=tenant_id,
        created_by_user_id=user_id,
        customer_id=None,
        customer_snapshot=None,
        sale_type=sale_type,
        film_mode=FilmMode.SINGLE,
        glass_panes=[_pane_input()] if glass_panes is None else glass_panes,
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
    async def test_crea_quote_automotriz_sin_vidrios(
        self, uow: FakeQuoteUnitOfWork, tenant_id: TenantId
    ) -> None:
        result = await CreateQuoteHandler(uow).handle(
            _create_cmd(
                tenant_id, uuid4(), sale_type=SaleType.AUTOMOTIVE, glass_panes=[]
            )
        )
        assert result.sale_type == "AUTOMOTIVE"
        assert result.glass_panes == []
        assert result.totals.total == Decimal("1000.00")

    @pytest.mark.asyncio
    async def test_arquitectura_sin_vidrios_sigue_fallando(
        self, uow: FakeQuoteUnitOfWork, tenant_id: TenantId
    ) -> None:
        from centy.domain.shared.exceptions import BusinessRuleViolationError

        with pytest.raises(BusinessRuleViolationError, match="vidrio"):
            await CreateQuoteHandler(uow).handle(
                _create_cmd(
                    tenant_id,
                    uuid4(),
                    sale_type=SaleType.ARCHITECTURE,
                    glass_panes=[],
                )
            )

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
        sale_type: SaleType = SaleType.ARCHITECTURE,
    ) -> UpdateQuoteCommand:
        return UpdateQuoteCommand(
            quote_id=quote_id,
            tenant_id=tenant_id,
            requester_user_id=user_id,
            requester_role=role,
            customer_id=None,
            customer_snapshot=None,
            sale_type=sale_type,
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
    async def test_update_no_puede_cambiar_sale_type(
        self, uow: FakeQuoteUnitOfWork, tenant_id: TenantId
    ) -> None:
        user_id = uuid4()
        created = await CreateQuoteHandler(uow).handle(
            _create_cmd(
                tenant_id, user_id, sale_type=SaleType.AUTOMOTIVE, glass_panes=[]
            )
        )
        updated = await UpdateQuoteHandler(uow).handle(
            self._update_cmd(
                UUID(created.quote_id),
                tenant_id,
                user_id,
                sale_type=SaleType.ARCHITECTURE,
            )
        )
        assert updated.sale_type == "AUTOMOTIVE"

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


# ── GetQuoteStatsHandler ──────────────────────────────────────────────────────


class TestGetQuoteStatsHandler:
    @pytest.mark.asyncio
    async def test_agrega_revenue_total_y_por_usuario(
        self,
        uow: FakeQuoteUnitOfWork,
        quote_repo: FakeQuoteRepository,
        tenant_id: TenantId,
    ) -> None:
        user_a = uuid4()
        user_b = uuid4()

        # user_a: una quote aceptada ($1000) y una cancelada (no cuenta)
        accepted = await CreateQuoteHandler(uow).handle(_create_cmd(tenant_id, user_a))
        await UpdateQuoteStatusHandler(uow).handle(
            UpdateQuoteStatusCommand(
                quote_id=UUID(accepted.quote_id),
                tenant_id=tenant_id,
                requester_user_id=user_a,
                requester_role="OPERATOR",
                new_status=QuoteStatus.SENT,
            )
        )
        await UpdateQuoteStatusHandler(uow).handle(
            UpdateQuoteStatusCommand(
                quote_id=UUID(accepted.quote_id),
                tenant_id=tenant_id,
                requester_user_id=user_a,
                requester_role="OPERATOR",
                new_status=QuoteStatus.ACCEPTED,
            )
        )
        cancelled = await CreateQuoteHandler(uow).handle(_create_cmd(tenant_id, user_a))
        await UpdateQuoteStatusHandler(uow).handle(
            UpdateQuoteStatusCommand(
                quote_id=UUID(cancelled.quote_id),
                tenant_id=tenant_id,
                requester_user_id=user_a,
                requester_role="OPERATOR",
                new_status=QuoteStatus.CANCELLED,
            )
        )

        # user_b: una quote en DRAFT (no cuenta como revenue)
        await CreateQuoteHandler(uow).handle(_create_cmd(tenant_id, user_b))

        result = await GetQuoteStatsHandler(quote_repo).handle(
            GetQuoteStatsQuery(tenant_id=tenant_id)
        )

        assert result.total_quotes == 3
        assert result.total_revenue == Decimal("1000.00")
        assert result.revenue_this_month == Decimal("1000.00")

        by_user = {u.user_id: u for u in result.per_user}
        assert by_user[str(user_a)].total_revenue == Decimal("1000.00")
        assert by_user[str(user_b)].total_revenue == Decimal("0")


# ── Margen (costo snapshoteado + total_margin) ───────────────────────────────


class TestQuoteMargin:
    @pytest.mark.asyncio
    async def test_snapshotea_costo_del_catalogo_al_crear(
        self, uow: FakeQuoteUnitOfWork, tenant_id: TenantId
    ) -> None:
        # precio venta 1000, costo catálogo 600, 1m² → margen 400
        result = await CreateQuoteHandler(uow).handle(_create_cmd(tenant_id, uuid4()))
        assert result.total_margin == Decimal("400.00")

    @pytest.mark.asyncio
    async def test_ignora_costo_inyectado_por_el_cliente(
        self, uow: FakeQuoteUnitOfWork, tenant_id: TenantId
    ) -> None:
        # el cliente intenta mandar un costo falso (0) para inflar el margen
        # — el backend debe ignorarlo y usar el costo real del catálogo (600)
        cmd = _create_cmd(tenant_id, uuid4())
        cmd = CreateQuoteCommand(
            **{
                **cmd.__dict__,
                "lines": [
                    _line_input(
                        product_snapshot={
                            "name": "Film Solar",
                            "purchase_price_per_m2": "0",
                        }
                    )
                ],
            }
        )
        result = await CreateQuoteHandler(uow).handle(cmd)
        assert result.total_margin == Decimal("400.00")
        assert result.lines[0].product_snapshot["purchase_price_per_m2"] == "600.00"

    @pytest.mark.asyncio
    async def test_usa_override_de_price_list_del_operador(
        self, uow: FakeQuoteUnitOfWork, tenant_id: TenantId
    ) -> None:
        user_id = uuid4()
        override = PriceListItem.create(
            tenant_id=tenant_id,
            user_id=user_id,
            product_id=DEFAULT_PRODUCT_ID,
            purchase_price=Decimal("200.00"),
        )
        await uow.price_list_items.save(override)

        result = await CreateQuoteHandler(uow).handle(_create_cmd(tenant_id, user_id))
        # precio venta 1000, costo override 200 (no el 600 del catálogo) → margen 800
        assert result.total_margin == Decimal("800.00")

    @pytest.mark.asyncio
    async def test_producto_inexistente_lanza_not_found(
        self, uow: FakeQuoteUnitOfWork, tenant_id: TenantId
    ) -> None:
        cmd = _create_cmd(tenant_id, uuid4())
        cmd = CreateQuoteCommand(
            **{**cmd.__dict__, "lines": [_line_input(product_id=uuid4())]}
        )
        with pytest.raises(NotFoundError):
            await CreateQuoteHandler(uow).handle(cmd)

    @pytest.mark.asyncio
    @pytest.mark.parametrize("handler_name", ["get", "update_status"])
    async def test_no_owner_no_admin_nunca_recibe_quote_result(
        self,
        handler_name: str,
        uow: FakeQuoteUnitOfWork,
        quote_repo: FakeQuoteRepository,
        tenant_id: TenantId,
    ) -> None:
        """Contrato: _quote_result (y por lo tanto total_margin) solo se

        construye para el dueño del presupuesto o el admin. Este test fija
        ese invariante para Get y UpdateStatus — si se rompe, total_margin
        se filtraría a un usuario sin permiso (ver comentario en
        application/quotes/handlers.py::_quote_result).
        """
        owner_id = uuid4()
        other_id = uuid4()
        created = await CreateQuoteHandler(uow).handle(_create_cmd(tenant_id, owner_id))

        with pytest.raises(AuthorizationError):
            if handler_name == "get":
                await GetQuoteHandler(quote_repo).handle(
                    GetQuoteQuery(
                        quote_id=UUID(created.quote_id),
                        tenant_id=tenant_id,
                        requester_user_id=other_id,
                        requester_role="OPERATOR",
                    )
                )
            else:
                await UpdateQuoteStatusHandler(uow).handle(
                    UpdateQuoteStatusCommand(
                        quote_id=UUID(created.quote_id),
                        tenant_id=tenant_id,
                        requester_user_id=other_id,
                        requester_role="OPERATOR",
                        new_status=QuoteStatus.SENT,
                    )
                )
