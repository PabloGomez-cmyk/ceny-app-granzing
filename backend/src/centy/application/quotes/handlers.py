from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from centy.application.ports.repositories import IQuoteRepository
from centy.application.ports.unit_of_work import IUnitOfWork
from centy.application.quotes.commands import (
    CreateQuoteCommand,
    DeleteQuoteCommand,
    QuoteLineInput,
    UpdateQuoteCommand,
    UpdateQuoteStatusCommand,
)
from centy.application.quotes.queries import (
    GetQuoteQuery,
    GetQuoteStatsQuery,
    ListQuotesQuery,
)
from centy.domain.quotes.entities import GlassPane, Quote, QuoteLine
from centy.domain.quotes.services import QuoteCalculator
from centy.domain.quotes.value_objects import QuoteStatus
from centy.domain.shared.exceptions import AuthorizationError, NotFoundError
from centy.domain.shared.value_objects import TenantId

# ── Result dataclasses ────────────────────────────────────────────────────────


@dataclass(frozen=True)
class GlassPaneResult:
    pane_id: str
    glass_type_id: str | None
    glass_type_name: str
    width_cm: Decimal
    height_cm: Decimal
    location: str
    quantity: int
    notes: str | None
    sort_order: int
    surface_m2: Decimal


@dataclass(frozen=True)
class QuoteLineResult:
    line_id: str
    product_id: str
    product_snapshot: dict[str, Any]
    glass_pane_ids: list[str]
    price_per_m2: Decimal
    subtotal: Decimal
    surface_m2: Decimal | None
    quantity: Decimal | None


@dataclass(frozen=True)
class QuoteTotalsResult:
    materials_subtotal: Decimal
    height_surcharge: Decimal
    travel_cost: Decimal
    subtotal: Decimal
    discount_amount: Decimal
    tax_amount: Decimal
    total: Decimal


@dataclass(frozen=True)
class QuoteResult:
    quote_id: str
    tenant_id: str
    created_by_user_id: str
    quote_number: str
    customer_id: str | None
    customer_snapshot: dict[str, Any] | None
    status: str
    sale_type: str
    film_mode: str
    glass_panes: list[GlassPaneResult]
    lines: list[QuoteLineResult]
    height_surcharge_pct: Decimal
    travel_cost: Decimal
    discount_pct: Decimal
    tax_pct: Decimal
    gap_cm: Decimal
    commercial_conditions: str
    cut_plan_snapshot: dict[str, Any]
    valid_until: str
    totals: QuoteTotalsResult
    total_margin: Decimal | None
    has_altura: bool
    created_at: str


# ── Mappers ───────────────────────────────────────────────────────────────────

_calculator = QuoteCalculator()


def _pane_result(p: GlassPane) -> GlassPaneResult:
    return GlassPaneResult(
        pane_id=p.pane_id,
        glass_type_id=str(p.glass_type_id) if p.glass_type_id else None,
        glass_type_name=p.glass_type_name,
        width_cm=p.width_cm,
        height_cm=p.height_cm,
        location=p.location.value,
        quantity=p.quantity,
        notes=p.notes,
        sort_order=p.sort_order,
        surface_m2=p.surface_m2,
    )


def _line_result(line: QuoteLine) -> QuoteLineResult:
    return QuoteLineResult(
        line_id=str(line.line_id),
        product_id=str(line.product_id),
        product_snapshot=line.product_snapshot,
        glass_pane_ids=line.glass_pane_ids,
        price_per_m2=line.price_per_m2,
        subtotal=line.subtotal,
        surface_m2=line.surface_m2,
        quantity=line.quantity,
    )


