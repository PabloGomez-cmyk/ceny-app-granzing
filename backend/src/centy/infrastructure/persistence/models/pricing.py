from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Numeric, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from centy.infrastructure.persistence.database import Base


class PriceListItemModel(Base):
    __tablename__ = "price_list_items"
    __table_args__ = (
        UniqueConstraint(
            "tenant_id",
            "user_id",
            "product_id",
            name="uq_price_list_items_user_product",
        ),
        Index("ix_price_list_items_user", "user_id"),
    )

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(UUID(as_uuid=False), nullable=False)
    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    product_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
    )
    purchase_price: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    sale_price: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    purchase_price_per_unit: Mapped[float | None] = mapped_column(
        Numeric(12, 2), nullable=True
    )
    sale_price_per_unit: Mapped[float | None] = mapped_column(
        Numeric(12, 2), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
