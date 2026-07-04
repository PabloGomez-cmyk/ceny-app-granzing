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
    surface_m2: Decimal
    subtotal: Decimal


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
        surface_m2=line.surface_m2,
        subtotal=line.subtotal,
    )


def _quote_result(q: Quote) -> QuoteResult:
    totals = _calculator.calculate(q)
    return QuoteResult(
        quote_id=str(q.id),
        tenant_id=str(q.tenant_id),
        created_by_user_id=str(q.created_by_user_id),
        quote_number=q.quote_number,
        customer_id=str(q.customer_id) if q.customer_id else None,
        customer_snapshot=q.customer_snapshot,
        status=q.status.value,
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
        has_altura=q.has_altura_panes,
        created_at=q.created_at.isoformat(),
    )


def _build_quote_number(seq: int) -> str:
    return f"P-{seq:04d}"


def _can_access(quote: Quote, user_id: UUID, role: str) -> bool:
    return role == "ADMIN" or quote.created_by_user_id == user_id


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

            lines = [
                QuoteLine(
                    product_id=line.product_id,
                    product_snapshot=line.product_snapshot,
                    glass_pane_ids=line.glass_pane_ids,
                    price_per_m2=line.price_per_m2,
                    surface_m2=line.surface_m2,
                    subtotal=line.subtotal,
                )
                for line in command.lines
            ]

            quote = Quote.create(
                tenant_id=command.tenant_id,
                created_by_user_id=command.created_by_user_id,
                quote_number=quote_number,
                customer_id=command.customer_id,
                customer_snapshot=command.customer_snapshot,
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

            if command.new_status == QuoteStatus.SENT:
                quote.submit()
            elif command.new_status == QuoteStatus.ACCEPTED:
                quote.accept()
            elif command.new_status == QuoteStatus.INVOICED:
                quote.invoice()
            elif command.new_status == QuoteStatus.COMPLETED:
                quote.complete()
            elif command.new_status == QuoteStatus.CANCELLED:
                quote.cancel()

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
            lines = [
                QuoteLine(
                    product_id=line.product_id,
                    product_snapshot=line.product_snapshot,
                    glass_pane_ids=line.glass_pane_ids,
                    price_per_m2=line.price_per_m2,
                    surface_m2=line.surface_m2,
                    subtotal=line.subtotal,
                )
                for line in command.lines
            ]

            updated = Quote(
                id=quote.id,
                tenant_id=quote.tenant_id,
                created_by_user_id=quote.created_by_user_id,
                quote_number=quote.quote_number,
                customer_id=command.customer_id,
                customer_snapshot=command.customer_snapshot,
                status=quote.status,
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


@dataclass(frozen=True)
class QuoteStatsResult:
    quotes_this_month: int
    total_quotes: int
    conversion_rate: float
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
            )
            for uid, uq in by_user.items()
        ]

        return QuoteStatsResult(
            quotes_this_month=quotes_this_month,
            total_quotes=len(quotes),
            conversion_rate=_conversion(quotes),
            per_user=per_user,
        )