def _quote_result(q: Quote) -> QuoteResult:
    """Construye el DTO de respuesta, incluido total_margin.

    PRECAUCIÓN: total_margin se calcula siempre acá, sin gating explícito de
    rol — el invariante "solo el dueño o el admin llegan a construir un
    QuoteResult" hoy lo garantizan los call-sites (Create: el creador es el
    dueño; Get/Update/UpdateStatus: gateados por _can_access antes de llegar
    acá; List: ya filtra por owner). Si se agrega un caller nuevo que NO
    verifique acceso antes de invocar esta función, el margen se filtraría
    sin que nada lo marque — ver test de contrato en test_quote_handlers.py.
    """
    totals = _calculator.calculate(q)
    return QuoteResult(
        quote_id=str(q.id),
        tenant_id=str(q.tenant_id),
        created_by_user_id=str(q.created_by_user_id),
        quote_number=q.quote_number,
        customer_id=str(q.customer_id) if q.customer_id else None,
        customer_snapshot=q.customer_snapshot,
        status=q.status.value,
        sale_type=q.sale_type.value,
        film_mode=q.film_mode.value,
        glass_panes=[_pane_result(p) for p in q.glass_panes],
        lines=[_line_result(line) for line in q.lines],
        height_surcharge_pct=q.height_surcharge_pct,
        travel_cost=q.travel_cost,
        discount_pct=q.discount_pct,
        tax_pct=q.tax_pct,
        gap_cm=q.gap_cm,
        commercial_conditions=q.commercial_conditions,
        cut_plan_snapshot=q.cut_plan_snapshot,
        valid_until=q.valid_until,
        totals=QuoteTotalsResult(
            materials_subtotal=totals.materials_subtotal,
            height_surcharge=totals.height_surcharge,
            travel_cost=totals.travel_cost,
            subtotal=totals.subtotal,
            discount_amount=totals.discount_amount,
            tax_amount=totals.tax_amount,
            total=totals.total,
        ),
        total_margin=_calculator.calculate_margin(q),
        has_altura=q.has_altura_panes,
        created_at=q.created_at.isoformat(),
    )


def _build_quote_number(seq: int) -> str:
    return f"P-{seq:04d}"


def _can_access(quote: Quote, user_id: UUID, role: str) -> bool:
    return role == "ADMIN" or quote.created_by_user_id == user_id


async def _build_lines_with_cost_snapshot(
    uow: IUnitOfWork,
    tenant_id: TenantId,
    owner_user_id: UUID,
    line_inputs: list[QuoteLineInput],
) -> list[QuoteLine]:
    """Construye las QuoteLine snapshoteando el costo efectivo del operador.

    Nunca confía en un purchase_price_per_m2 que venga del cliente dentro de
    product_snapshot — siempre lo sobreescribe con el costo real (override
    del operador dueño de la venta, o default de catálogo) al momento de
    guardar, igual que ya se hace con nombre/specs del producto.
    """
    lines: list[QuoteLine] = []
    for line in line_inputs:
        product = await uow.products.get_by_id(line.product_id, tenant_id)
        if product is None:
            raise NotFoundError(f"Producto {line.product_id} no encontrado")
        override = await uow.price_list_items.get_by_user_and_product(
            owner_user_id, line.product_id, tenant_id
        )
        is_unit_line = line.quantity is not None
        if is_unit_line:
            effective_cost = (
                override.purchase_price_per_unit.amount
                if override and override.purchase_price_per_unit is not None
                else product.purchase_price_per_unit.amount
            )
            snapshot_key = "purchase_price_per_unit"
        else:
            effective_cost = (
                override.purchase_price.amount
                if override and override.purchase_price is not None
                else product.purchase_price_per_m2.amount
            )
            snapshot_key = "purchase_price_per_m2"
        snapshot = {
            **line.product_snapshot,
            snapshot_key: str(effective_cost),
        }
        lines.append(
            QuoteLine(
                product_id=line.product_id,
                product_snapshot=snapshot,
                glass_pane_ids=line.glass_pane_ids,
                price_per_m2=line.price_per_m2,
                subtotal=line.subtotal,
                surface_m2=line.surface_m2,
                quantity=line.quantity,
            )
        )
    return lines


# ── Handlers ──────────────────────────────────────────────────────────────────


