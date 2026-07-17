from datetime import datetime

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from centy.infrastructure.persistence.database import Base


class QuoteModel(Base):
    __tablename__ = "quotes"
    __table_args__ = (
        Index("ix_quotes_tenant", "tenant_id"),
        Index("ix_quotes_user", "created_by_user_id"),
    )

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(UUID(as_uuid=False), nullable=False)
    created_by_user_id: Mapped[str] = mapped_column(UUID(as_uuid=False), nullable=False)
    quote_number: Mapped[str] = mapped_column(String(20), nullable=False)
    customer_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), nullable=True)
    customer_snapshot: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="DRAFT")
    sale_type: Mapped[str] = mapped_column(
        String(20), nullable=False, default="ARCHITECTURE"
    )
    film_mode: Mapped[str] = mapped_column(String(20), nullable=False, default="SINGLE")
    height_surcharge_pct: Mapped[float] = mapped_column(
        Numeric(5, 2), nullable=False, default=30
    )
    travel_cost: Mapped[float] = mapped_column(
        Numeric(12, 2), nullable=False, default=0
    )
    discount_pct: Mapped[float] = mapped_column(
        Numeric(5, 2), nullable=False, default=0
    )
    tax_pct: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False, default=0)
    gap_cm: Mapped[float] = mapped_column(
        Numeric(5, 2), nullable=False, server_default="3"
    )
    commercial_conditions: Mapped[str] = mapped_column(Text, nullable=False, default="")
    cut_plan_snapshot: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    valid_until: Mapped[str] = mapped_column(String(10), nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )


class GlassPaneModel(Base):
    __tablename__ = "quote_glass_panes"
    __table_args__ = (Index("ix_glass_panes_quote", "quote_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    quote_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("quotes.id", ondelete="CASCADE"),
        nullable=False,
    )
    pane_id: Mapped[str] = mapped_column(String(10), nullable=False)
    glass_type_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=False), nullable=True
    )
    glass_type_name: Mapped[str] = mapped_column(String(100), nullable=False)
    width_cm: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    height_cm: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    location: Mapped[str] = mapped_column(String(20), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class QuoteLineModel(Base):
    __tablename__ = "quote_lines"
    __table_args__ = (Index("ix_quote_lines_quote", "quote_id"),)

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True)
    quote_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("quotes.id", ondelete="CASCADE"),
        nullable=False,
    )
    product_id: Mapped[str] = mapped_column(UUID(as_uuid=False), nullable=False)
    product_snapshot: Mapped[dict] = mapped_column(JSONB, nullable=False)
    glass_pane_ids: Mapped[list[str]] = mapped_column(ARRAY(String(10)), nullable=False)
    price_per_m2: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    surface_m2: Mapped[float] = mapped_column(Numeric(10, 4), nullable=False)
    subtotal: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
