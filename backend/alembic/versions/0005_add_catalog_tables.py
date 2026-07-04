"""add catalog tables: brands, product_categories, glass_types, products

Revision ID: 0005
Revises: 0004
Create Date: 2026-05-31
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ARRAY, UUID

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "brands",
        sa.Column("id", UUID(as_uuid=False), nullable=False),
        sa.Column("tenant_id", UUID(as_uuid=False), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("color", sa.String(7), nullable=False, server_default="#0f6e50"),
        sa.Column("logo_url", sa.Text, nullable=True),
        sa.Column(
            "is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_brands_tenant", "brands", ["tenant_id"])

    op.create_table(
        "product_categories",
        sa.Column("id", UUID(as_uuid=False), nullable=False),
        sa.Column("tenant_id", UUID(as_uuid=False), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column(
            "is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_product_categories_tenant", "product_categories", ["tenant_id"])

    op.create_table(
        "glass_types",
        sa.Column("id", UUID(as_uuid=False), nullable=False),
        sa.Column("tenant_id", UUID(as_uuid=False), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column(
            "is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_glass_types_tenant", "glass_types", ["tenant_id"])

    op.create_table(
        "products",
        sa.Column("id", UUID(as_uuid=False), nullable=False),
        sa.Column("tenant_id", UUID(as_uuid=False), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("brand_id", UUID(as_uuid=False), nullable=False),
        sa.Column("category_id", UUID(as_uuid=False), nullable=False),
        sa.Column("sale_price_per_m2", sa.Numeric(12, 2), nullable=False),
        sa.Column("uv_percentage", sa.Numeric(5, 2), nullable=False),
        sa.Column("irr_percentage", sa.Numeric(5, 2), nullable=False),
        sa.Column("tser_percentage", sa.Numeric(5, 2), nullable=False),
        sa.Column("warranty_years", sa.Integer(), nullable=False),
        sa.Column("application_types", ARRAY(sa.String(20)), nullable=False),
        sa.Column("technical_sheet_url", sa.Text, nullable=True),
        sa.Column(
            "is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["brand_id"], ["brands.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(
            ["category_id"], ["product_categories.id"], ondelete="RESTRICT"
        ),
    )
    op.create_index("ix_products_tenant", "products", ["tenant_id"])

    op.create_table(
        "product_glass_types",
        sa.Column("product_id", UUID(as_uuid=False), nullable=False),
        sa.Column("glass_type_id", UUID(as_uuid=False), nullable=False),
        sa.PrimaryKeyConstraint("product_id", "glass_type_id"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["glass_type_id"], ["glass_types.id"], ondelete="CASCADE"
        ),
    )


def downgrade() -> None:
    op.drop_table("product_glass_types")
    op.drop_index("ix_products_tenant", table_name="products")
    op.drop_table("products")
    op.drop_index("ix_glass_types_tenant", table_name="glass_types")
    op.drop_table("glass_types")
    op.drop_index("ix_product_categories_tenant", table_name="product_categories")
    op.drop_table("product_categories")
    op.drop_index("ix_brands_tenant", table_name="brands")
    op.drop_table("brands")
