"""add warranties table

Revision ID: 0013
Revises: 0012
Create Date: 2026-07-02
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "warranties",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column("tenant_id", UUID(as_uuid=False), nullable=False),
        sa.Column(
            "quote_id",
            UUID(as_uuid=False),
            sa.ForeignKey("quotes.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("quote_line_id", UUID(as_uuid=False), nullable=False),
        sa.Column("product_id", UUID(as_uuid=False), nullable=False),
        sa.Column("product_snapshot", JSONB, nullable=False),
        sa.Column("warranty_number", sa.String(20), nullable=False),
        sa.Column("customer_snapshot", JSONB, nullable=True),
        sa.Column("created_by_user_id", UUID(as_uuid=False), nullable=False),
        sa.Column("warranty_years", sa.Integer, nullable=False),
        sa.Column("expires_at", sa.Date, nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_warranties_tenant", "warranties", ["tenant_id"])
    op.create_index("ix_warranties_quote", "warranties", ["quote_id"])
    op.create_index("ix_warranties_user", "warranties", ["created_by_user_id"])


def downgrade() -> None:
    op.drop_index("ix_warranties_user", table_name="warranties")
    op.drop_index("ix_warranties_quote", table_name="warranties")
    op.drop_index("ix_warranties_tenant", table_name="warranties")
    op.drop_table("warranties")
