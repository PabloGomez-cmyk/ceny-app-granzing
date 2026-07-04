"""add city/province/neighborhood/postal_code to customers

Revision ID: 0004
Revises: 0003
Create Date: 2026-05-27
"""

import sqlalchemy as sa
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("customers", sa.Column("city", sa.String(100), nullable=True))
    op.add_column("customers", sa.Column("province", sa.String(100), nullable=True))
    op.add_column("customers", sa.Column("neighborhood", sa.String(200), nullable=True))
    op.add_column("customers", sa.Column("postal_code", sa.String(20), nullable=True))


def downgrade() -> None:
    op.drop_column("customers", "postal_code")
    op.drop_column("customers", "neighborhood")
    op.drop_column("customers", "province")
    op.drop_column("customers", "city")
