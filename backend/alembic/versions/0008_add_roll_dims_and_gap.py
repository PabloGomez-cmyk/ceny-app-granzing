"""add roll_width_cm, roll_length_m to products and gap_cm to quotes

Revision ID: 0008
Revises: 0007
Create Date: 2026-06-18
"""

import sqlalchemy as sa
from alembic import op

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "products",
        sa.Column(
            "roll_width_cm", sa.Numeric(8, 2), nullable=False, server_default="152"
        ),
    )
    op.add_column(
        "products",
        sa.Column(
            "roll_length_m", sa.Numeric(8, 2), nullable=False, server_default="30"
        ),
    )
    op.add_column(
        "quotes",
        sa.Column("gap_cm", sa.Numeric(5, 2), nullable=False, server_default="3"),
    )


def downgrade() -> None:
    op.drop_column("products", "roll_width_cm")
    op.drop_column("products", "roll_length_m")
    op.drop_column("quotes", "gap_cm")
