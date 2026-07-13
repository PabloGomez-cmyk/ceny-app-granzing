"""add purchase_price_per_m2 to products

Revision ID: 0014
Revises: 0013
Create Date: 2026-07-10
"""

import sqlalchemy as sa
from alembic import op

revision = "0014"
down_revision = "0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "products",
        sa.Column(
            "purchase_price_per_m2",
            sa.Numeric(12, 2),
            nullable=False,
            server_default="0",
        ),
    )


def downgrade() -> None:
    op.drop_column("products", "purchase_price_per_m2")
