"""add unit fields to quote_lines

Revision ID: 0019
Revises: 0018
Create Date: 2026-07-20
"""

import sqlalchemy as sa
from alembic import op

revision = "0019"
down_revision = "0018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "quote_lines", "surface_m2", existing_type=sa.Numeric(10, 4), nullable=True
    )
    op.add_column(
        "quote_lines", sa.Column("quantity", sa.Numeric(10, 2), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("quote_lines", "quantity")
    op.alter_column(
        "quote_lines", "surface_m2", existing_type=sa.Numeric(10, 4), nullable=False
    )
