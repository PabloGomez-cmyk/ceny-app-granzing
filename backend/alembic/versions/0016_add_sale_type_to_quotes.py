"""add sale_type to quotes

Revision ID: 0016
Revises: 0015
Create Date: 2026-07-17
"""

import sqlalchemy as sa
from alembic import op

revision = "0016"
down_revision = "0015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "quotes",
        sa.Column(
            "sale_type",
            sa.String(20),
            nullable=False,
            server_default="ARCHITECTURE",
        ),
    )


def downgrade() -> None:
    op.drop_column("quotes", "sale_type")