class CreateQuoteHandler:
    def __init__(self, uow: IUnitOfWork) -> None:
        self._uow = uow

    async def handle(self, command: CreateQuoteCommand) -> QuoteResult:
        async with self._uow as uow:
            seq = await uow.quotes.next_sequence(
                command.tenant_id, command.created_by_user_id
            )
            quote_number = _build_quote_number(seq)

            glass_panes = [
                GlassPane(
                    pane_id=p.pane_id,
                    glass_type_id=p.glass_type_id,
                    glass_type_name=p.glass_type_name,
                    width_cm=p.width_cm,
                    height_cm=p.height_cm,
                    location=p.location,
                    quantity=p.quantity,
                    notes=p.notes,
                    sort_order=p.sort_order,
                )
                for p in command.glass_panes
            ]

            lines = await _build_lines_with_cost_snapshot(
                uow, command.tenant_id, command.created_by_user_id, command.lines
            )

            quote = Quote.create(
                tenant_id=command.tenant_id,
                created_by_user_id=command.created_by_user_id,
                quote_number=quote_number,
                customer_id=command.customer_id,
                customer_snapshot=command.customer_snapshot,
                sale_type=command.sale_type,
                film_mode=command.film_mode,
                glass_panes=glass_panes,
                lines=lines,
                height_surcharge_pct=command.height_surcharge_pct,
                travel_cost=command.travel_cost,
                discount_pct=command.discount_pct,
                tax_pct=command.tax_pct,
                gap_cm=command.gap_cm,
                commercial_conditions=command.commercial_conditions,
                cut_plan_snapshot=command.cut_plan_snapshot,
                valid_until=command.valid_until,
            )

            await uow.quotes.save(quote)
            await uow.commit()

        return _quote_result(quote)


class GetQuoteHandler:
    def __init__(self, repo: IQuoteRepository) -> None:
        self._repo = repo

    async def handle(self, query: GetQuoteQuery) -> QuoteResult:
        quote = await self._repo.get_by_id(query.quote_id, query.tenant_id)
        if quote is None:
            raise NotFoundError(f"Presupuesto {query.quote_id} no encontrado")
        if not _can_access(quote, query.requester_user_id, query.requester_role):
            raise AuthorizationError("No tiene permiso para ver este presupuesto")
        return _quote_result(quote)


class ListQuotesHandler:
    def __init__(self, repo: IQuoteRepository) -> None:
        self._repo = repo

    async def handle(self, query: ListQuotesQuery) -> list[QuoteResult]:
        quotes = await self._repo.list_by_user(query.requester_user_id, query.tenant_id)
        return [_quote_result(q) for q in quotes]


class UpdateQuoteStatusHandler:
    def __init__(self, uow: IUnitOfWork) -> None:
        self._uow = uow

    async def handle(self, command: UpdateQuoteStatusCommand) -> QuoteResult:
        async with self._uow as uow:
            quote = await uow.quotes.get_by_id(command.quote_id, command.tenant_id)
            if quote is None:
                raise NotFoundError(f"Presupuesto {command.quote_id} no encontrado")
            if not _can_access(
                quote, command.requester_user_id, command.requester_role
            ):
                raise AuthorizationError(
                    "No tiene permiso para modificar este presupuesto"
                )

            # Cambio de estado manual y arbitrario — permite corregir errores
            # de operador (ej. avanzar sin querer a COMPLETED) moviéndose a
            # cualquier estado, incluso "hacia atrás". Ver Quote.set_status.
            quote.set_status(command.new_status)

            await uow.quotes.save(quote)
            await uow.commit()

        return _quote_result(quote)


class UpdateQuoteHandler:
    def __init__(self, uow: IUnitOfWork) -> None:
        self._uow = uow

    async def handle(self, command: UpdateQuoteCommand) -> QuoteResult:
        async with self._uow as uow:
            quote = await uow.quotes.get_by_id(command.quote_id, command.tenant_id)
            if quote is None:
                raise NotFoundError(f"Presupuesto {command.quote_id} no encontrado")
            if not _can_access(
                quote, command.requester_user_id, command.requester_role
            ):
                raise AuthorizationError(
                    "No tiene permiso para editar este presupuesto"
                )
            if quote.status in (QuoteStatus.INVOICED, QuoteStatus.COMPLETED):
                from centy.domain.shared.exceptions import DomainError

                raise DomainError("No se puede editar un presupuesto ya facturado")

            glass_panes = [
                GlassPane(
                    pane_id=p.pane_id,
                    glass_type_id=p.glass_type_id,
                    glass_type_name=p.glass_type_name,
                    width_cm=p.width_cm,
                    height_cm=p.height_cm,
                    location=p.location,
                    quantity=p.quantity,
                    notes=p.notes,
                    sort_order=p.sort_order,
                )
                for p in command.glass_panes
            ]
            lines = await _build_lines_with_cost_snapshot(
                uow, command.tenant_id, quote.created_by_user_id, command.lines
            )

            # sale_type es inmutable tras la creación — se ignora lo que
            # venga en el command y se conserva el valor ya persistido, ya
            # que arquitectura (vidrios/plan de cortes) y automotriz (líneas
            # simples) son flujos incompatibles entre sí.
            updated = Quote(
                id=quote.id,
                tenant_id=quote.tenant_id,
                created_by_user_id=quote.created_by_user_id,
                quote_number=quote.quote_number,
                customer_id=command.customer_id,
                customer_snapshot=command.customer_snapshot,
                status=quote.status,
                sale_type=quote.sale_type,
                film_mode=command.film_mode,
                glass_panes=glass_panes,
                lines=lines,
                height_surcharge_pct=command.height_surcharge_pct,
                travel_cost=command.travel_cost,
                discount_pct=command.discount_pct,
                tax_pct=command.tax_pct,
                gap_cm=command.gap_cm,
                commercial_conditions=command.commercial_conditions,
                cut_plan_snapshot=command.cut_plan_snapshot,
                valid_until=command.valid_until,
                created_at=quote.created_at,
            )

            await uow.quotes.save(updated)
            await uow.commit()

        return _quote_result(updated)


