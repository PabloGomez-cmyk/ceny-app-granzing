"""add user_email_configs table

Revision ID: 0010
Revises: 0009
Create Date: 2026-06-25
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_email_configs",
        sa.Column("id", UUID(as_uuid=False), nullable=False),
        sa.Column("user_id", UUID(as_uuid=False), nullable=False),
        sa.Column("tenant_id", UUID(as_uuid=False), nullable=False),
        sa.Column("gmail_email", sa.String(255), nullable=False),
        sa.Column("access_token_enc", sa.String(2048), nullable=False),
        sa.Column("refresh_token_enc", sa.String(2048), nullable=False),
        sa.Column("token_expiry", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_unique_constraint(
        "uq_user_email_configs_user_id", "user_email_configs", ["user_id"]
    )
    op.create_index(
        "ix_user_email_configs_tenant_id", "user_email_configs", ["tenant_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_user_email_configs_tenant_id", table_name="user_email_configs")
    op.drop_constraint(
        "uq_user_email_configs_user_id", "user_email_configs", type_="unique"
    )
    op.drop_table("user_email_configs")
