"""add vehicle fields to warranties

Revision ID: 0017
Revises: 0016
Create Date: 2026-07-17
"""

import sqlalchemy as sa
from alembic import op

revision = "0017"
down_revision = "0016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "warranties", sa.Column("vehicle_model", sa.String(100), nullable=True)
    )
    op.add_column(
        "warranties", sa.Column("license_plate", sa.String(20), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("warranties", "license_plate")
    op.drop_column("warranties", "vehicle_model")
