from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column

from centy.infrastructure.persistence.database import Base


class BrandModel(Base):
    __tablename__ = "brands"
    __table_args__ = (Index("ix_brands_tenant", "tenant_id"),)

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(UUID(as_uuid=False), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    color: Mapped[str] = mapped_column(String(7), nullable=False, default="#0f6e50")
    logo_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )


class ProductCategoryModel(Base):
    __tablename__ = "product_categories"
    __table_args__ = (Index("ix_product_categories_tenant", "tenant_id"),)

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(UUID(as_uuid=False), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )


class GlassTypeModel(Base):
    __tablename__ = "glass_types"
    __table_args__ = (Index("ix_glass_types_tenant", "tenant_id"),)

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(UUID(as_uuid=False), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )


class ProductModel(Base):
    __tablename__ = "products"
    __table_args__ = (Index("ix_products_tenant", "tenant_id"),)

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(UUID(as_uuid=False), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    brand_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("brands.id", ondelete="RESTRICT"),
        nullable=False,
    )
    category_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("product_categories.id", ondelete="RESTRICT"),
        nullable=False,
    )
    sale_price_per_m2: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    purchase_price_per_m2: Mapped[float] = mapped_column(
        Numeric(12, 2), nullable=False, server_default="0"
    )
    uv_percentage: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    irr_percentage: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    tser_percentage: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    warranty_years: Mapped[int] = mapped_column(Integer, nullable=False)
    roll_width_cm: Mapped[float] = mapped_column(
        Numeric(8, 2), nullable=False, server_default="152"
    )
    roll_length_m: Mapped[float] = mapped_column(
        Numeric(8, 2), nullable=False, server_default="30"
    )
    # WINDOW, AUTOMOTIVE — max 2 elementos
    application_types: Mapped[list[str]] = mapped_column(
        ARRAY(String(20)), nullable=False
    )
    technical_sheet_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )


class ProductGlassTypeModel(Base):
    """Join table entre productos y tipos de vidrio compatibles."""

    __tablename__ = "product_glass_types"

    product_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("products.id", ondelete="CASCADE"),
        primary_key=True,
    )
    glass_type_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("glass_types.id", ondelete="CASCADE"),
        primary_key=True,
    )
