"""add company colors and default commercial conditions to users

Revision ID: 0012
Revises: 0011
Create Date: 2026-06-27
"""

import sqlalchemy as sa
from alembic import op


revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("company_color_primary", sa.String(7), nullable=True))
    op.add_column("users", sa.Column("company_color_secondary", sa.String(7), nullable=True))
    op.add_column("users", sa.Column("default_commercial_conditions", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "default_commercial_conditions")
    op.drop_column("users", "company_color_secondary")
    op.drop_column("users", "company_color_primary")
