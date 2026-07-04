"""add customer_labels and customers tables

Revision ID: 0003
Revises: 0002
Create Date: 2026-05-27
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # customer_labels debe crearse primero porque customers tiene FK hacia ella
    op.create_table(
        "customer_labels",
        sa.Column("id", UUID(as_uuid=False), nullable=False),
        sa.Column("tenant_id", UUID(as_uuid=False), nullable=False),
        sa.Column("owner_user_id", UUID(as_uuid=False), nullable=False),
        sa.Column("name", sa.String(50), nullable=False),
        sa.Column("color", sa.String(7), nullable=False, server_default="#10b981"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_customer_labels_owner", "customer_labels", ["owner_user_id", "tenant_id"])

    op.create_table(
        "customers",
        sa.Column("id", UUID(as_uuid=False), nullable=False),
        sa.Column("tenant_id", UUID(as_uuid=False), nullable=False),
        sa.Column("owner_user_id", UUID(as_uuid=False), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("phone", sa.String(50), nullable=True),
        sa.Column("address", sa.String(500), nullable=True),
        sa.Column("label_id", UUID(as_uuid=False), nullable=True),
        sa.Column("notes", sa.String(2000), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["label_id"],
            ["customer_labels.id"],
            ondelete="SET NULL",
        ),
    )
    op.create_index("ix_customers_owner", "customers", ["owner_user_id", "tenant_id"])
    op.create_index("ix_customers_tenant", "customers", ["tenant_id"])


def downgrade() -> None:
    op.drop_index("ix_customers_tenant", table_name="customers")
    op.drop_index("ix_customers_owner", table_name="customers")
    op.drop_table("customers")
    op.drop_index("ix_customer_labels_owner", table_name="customer_labels")
    op.drop_table("customer_labels")
