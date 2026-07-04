import uuid
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field

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
    ListQuotesHandler,
    UpdateQuoteHandler,
    UpdateQuoteStatusHandler,
)
from centy.application.quotes.queries import (
    GetQuoteQuery,
    GetQuoteStatsQuery,
    ListQuotesQuery,
)
from centy.domain.quotes.value_objects import FilmMode, LocationType, QuoteStatus
from centy.domain.shared.value_objects import TenantId
from centy.infrastructure.api.dependencies import (
    CurrentUser,
    get_create_quote_handler,
    get_current_user,
    get_delete_quote_handler,
    get_list_quotes_handler,
    get_quote_handler,
    get_quote_stats_handler,
    get_update_quote_handler,
    get_update_quote_status_handler,
)
from centy.infrastructure.config.settings import get_settings

router = APIRouter(prefix="/quotes", tags=["quotes"])


def _resolve_tenant(settings_tenant: str) -> TenantId:
    try:
        return TenantId(UUID(settings_tenant))
    except ValueError:
        return TenantId(uuid.uuid5(uuid.NAMESPACE_DNS, settings_tenant))


# ── Request schemas ───────────────────────────────────────────────────────────


class GlassPaneBody(BaseModel):
    pane_id: str = Field(..., min_length=1, max_length=10)
    glass_type_id: UUID | None = None
    glass_type_name: str = Field(..., min_length=1, max_length=100)
    width_cm: Decimal = Field(..., gt=0)
    height_cm: Decimal = Field(..., gt=0)
    location: str = Field(..., pattern="^(SUPERFICIE|ALTURA)$")
    quantity: int = Field(1, ge=1)
    notes: str | None = None
    sort_order: int = 0


class QuoteLineBody(BaseModel):
    product_id: UUID
    product_snapshot: dict
    glass_pane_ids: list[str]
    price_per_m2: Decimal = Field(..., ge=0)
    surface_m2: Decimal = Field(..., ge=0)
    subtotal: Decimal = Field(..., ge=0)


class CreateQuoteBody(BaseModel):
    customer_id: UUID | None = None
    customer_snapshot: dict | None = None
    film_mode: str = Field("SINGLE", pattern="^(SINGLE|PER_GLASS)$")
    glass_panes: list[GlassPaneBody] = Field(..., min_length=1)
    lines: list[QuoteLineBody] = Field(..., min_length=1)
    height_surcharge_pct: Decimal = Field(Decimal("30"), ge=0, le=100)
    travel_cost: Decimal = Field(Decimal("0"), ge=0)
    discount_pct: Decimal = Field(Decimal("0"), ge=-50, le=50)
    tax_pct: Decimal = Field(Decimal("0"), ge=0, le=30)
    gap_cm: Decimal = Field(Decimal("3"), ge=0)
    commercial_conditions: str = ""
    cut_plan_snapshot: dict = Field(default_factory=dict)
    valid_until: str = ""


class UpdateStatusBody(BaseModel):
    status: str = Field(..., pattern="^(SENT|ACCEPTED|INVOICED|COMPLETED|CANCELLED)$")


class UserQuoteStatResponse(BaseModel):
    user_id: str
    total_quotes: int
    quotes_this_month: int
    conversion_rate: float


class QuoteStatsResponse(BaseModel):
    quotes_this_month: int
    total_quotes: int
    conversion_rate: float
    per_user: list[UserQuoteStatResponse]


# ── Response schemas ──────────────────────────────────────────────────────────


class GlassPaneResponse(BaseModel):
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


class QuoteLineResponse(BaseModel):
    line_id: str
    product_id: str
    product_snapshot: dict
    glass_pane_ids: list[str]
    price_per_m2: Decimal
    surface_m2: Decimal
    subtotal: Decimal


class QuoteTotalsResponse(BaseModel):
    materials_subtotal: Decimal
    height_surcharge: Decimal
    travel_cost: Decimal
    subtotal: Decimal
    discount_amount: Decimal
    tax_amount: Decimal
    total: Decimal


class QuoteResponse(BaseModel):
    id: str
    tenant_id: str
    created_by_user_id: str
    quote_number: str
    customer_id: str | None
    customer_snapshot: dict | None
    status: str
    film_mode: str
    glass_panes: list[GlassPaneResponse]
    lines: list[QuoteLineResponse]
    height_surcharge_pct: Decimal
    travel_cost: Decimal
    discount_pct: Decimal
    tax_pct: Decimal
    gap_cm: Decimal
    commercial_conditions: str
    cut_plan_snapshot: dict
    valid_until: str
    totals: QuoteTotalsResponse
    has_altura: bool
    created_at: str