class DeleteQuoteHandler:
    def __init__(self, uow: IUnitOfWork) -> None:
        self._uow = uow

    async def handle(self, command: DeleteQuoteCommand) -> None:
        async with self._uow as uow:
            quote = await uow.quotes.get_by_id(command.quote_id, command.tenant_id)
            if quote is None:
                raise NotFoundError(f"Presupuesto {command.quote_id} no encontrado")
            if not _can_access(
                quote, command.requester_user_id, command.requester_role
            ):
                raise AuthorizationError(
                    "No tiene permiso para eliminar este presupuesto"
                )
            await uow.quotes.delete(command.quote_id, command.tenant_id)
            await uow.commit()


# ── Quote stats ───────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class UserQuoteStatResult:
    user_id: str
    total_quotes: int
    quotes_this_month: int
    conversion_rate: float
    total_revenue: Decimal
    revenue_this_month: Decimal


@dataclass(frozen=True)
class QuoteStatsResult:
    quotes_this_month: int
    total_quotes: int
    conversion_rate: float
    total_revenue: Decimal
    revenue_this_month: Decimal
    per_user: list[UserQuoteStatResult]


def _conversion(quotes: list[Quote]) -> float:
    non_cancelled = [q for q in quotes if q.status != QuoteStatus.CANCELLED]
    converted = [
        q
        for q in non_cancelled
        if q.status
        in (QuoteStatus.ACCEPTED, QuoteStatus.INVOICED, QuoteStatus.COMPLETED)
    ]
    return round(len(converted) / len(non_cancelled) * 100, 1) if non_cancelled else 0.0


def _revenue(quotes: list[Quote]) -> Decimal:
    closed = (
        q
        for q in quotes
        if q.status
        in (QuoteStatus.ACCEPTED, QuoteStatus.INVOICED, QuoteStatus.COMPLETED)
    )
    return sum((_calculator.calculate(q).total for q in closed), Decimal("0"))


class GetQuoteStatsHandler:
    def __init__(self, repo: IQuoteRepository) -> None:
        self._repo = repo

    async def handle(self, query: GetQuoteStatsQuery) -> QuoteStatsResult:
        quotes = await self._repo.list_by_tenant(query.tenant_id)

        now = datetime.now(UTC)
        first_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        def is_this_month(q: Quote) -> bool:
            ts = q.created_at
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=UTC)
            return ts >= first_of_month

        quotes_this_month = sum(1 for q in quotes if is_this_month(q))

        # Desglose por usuario
        by_user: dict[str, list[Quote]] = {}
        for q in quotes:
            uid = str(q.created_by_user_id)
            by_user.setdefault(uid, []).append(q)

        per_user = [
            UserQuoteStatResult(
                user_id=uid,
                total_quotes=len(uq),
                quotes_this_month=sum(1 for q in uq if is_this_month(q)),
                conversion_rate=_conversion(uq),
                total_revenue=_revenue(uq),
                revenue_this_month=_revenue([q for q in uq if is_this_month(q)]),
            )
            for uid, uq in by_user.items()
        ]

        return QuoteStatsResult(
            quotes_this_month=quotes_this_month,
            total_quotes=len(quotes),
            conversion_rate=_conversion(quotes),
            total_revenue=_revenue(quotes),
            revenue_this_month=_revenue([q for q in quotes if is_this_month(q)]),
            per_user=per_user,
        )
