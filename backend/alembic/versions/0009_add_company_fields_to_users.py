"""add company address and cuit fields to users

Revision ID: 0009
Revises: 0008
Create Date: 2026-06-18
"""

import sqlalchemy as sa
from alembic import op

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("company_street", sa.String(255), nullable=True))
    op.add_column("users", sa.Column("company_city", sa.String(100), nullable=True))
    op.add_column("users", sa.Column("company_province", sa.String(100), nullable=True))
    op.add_column(
        "users", sa.Column("company_postal_code", sa.String(20), nullable=True)
    )
    op.add_column("users", sa.Column("company_cuit", sa.String(20), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "company_cuit")
    op.drop_column("users", "company_postal_code")
    op.drop_column("users", "company_province")
    op.drop_column("users", "company_city")
    op.drop_column("users", "company_street")