def _to_response(r: object) -> QuoteResponse:
    return QuoteResponse(
        id=r.quote_id,  # type: ignore[attr-defined]
        tenant_id=r.tenant_id,  # type: ignore[attr-defined]
        created_by_user_id=r.created_by_user_id,  # type: ignore[attr-defined]
        quote_number=r.quote_number,  # type: ignore[attr-defined]
        customer_id=r.customer_id,  # type: ignore[attr-defined]
        customer_snapshot=r.customer_snapshot,  # type: ignore[attr-defined]
        status=r.status,  # type: ignore[attr-defined]
        film_mode=r.film_mode,  # type: ignore[attr-defined]
        glass_panes=[
            GlassPaneResponse(**p.__dict__)
            for p in r.glass_panes  # type: ignore[attr-defined]
        ],
        lines=[
            QuoteLineResponse(**line.__dict__)
            for line in r.lines  # type: ignore[attr-defined]
        ],
        height_surcharge_pct=r.height_surcharge_pct,  # type: ignore[attr-defined]
        travel_cost=r.travel_cost,  # type: ignore[attr-defined]
        discount_pct=r.discount_pct,  # type: ignore[attr-defined]
        tax_pct=r.tax_pct,  # type: ignore[attr-defined]
        gap_cm=r.gap_cm,  # type: ignore[attr-defined]
        commercial_conditions=r.commercial_conditions,  # type: ignore[attr-defined]
        cut_plan_snapshot=r.cut_plan_snapshot,  # type: ignore[attr-defined]
        valid_until=r.valid_until,  # type: ignore[attr-defined]
        totals=QuoteTotalsResponse(**r.totals.__dict__),  # type: ignore[attr-defined]
        has_altura=r.has_altura,  # type: ignore[attr-defined]
        created_at=r.created_at,  # type: ignore[attr-defined]
    )


# ── Routes ────────────────────────────────────────────────────────────────────


@router.get("", response_model=list[QuoteResponse])
async def list_quotes(
    current_user: CurrentUser = Depends(get_current_user),
    handler: ListQuotesHandler = Depends(get_list_quotes_handler),
) -> list[QuoteResponse]:
    results = await handler.handle(
        ListQuotesQuery(
            tenant_id=_resolve_tenant(get_settings().tenant_id_default),
            requester_user_id=UUID(current_user.user_id),
            requester_role=current_user.role,
        )
    )
    return [_to_response(r) for r in results]


@router.post("", response_model=QuoteResponse, status_code=status.HTTP_201_CREATED)
async def create_quote(
    body: CreateQuoteBody,
    current_user: CurrentUser = Depends(get_current_user),
    handler: CreateQuoteHandler = Depends(get_create_quote_handler),
) -> QuoteResponse:
    result = await handler.handle(
        CreateQuoteCommand(
            tenant_id=_resolve_tenant(get_settings().tenant_id_default),
            created_by_user_id=UUID(current_user.user_id),
            customer_id=body.customer_id,
            customer_snapshot=body.customer_snapshot,
            film_mode=FilmMode(body.film_mode),
            glass_panes=[
                GlassPaneInput(
                    pane_id=p.pane_id,
                    glass_type_id=p.glass_type_id,
                    glass_type_name=p.glass_type_name,
                    width_cm=p.width_cm,
                    height_cm=p.height_cm,
                    location=LocationType(p.location),
                    quantity=p.quantity,
                    notes=p.notes,
                    sort_order=p.sort_order,
                )
                for p in body.glass_panes
            ],
            lines=[
                QuoteLineInput(
                    product_id=line.product_id,
                    product_snapshot=line.product_snapshot,
                    glass_pane_ids=line.glass_pane_ids,
                    price_per_m2=line.price_per_m2,
                    surface_m2=line.surface_m2,
                    subtotal=line.subtotal,
                )
                for line in body.lines
            ],
            height_surcharge_pct=body.height_surcharge_pct,
            travel_cost=body.travel_cost,
            discount_pct=body.discount_pct,
            tax_pct=body.tax_pct,
            gap_cm=body.gap_cm,
            commercial_conditions=body.commercial_conditions,
            cut_plan_snapshot=body.cut_plan_snapshot,
            valid_until=body.valid_until,
        )
    )
    return _to_response(result)


