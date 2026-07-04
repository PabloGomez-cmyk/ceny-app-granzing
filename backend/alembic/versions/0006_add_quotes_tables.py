"""add quotes tables: quotes, quote_glass_panes, quote_lines

Revision ID: 0006
Revises: 0005
Create Date: 2026-06-11
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "quotes",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column("tenant_id", UUID(as_uuid=False), nullable=False),
        sa.Column("created_by_user_id", UUID(as_uuid=False), nullable=False),
        sa.Column("quote_number", sa.String(20), nullable=False),
        sa.Column("customer_id", UUID(as_uuid=False), nullable=True),
        sa.Column("customer_snapshot", JSONB, nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="DRAFT"),
        sa.Column("film_mode", sa.String(20), nullable=False, server_default="SINGLE"),
        sa.Column(
            "height_surcharge_pct",
            sa.Numeric(5, 2),
            nullable=False,
            server_default="30",
        ),
        sa.Column("travel_cost", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("discount_pct", sa.Numeric(5, 2), nullable=False, server_default="0"),
        sa.Column("commercial_conditions", sa.Text, nullable=False, server_default=""),
        sa.Column("cut_plan_snapshot", JSONB, nullable=False, server_default="{}"),
        sa.Column("valid_until", sa.String(10), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_quotes_tenant", "quotes", ["tenant_id"])
    op.create_index("ix_quotes_user", "quotes", ["created_by_user_id"])

    op.create_table(
        "quote_glass_panes",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column(
            "quote_id",
            UUID(as_uuid=False),
            sa.ForeignKey("quotes.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("pane_id", sa.String(10), nullable=False),
        sa.Column("glass_type_id", UUID(as_uuid=False), nullable=True),
        sa.Column("glass_type_name", sa.String(100), nullable=False),
        sa.Column("width_cm", sa.Numeric(10, 2), nullable=False),
        sa.Column("height_cm", sa.Numeric(10, 2), nullable=False),
        sa.Column("location", sa.String(20), nullable=False),
        sa.Column("quantity", sa.Integer, nullable=False, server_default="1"),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
    )
    op.create_index("ix_glass_panes_quote", "quote_glass_panes", ["quote_id"])

    op.create_table(
        "quote_lines",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column(
            "quote_id",
            UUID(as_uuid=False),
            sa.ForeignKey("quotes.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("product_id", UUID(as_uuid=False), nullable=False),
        sa.Column("product_snapshot", JSONB, nullable=False),
        sa.Column("glass_pane_ids", ARRAY(sa.String(10)), nullable=False),
        sa.Column("price_per_m2", sa.Numeric(12, 2), nullable=False),
        sa.Column("surface_m2", sa.Numeric(10, 4), nullable=False),
        sa.Column("subtotal", sa.Numeric(14, 2), nullable=False),
    )
    op.create_index("ix_quote_lines_quote", "quote_lines", ["quote_id"])


def downgrade() -> None:
    op.drop_table("quote_lines")
    op.drop_table("quote_glass_panes")
    op.drop_table("quotes")
