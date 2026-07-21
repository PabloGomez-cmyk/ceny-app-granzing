from decimal import Decimal
from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from centy.application.ports.repositories import IQuoteRepository
from centy.domain.quotes.entities import GlassPane, Quote, QuoteLine
from centy.domain.quotes.value_objects import (
    FilmMode,
    LocationType,
    QuoteStatus,
    SaleType,
)
from centy.domain.shared.value_objects import TenantId
from centy.infrastructure.persistence.models.quote import (
    GlassPaneModel,
    QuoteLineModel,
    QuoteModel,
)


def _pane_to_domain(m: GlassPaneModel) -> GlassPane:
    return GlassPane(
        pane_id=m.pane_id,
        glass_type_id=UUID(m.glass_type_id) if m.glass_type_id else None,
        glass_type_name=m.glass_type_name,
        width_cm=Decimal(str(m.width_cm)),
        height_cm=Decimal(str(m.height_cm)),
        location=LocationType(m.location),
        quantity=m.quantity,
        notes=m.notes,
        sort_order=m.sort_order,
    )


def _line_to_domain(m: QuoteLineModel) -> QuoteLine:
    return QuoteLine(
        line_id=UUID(m.id),
        product_id=UUID(m.product_id),
        product_snapshot=m.product_snapshot,
        glass_pane_ids=list(m.glass_pane_ids),
        price_per_m2=Decimal(str(m.price_per_m2)),
        subtotal=Decimal(str(m.subtotal)),
        surface_m2=Decimal(str(m.surface_m2)) if m.surface_m2 is not None else None,
        quantity=Decimal(str(m.quantity)) if m.quantity is not None else None,
    )


def _quote_to_domain(
    q: QuoteModel,
    panes: list[GlassPaneModel],
    lines: list[QuoteLineModel],
) -> Quote:
    return Quote(
        id=UUID(q.id),
        tenant_id=TenantId(UUID(q.tenant_id)),
        created_by_user_id=UUID(q.created_by_user_id),
        quote_number=q.quote_number,
        customer_id=UUID(q.customer_id) if q.customer_id else None,
        customer_snapshot=q.customer_snapshot,
        status=QuoteStatus(q.status),
        sale_type=SaleType(q.sale_type) if q.sale_type else SaleType.ARCHITECTURE,
        film_mode=FilmMode(q.film_mode),
        glass_panes=[
            _pane_to_domain(p) for p in sorted(panes, key=lambda x: x.sort_order)
        ],
        lines=[_line_to_domain(line) for line in lines],
        height_surcharge_pct=Decimal(str(q.height_surcharge_pct)),
        travel_cost=Decimal(str(q.travel_cost)),
        discount_pct=Decimal(str(q.discount_pct)),
        tax_pct=Decimal(str(q.tax_pct)) if q.tax_pct is not None else Decimal("0"),
        gap_cm=Decimal(str(q.gap_cm)) if q.gap_cm is not None else Decimal("3"),
        commercial_conditions=q.commercial_conditions,
        cut_plan_snapshot=q.cut_plan_snapshot or {},
        valid_until=q.valid_until,
        created_at=q.created_at,
    )


