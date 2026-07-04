from dataclasses import dataclass, field
from decimal import Decimal
from uuid import UUID

from centy.domain.shared.value_objects import TenantId

# ── Brand commands ────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class CreateBrandCommand:
    tenant_id: TenantId
    name: str
    color: str
    logo_url: str | None = None


@dataclass(frozen=True)
class UpdateBrandCommand:
    brand_id: UUID
    tenant_id: TenantId
    name: str | None = None
    color: str | None = None
    logo_url: str | None = None
    clear_logo: bool = False


@dataclass(frozen=True)
class DeleteBrandCommand:
    brand_id: UUID
    tenant_id: TenantId


# ── ProductCategory commands ──────────────────────────────────────────────────


@dataclass(frozen=True)
class CreateCategoryCommand:
    tenant_id: TenantId
    name: str


@dataclass(frozen=True)
class UpdateCategoryCommand:
    category_id: UUID
    tenant_id: TenantId
    name: str | None = None


@dataclass(frozen=True)
class DeleteCategoryCommand:
    category_id: UUID
    tenant_id: TenantId


# ── GlassType commands ────────────────────────────────────────────────────────


@dataclass(frozen=True)
class CreateGlassTypeCommand:
    tenant_id: TenantId
    name: str


@dataclass(frozen=True)
class UpdateGlassTypeCommand:
    glass_type_id: UUID
    tenant_id: TenantId
    name: str | None = None


@dataclass(frozen=True)
class DeleteGlassTypeCommand:
    glass_type_id: UUID
    tenant_id: TenantId


# ── Product commands ──────────────────────────────────────────────────────────


@dataclass(frozen=True)
class CreateProductCommand:
    tenant_id: TenantId
    name: str
    brand_id: UUID
    sale_price_per_m2: Decimal
    uv_percentage: Decimal
    irr_percentage: Decimal
    tser_percentage: Decimal
    warranty_years: int
    category_id: UUID
    roll_width_cm: Decimal = Decimal("152")
    roll_length_m: Decimal = Decimal("30")
    application_types: list[str] = field(default_factory=list)
    compatible_glass_ids: list[UUID] = field(default_factory=list)
    technical_sheet_url: str | None = None


@dataclass(frozen=True)
class UpdateProductCommand:
    product_id: UUID
    tenant_id: TenantId
    name: str | None = None
    brand_id: UUID | None = None
    sale_price_per_m2: Decimal | None = None
    uv_percentage: Decimal | None = None
    irr_percentage: Decimal | None = None
    tser_percentage: Decimal | None = None
    warranty_years: int | None = None
    category_id: UUID | None = None
    roll_width_cm: Decimal | None = None
    roll_length_m: Decimal | None = None
    application_types: list[str] | None = None
    compatible_glass_ids: list[UUID] | None = None
    technical_sheet_url: str | None = None
    clear_technical_sheet: bool = False
    is_active: bool | None = None


@dataclass(frozen=True)
class DeleteProductCommand:
    product_id: UUID
    tenant_id: TenantId
