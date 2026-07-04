from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from centy.infrastructure.persistence.database import Base


class WarrantyModel(Base):
    __tablename__ = "warranties"
    __table_args__ = (
        Index("ix_warranties_tenant", "tenant_id"),
        Index("ix_warranties_quote", "quote_id"),
        Index("ix_warranties_user", "created_by_user_id"),
    )

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(UUID(as_uuid=False), nullable=False)
    quote_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("quotes.id", ondelete="CASCADE"),
        nullable=False,
    )
    quote_line_id: Mapped[str] = mapped_column(UUID(as_uuid=False), nullable=False)
    product_id: Mapped[str] = mapped_column(UUID(as_uuid=False), nullable=False)
    product_snapshot: Mapped[dict] = mapped_column(JSONB, nullable=False)
    warranty_number: Mapped[str] = mapped_column(String(20), nullable=False)
    customer_snapshot: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_by_user_id: Mapped[str] = mapped_column(UUID(as_uuid=False), nullable=False)
    warranty_years: Mapped[int] = mapped_column(Integer, nullable=False)
    expires_at: Mapped[date] = mapped_column(Date, nullable=False)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