@router.get("/stats", response_model=QuoteStatsResponse)
async def get_quote_stats(
    current_user: CurrentUser = Depends(get_current_user),
    handler: GetQuoteStatsHandler = Depends(get_quote_stats_handler),
) -> QuoteStatsResponse:
    if current_user.role != "ADMIN":
        from fastapi import HTTPException

        raise HTTPException(
            status_code=403,
            detail="Solo administradores pueden ver estadísticas globales",
        )
    result = await handler.handle(
        GetQuoteStatsQuery(tenant_id=_resolve_tenant(get_settings().tenant_id_default))
    )
    return QuoteStatsResponse(
        quotes_this_month=result.quotes_this_month,
        total_quotes=result.total_quotes,
        conversion_rate=result.conversion_rate,
        per_user=[
            UserQuoteStatResponse(
                user_id=u.user_id,
                total_quotes=u.total_quotes,
                quotes_this_month=u.quotes_this_month,
                conversion_rate=u.conversion_rate,
            )
            for u in result.per_user
        ],
    )


@router.get("/{quote_id}", response_model=QuoteResponse)
async def get_quote(
    quote_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    handler: GetQuoteHandler = Depends(get_quote_handler),
) -> QuoteResponse:
    result = await handler.handle(
        GetQuoteQuery(
            quote_id=quote_id,
            tenant_id=_resolve_tenant(get_settings().tenant_id_default),
            requester_user_id=UUID(current_user.user_id),
            requester_role=current_user.role,
        )
    )
    return _to_response(result)


@router.patch("/{quote_id}/status", response_model=QuoteResponse)
async def update_quote_status(
    quote_id: UUID,
    body: UpdateStatusBody,
    current_user: CurrentUser = Depends(get_current_user),
    handler: UpdateQuoteStatusHandler = Depends(get_update_quote_status_handler),
) -> QuoteResponse:
    result = await handler.handle(
        UpdateQuoteStatusCommand(
            quote_id=quote_id,
            tenant_id=_resolve_tenant(get_settings().tenant_id_default),
            requester_user_id=UUID(current_user.user_id),
            requester_role=current_user.role,
            new_status=QuoteStatus(body.status),
        )
    )
    return _to_response(result)


@router.put("/{quote_id}", response_model=QuoteResponse)
async def update_quote(
    quote_id: UUID,
    body: CreateQuoteBody,
    current_user: CurrentUser = Depends(get_current_user),
    handler: UpdateQuoteHandler = Depends(get_update_quote_handler),
) -> QuoteResponse:
    result = await handler.handle(
        UpdateQuoteCommand(
            quote_id=quote_id,
            tenant_id=_resolve_tenant(get_settings().tenant_id_default),
            requester_user_id=UUID(current_user.user_id),
            requester_role=current_user.role,
            customer_id=body.customer_id,
            customer_snapshot=body.customer_snapshot,
            film_mode=FilmMode(body.film_mode),
            glass_panes=[
                GlassPaneInput(
                    pane_id=p.pane_id,
                    glass_type_id=p.glass_type_id,
                    glass_type_name=p.glass_type_name,
                    width_cm=p.width_cm,
                    height_cm=p.height_cm,
                    location=LocationType(p.location),
                    quantity=p.quantity,
                    notes=p.notes,
                    sort_order=p.sort_order,
                )
                for p in body.glass_panes
            ],
            lines=[
                QuoteLineInput(
                    product_id=line.product_id,
                    product_snapshot=line.product_snapshot,
                    glass_pane_ids=line.glass_pane_ids,
                    price_per_m2=line.price_per_m2,
                    surface_m2=line.surface_m2,
                    subtotal=line.subtotal,
                )
                for line in body.lines
            ],
            height_surcharge_pct=body.height_surcharge_pct,
            travel_cost=body.travel_cost,
            discount_pct=body.discount_pct,
            tax_pct=body.tax_pct,
            gap_cm=body.gap_cm,
            commercial_conditions=body.commercial_conditions,
            cut_plan_snapshot=body.cut_plan_snapshot,
            valid_until=body.valid_until,
        )
    )
    return _to_response(result)


@router.delete("/{quote_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_quote(
    quote_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    handler: DeleteQuoteHandler = Depends(get_delete_quote_handler),
) -> None:
    await handler.handle(
        DeleteQuoteCommand(
            quote_id=quote_id,
            tenant_id=_resolve_tenant(get_settings().tenant_id_default),
            requester_user_id=UUID(current_user.user_id),
            requester_role=current_user.role,
        )
    )
