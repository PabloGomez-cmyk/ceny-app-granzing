from datetime import datetime

from sqlalchemy import Boolean, DateTime, Index, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from centy.infrastructure.persistence.database import Base


class UserModel(Base):
    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("tenant_id", "email", name="uq_users_tenant_email"),
        Index("ix_users_tenant_id", "tenant_id"),
    )

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(UUID(as_uuid=False), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(50), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    company_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    company_logo_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    company_street: Mapped[str | None] = mapped_column(String(255), nullable=True)
    company_city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    company_province: Mapped[str | None] = mapped_column(String(100), nullable=True)
    company_postal_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    company_cuit: Mapped[str | None] = mapped_column(String(20), nullable=True)
    company_color_primary: Mapped[str | None] = mapped_column(String(7), nullable=True)
    company_color_secondary: Mapped[str | None] = mapped_column(String(7), nullable=True)
    default_commercial_conditions: Mapped[str | None] = mapped_column(Text, nullable=True)