class SQLAlchemyQuoteRepository(IQuoteRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, quote_id: UUID, tenant_id: TenantId) -> Quote | None:
        result = await self._session.execute(
            select(QuoteModel).where(
                QuoteModel.id == str(quote_id),
                QuoteModel.tenant_id == str(tenant_id),
            )
        )
        model = result.scalar_one_or_none()
        if model is None:
            return None
        panes, lines = await self._load_children(str(quote_id))
        return _quote_to_domain(model, panes, lines)

    async def save(self, quote: Quote) -> None:
        existing = await self._session.get(QuoteModel, str(quote.id))
        if existing is None:
            self._session.add(
                QuoteModel(
                    id=str(quote.id),
                    tenant_id=str(quote.tenant_id),
                    created_by_user_id=str(quote.created_by_user_id),
                    quote_number=quote.quote_number,
                    customer_id=str(quote.customer_id) if quote.customer_id else None,
                    customer_snapshot=quote.customer_snapshot,
                    status=quote.status.value,
                    sale_type=quote.sale_type.value,
                    film_mode=quote.film_mode.value,
                    height_surcharge_pct=float(quote.height_surcharge_pct),
                    travel_cost=float(quote.travel_cost),
                    discount_pct=float(quote.discount_pct),
                    tax_pct=float(quote.tax_pct),
                    gap_cm=float(quote.gap_cm),
                    commercial_conditions=quote.commercial_conditions,
                    cut_plan_snapshot=quote.cut_plan_snapshot,
                    valid_until=quote.valid_until,
                    created_at=quote.created_at,
                )
            )
            # Flush para que el INSERT de quotes se ejecute antes que los hijos,
            # evitando ForeignKeyViolationError por orden de inserción de SQLAlchemy.
            await self._session.flush()
            for pane in quote.glass_panes:
                self._session.add(
                    GlassPaneModel(
                        quote_id=str(quote.id),
                        pane_id=pane.pane_id,
                        glass_type_id=str(pane.glass_type_id)
                        if pane.glass_type_id
                        else None,
                        glass_type_name=pane.glass_type_name,
                        width_cm=float(pane.width_cm),
                        height_cm=float(pane.height_cm),
                        location=pane.location.value,
                        quantity=pane.quantity,
                        notes=pane.notes,
                        sort_order=pane.sort_order,
                    )
                )
            for line in quote.lines:
                self._session.add(
                    QuoteLineModel(
                        id=str(line.line_id),
                        quote_id=str(quote.id),
                        product_id=str(line.product_id),
                        product_snapshot=line.product_snapshot,
                        glass_pane_ids=line.glass_pane_ids,
                        price_per_m2=float(line.price_per_m2),
                        surface_m2=float(line.surface_m2)
                        if line.surface_m2 is not None
                        else None,
                        quantity=float(line.quantity)
                        if line.quantity is not None
                        else None,
                        subtotal=float(line.subtotal),
                    )
                )
        else:
            # Full update: reemplazar todos los campos y regenerar hijos
            existing.customer_id = str(quote.customer_id) if quote.customer_id else None
            existing.customer_snapshot = quote.customer_snapshot
            existing.status = quote.status.value
            existing.film_mode = quote.film_mode.value
            existing.height_surcharge_pct = float(quote.height_surcharge_pct)
            existing.travel_cost = float(quote.travel_cost)
            existing.discount_pct = float(quote.discount_pct)
            existing.tax_pct = float(quote.tax_pct)
            existing.gap_cm = float(quote.gap_cm)
            existing.commercial_conditions = quote.commercial_conditions
            existing.cut_plan_snapshot = quote.cut_plan_snapshot
            existing.valid_until = quote.valid_until

            # Borrar hijos y reinsertarlos para evitar lógica de diff
            await self._session.execute(
                delete(GlassPaneModel).where(GlassPaneModel.quote_id == str(quote.id))
            )
            await self._session.execute(
                delete(QuoteLineModel).where(QuoteLineModel.quote_id == str(quote.id))
            )
            await self._session.flush()

            for pane in quote.glass_panes:
                self._session.add(
                    GlassPaneModel(
                        quote_id=str(quote.id),
                        pane_id=pane.pane_id,
                        glass_type_id=str(pane.glass_type_id)
                        if pane.glass_type_id
                        else None,
                        glass_type_name=pane.glass_type_name,
                        width_cm=float(pane.width_cm),
                        height_cm=float(pane.height_cm),
                        location=pane.location.value,
                        quantity=pane.quantity,
                        notes=pane.notes,
                        sort_order=pane.sort_order,
                    )
                )
            for line in quote.lines:
                self._session.add(
                    QuoteLineModel(
                        id=str(line.line_id),
                        quote_id=str(quote.id),
                        product_id=str(line.product_id),
                        product_snapshot=line.product_snapshot,
                        glass_pane_ids=line.glass_pane_ids,
                        price_per_m2=float(line.price_per_m2),
                        surface_m2=float(line.surface_m2)
                        if line.surface_m2 is not None
                        else None,
                        quantity=float(line.quantity)
                        if line.quantity is not None
                        else None,
                        subtotal=float(line.subtotal),
                    )
                )

    async def list_by_tenant(self, tenant_id: TenantId) -> list[Quote]:
        result = await self._session.execute(
            select(QuoteModel)
            .where(QuoteModel.tenant_id == str(tenant_id))
            .order_by(QuoteModel.created_at.desc())
        )
        models = result.scalars().all()
        return await self._hydrate_many(models)

    async def list_by_user(self, user_id: UUID, tenant_id: TenantId) -> list[Quote]:
        result = await self._session.execute(
            select(QuoteModel)
            .where(
                QuoteModel.created_by_user_id == str(user_id),
                QuoteModel.tenant_id == str(tenant_id),
            )
            .order_by(QuoteModel.created_at.desc())
        )
        models = result.scalars().all()
        return await self._hydrate_many(models)

    async def delete(self, quote_id: UUID, tenant_id: TenantId) -> None:
        model = await self._session.get(QuoteModel, str(quote_id))
        if model and model.tenant_id == str(tenant_id):
            await self._session.delete(model)

    async def next_sequence(self, tenant_id: TenantId, user_id: UUID) -> int:
        result = await self._session.execute(
            select(func.count())
            .select_from(QuoteModel)
            .where(
                QuoteModel.tenant_id == str(tenant_id),
                QuoteModel.created_by_user_id == str(user_id),
            )
        )
        count = result.scalar_one()
        return (count or 0) + 1

    async def _load_children(
        self, quote_id: str
    ) -> tuple[list[GlassPaneModel], list[QuoteLineModel]]:
        panes_result = await self._session.execute(
            select(GlassPaneModel).where(GlassPaneModel.quote_id == quote_id)
        )
        lines_result = await self._session.execute(
            select(QuoteLineModel).where(QuoteLineModel.quote_id == quote_id)
        )
        return list(panes_result.scalars().all()), list(lines_result.scalars().all())

    async def _hydrate_many(self, models: list[QuoteModel]) -> list[Quote]:
        quotes = []
        for q in models:
            panes, lines = await self._load_children(q.id)
            quotes.append(_quote_to_domain(q, panes, lines))
        return quotes
