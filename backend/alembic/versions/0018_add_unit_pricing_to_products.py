"""add unit pricing to products

Revision ID: 0018
Revises: 0017
Create Date: 2026-07-20
"""

import sqlalchemy as sa
from alembic import op

revision = "0018"
down_revision = "0017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "products",
        sa.Column(
            "sale_price_per_unit", sa.Numeric(12, 2), nullable=False, server_default="0"
        ),
    )
    op.add_column(
        "products",
        sa.Column(
            "purchase_price_per_unit",
            sa.Numeric(12, 2),
            nullable=False,
            server_default="0",
        ),
    )
    op.add_column(
        "products",
        sa.Column(
            "default_sale_unit",
            sa.String(20),
            nullable=False,
            server_default="SQUARE_METER",
        ),
    )


def downgrade() -> None:
    op.drop_column("products", "default_sale_unit")
    op.drop_column("products", "purchase_price_per_unit")
    op.drop_column("products", "sale_price_per_unit")
