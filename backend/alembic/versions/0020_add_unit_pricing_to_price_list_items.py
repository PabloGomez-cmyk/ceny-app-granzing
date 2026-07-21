"""add unit pricing to price_list_items

Revision ID: 0020
Revises: 0019
Create Date: 2026-07-20
"""

import sqlalchemy as sa
from alembic import op

revision = "0020"
down_revision = "0019"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "price_list_items",
        sa.Column("purchase_price_per_unit", sa.Numeric(12, 2), nullable=True),
    )
    op.add_column(
        "price_list_items",
        sa.Column("sale_price_per_unit", sa.Numeric(12, 2), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("price_list_items", "sale_price_per_unit")
    op.drop_column("price_list_items", "purchase_price_per_unit")
