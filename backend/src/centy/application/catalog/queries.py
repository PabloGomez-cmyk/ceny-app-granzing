from dataclasses import dataclass
from uuid import UUID

from centy.domain.shared.value_objects import TenantId


@dataclass(frozen=True)
class GetBrandQuery:
    brand_id: UUID
    tenant_id: TenantId


@dataclass(frozen=True)
class ListBrandsQuery:
    tenant_id: TenantId


@dataclass(frozen=True)
class GetCategoryQuery:
    category_id: UUID
    tenant_id: TenantId


@dataclass(frozen=True)
class ListCategoriesQuery:
    tenant_id: TenantId


@dataclass(frozen=True)
class GetGlassTypeQuery:
    glass_type_id: UUID
    tenant_id: TenantId


@dataclass(frozen=True)
class ListGlassTypesQuery:
    tenant_id: TenantId


@dataclass(frozen=True)
class GetProductQuery:
    product_id: UUID
    tenant_id: TenantId


@dataclass(frozen=True)
class ListProductsQuery:
    tenant_id: TenantId
