"""add company fields to users

Revision ID: 0002
Revises: 0001
Create Date: 2026-05-26
"""

import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("company_name", sa.String(255), nullable=True))
    op.add_column(
        "users", sa.Column("company_logo_url", sa.String(2048), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("users", "company_logo_url")
    op.drop_column("users", "company_name")
