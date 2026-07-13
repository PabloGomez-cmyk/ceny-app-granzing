import uuid
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field

from centy.application.catalog.commands import (
    CreateBrandCommand,
    CreateCategoryCommand,
    CreateGlassTypeCommand,
    CreateProductCommand,
    DeleteBrandCommand,
    DeleteCategoryCommand,
    DeleteGlassTypeCommand,
    DeleteProductCommand,
    UpdateBrandCommand,
    UpdateCategoryCommand,
    UpdateGlassTypeCommand,
    UpdateProductCommand,
)
from centy.application.catalog.handlers import (
    CreateBrandHandler,
    CreateCategoryHandler,
    CreateGlassTypeHandler,
    CreateProductHandler,
    DeleteBrandHandler,
    DeleteCategoryHandler,
    DeleteGlassTypeHandler,
    DeleteProductHandler,
    GetBrandHandler,
    GetProductHandler,
    ListBrandsHandler,
    ListCategoriesHandler,
    ListGlassTypesHandler,
    ListProductsHandler,
    UpdateBrandHandler,
    UpdateCategoryHandler,
    UpdateGlassTypeHandler,
    UpdateProductHandler,
)
from centy.application.catalog.queries import (
    GetBrandQuery,
    GetProductQuery,
    ListBrandsQuery,
    ListCategoriesQuery,
    ListGlassTypesQuery,
    ListProductsQuery,
)
from centy.domain.shared.value_objects import TenantId
from centy.infrastructure.api.dependencies import (
    CurrentUser,
    get_brand_handler,
    get_create_brand_handler,
    get_create_category_handler,
    get_create_glass_type_handler,
    get_create_product_handler,
    get_current_user,
    get_delete_brand_handler,
    get_delete_category_handler,
    get_delete_glass_type_handler,
    get_delete_product_handler,
    get_list_brands_handler,
    get_list_categories_handler,
    get_list_glass_types_handler,
    get_list_products_handler,
    get_product_handler,
    get_update_brand_handler,
    get_update_category_handler,
    get_update_glass_type_handler,
    get_update_product_handler,
    require_admin,
)
from centy.infrastructure.config.settings import get_settings

router = APIRouter(tags=["catalog"])


def _resolve_tenant(settings_tenant: str) -> TenantId:
    try:
        return TenantId(UUID(settings_tenant))
    except ValueError:
        return TenantId(uuid.uuid5(uuid.NAMESPACE_DNS, settings_tenant))


# ── Schemas ───────────────────────────────────────────────────────────────────


class BrandResponse(BaseModel):
    id: str
    name: str
    color: str
    logo_url: str | None
    is_active: bool
    created_at: str


class CreateBrandBody(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    color: str = Field("#0f6e50", pattern=r"^#[0-9a-fA-F]{6}$")
    logo_url: str | None = None


class UpdateBrandBody(BaseModel):
    name: str | None = Field(None, max_length=100)
    color: str | None = Field(None, pattern=r"^#[0-9a-fA-F]{6}$")
    logo_url: str | None = None
    clear_logo: bool = False


class CategoryResponse(BaseModel):
    id: str
    name: str
    is_active: bool
    created_at: str


class CreateCategoryBody(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)


class UpdateCategoryBody(BaseModel):
    name: str | None = Field(None, max_length=100)


class GlassTypeResponse(BaseModel):
    id: str
    name: str
    is_active: bool
    created_at: str


class CreateGlassTypeBody(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)


class UpdateGlassTypeBody(BaseModel):
    name: str | None = Field(None, max_length=100)


class ProductResponse(BaseModel):
    id: str
    tenant_id: str
    name: str
    brand_id: str
    sale_price_per_m2: Decimal
    purchase_price_per_m2: Decimal
    uv_percentage: Decimal
    irr_percentage: Decimal
    tser_percentage: Decimal
    warranty_years: int
    category_id: str
    roll_width_cm: Decimal
    roll_length_m: Decimal
    application_types: list[str]
    compatible_glass_ids: list[str]
    technical_sheet_url: str | None
    is_active: bool
    created_at: str


class CreateProductBody(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    brand_id: UUID
    sale_price_per_m2: Decimal = Field(..., ge=Decimal("0"))
    purchase_price_per_m2: Decimal = Field(..., ge=Decimal("0"))
    uv_percentage: Decimal = Field(..., ge=Decimal("0"), le=Decimal("100"))
    irr_percentage: Decimal = Field(..., ge=Decimal("0"), le=Decimal("100"))
    tser_percentage: Decimal = Field(..., ge=Decimal("0"), le=Decimal("100"))
    warranty_years: int = Field(..., ge=0)
    category_id: UUID
    roll_width_cm: Decimal = Field(Decimal("152"), gt=Decimal("0"))
    roll_length_m: Decimal = Field(Decimal("30"), gt=Decimal("0"))
    application_types: list[str] = Field(..., min_length=1)
    compatible_glass_ids: list[UUID] = Field(default_factory=list)
    technical_sheet_url: str | None = None


class UpdateProductBody(BaseModel):
    name: str | None = Field(None, max_length=200)
    brand_id: UUID | None = None
    sale_price_per_m2: Decimal | None = Field(None, ge=Decimal("0"))
    purchase_price_per_m2: Decimal | None = Field(None, ge=Decimal("0"))
    uv_percentage: Decimal | None = Field(None, ge=Decimal("0"), le=Decimal("100"))
    irr_percentage: Decimal | None = Field(None, ge=Decimal("0"), le=Decimal("100"))
    tser_percentage: Decimal | None = Field(None, ge=Decimal("0"), le=Decimal("100"))
    warranty_years: int | None = Field(None, ge=0)
    category_id: UUID | None = None
    roll_width_cm: Decimal | None = Field(None, gt=Decimal("0"))
    roll_length_m: Decimal | None = Field(None, gt=Decimal("0"))
    application_types: list[str] | None = None
    compatible_glass_ids: list[UUID] | None = None
    technical_sheet_url: str | None = None
    clear_technical_sheet: bool = False
    is_active: bool | None = None


# ── Brand routes ──────────────────────────────────────────────────────────────


@router.get("/brands", response_model=list[BrandResponse])
async def list_brands(
    current_user: CurrentUser = Depends(get_current_user),
    handler: ListBrandsHandler = Depends(get_list_brands_handler),
) -> list[BrandResponse]:
    results = await handler.handle(
        ListBrandsQuery(tenant_id=_resolve_tenant(get_settings().tenant_id_default))
    )
    return [
        BrandResponse(
            id=str(r.brand_id),
            name=r.name,
            color=r.color,
            logo_url=r.logo_url,
            is_active=r.is_active,
            created_at=r.created_at,
        )
        for r in results
    ]


@router.post(
    "/brands", response_model=BrandResponse, status_code=status.HTTP_201_CREATED
)
async def create_brand(
    body: CreateBrandBody,
    _admin: CurrentUser = Depends(require_admin),
    handler: CreateBrandHandler = Depends(get_create_brand_handler),
) -> BrandResponse:
    result = await handler.handle(
        CreateBrandCommand(
            tenant_id=_resolve_tenant(get_settings().tenant_id_default),
            name=body.name,
            color=body.color,
            logo_url=body.logo_url,
        )
    )
    return BrandResponse(
        id=str(result.brand_id),
        name=result.name,
        color=result.color,
        logo_url=result.logo_url,
        is_active=result.is_active,
        created_at=result.created_at,
    )


@router.get("/brands/{brand_id}", response_model=BrandResponse)
async def get_brand(
    brand_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    handler: GetBrandHandler = Depends(get_brand_handler),
) -> BrandResponse:
    result = await handler.handle(
        GetBrandQuery(
            brand_id=brand_id,
            tenant_id=_resolve_tenant(get_settings().tenant_id_default),
        )
    )
    return BrandResponse(
        id=str(result.brand_id),
        name=result.name,
        color=result.color,
        logo_url=result.logo_url,
        is_active=result.is_active,
        created_at=result.created_at,
    )


@router.patch("/brands/{brand_id}", response_model=BrandResponse)
async def update_brand(
    brand_id: UUID,
    body: UpdateBrandBody,
    _admin: CurrentUser = Depends(require_admin),
    handler: UpdateBrandHandler = Depends(get_update_brand_handler),
) -> BrandResponse:
    result = await handler.handle(
        UpdateBrandCommand(
            brand_id=brand_id,
            tenant_id=_resolve_tenant(get_settings().tenant_id_default),
            name=body.name,
            color=body.color,
            logo_url=body.logo_url,
            clear_logo=body.clear_logo,
        )
    )
    return BrandResponse(
        id=str(result.brand_id),
        name=result.name,
        color=result.color,
        logo_url=result.logo_url,
        is_active=result.is_active,
        created_at=result.created_at,
    )


@router.delete("/brands/{brand_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_brand(
    brand_id: UUID,
    _admin: CurrentUser = Depends(require_admin),
    handler: DeleteBrandHandler = Depends(get_delete_brand_handler),
) -> None:
    await handler.handle(
        DeleteBrandCommand(
            brand_id=brand_id,
            tenant_id=_resolve_tenant(get_settings().tenant_id_default),
        )
    )


# ── Category routes ───────────────────────────────────────────────────────────


@router.get("/categories", response_model=list[CategoryResponse])
async def list_categories(
    current_user: CurrentUser = Depends(get_current_user),
    handler: ListCategoriesHandler = Depends(get_list_categories_handler),
) -> list[CategoryResponse]:
    results = await handler.handle(
        ListCategoriesQuery(tenant_id=_resolve_tenant(get_settings().tenant_id_default))
    )
    return [
        CategoryResponse(
            id=str(r.category_id),
            name=r.name,
            is_active=r.is_active,
            created_at=r.created_at,
        )
        for r in results
    ]


@router.post(
    "/categories", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED
)
async def create_category(
    body: CreateCategoryBody,
    _admin: CurrentUser = Depends(require_admin),
    handler: CreateCategoryHandler = Depends(get_create_category_handler),
) -> CategoryResponse:
    result = await handler.handle(
        CreateCategoryCommand(
            tenant_id=_resolve_tenant(get_settings().tenant_id_default),
            name=body.name,
        )
    )
    return CategoryResponse(
        id=str(result.category_id),
        name=result.name,
        is_active=result.is_active,
        created_at=result.created_at,
    )


@router.patch("/categories/{category_id}", response_model=CategoryResponse)
async def update_category(
    category_id: UUID,
    body: UpdateCategoryBody,
    _admin: CurrentUser = Depends(require_admin),
    handler: UpdateCategoryHandler = Depends(get_update_category_handler),
) -> CategoryResponse:
    result = await handler.handle(
        UpdateCategoryCommand(
            category_id=category_id,
            tenant_id=_resolve_tenant(get_settings().tenant_id_default),
            name=body.name,
        )
    )
    return CategoryResponse(
        id=str(result.category_id),
        name=result.name,
        is_active=result.is_active,
        created_at=result.created_at,
    )


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: UUID,
    _admin: CurrentUser = Depends(require_admin),
    handler: DeleteCategoryHandler = Depends(get_delete_category_handler),
) -> None:
    await handler.handle(
        DeleteCategoryCommand(
            category_id=category_id,
            tenant_id=_resolve_tenant(get_settings().tenant_id_default),
        )
    )


# ── GlassType routes ──────────────────────────────────────────────────────────


@router.get("/glass-types", response_model=list[GlassTypeResponse])
async def list_glass_types(
    current_user: CurrentUser = Depends(get_current_user),
    handler: ListGlassTypesHandler = Depends(get_list_glass_types_handler),
) -> list[GlassTypeResponse]:
    results = await handler.handle(
        ListGlassTypesQuery(tenant_id=_resolve_tenant(get_settings().tenant_id_default))
    )
    return [
        GlassTypeResponse(
            id=str(r.glass_type_id),
            name=r.name,
            is_active=r.is_active,
            created_at=r.created_at,
        )
        for r in results
    ]


@router.post(
    "/glass-types",
    response_model=GlassTypeResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_glass_type(
    body: CreateGlassTypeBody,
    _admin: CurrentUser = Depends(require_admin),
    handler: CreateGlassTypeHandler = Depends(get_create_glass_type_handler),
) -> GlassTypeResponse:
    result = await handler.handle(
        CreateGlassTypeCommand(
            tenant_id=_resolve_tenant(get_settings().tenant_id_default),
            name=body.name,
        )
    )
    return GlassTypeResponse(
        id=str(result.glass_type_id),
        name=result.name,
        is_active=result.is_active,
        created_at=result.created_at,
    )


@router.patch("/glass-types/{glass_type_id}", response_model=GlassTypeResponse)
async def update_glass_type(
    glass_type_id: UUID,
    body: UpdateGlassTypeBody,
    _admin: CurrentUser = Depends(require_admin),
    handler: UpdateGlassTypeHandler = Depends(get_update_glass_type_handler),
) -> GlassTypeResponse:
    result = await handler.handle(
        UpdateGlassTypeCommand(
            glass_type_id=glass_type_id,
            tenant_id=_resolve_tenant(get_settings().tenant_id_default),
            name=body.name,
        )
    )
    return GlassTypeResponse(
        id=str(result.glass_type_id),
        name=result.name,
        is_active=result.is_active,
        created_at=result.created_at,
    )


@router.delete("/glass-types/{glass_type_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_glass_type(
    glass_type_id: UUID,
    _admin: CurrentUser = Depends(require_admin),
    handler: DeleteGlassTypeHandler = Depends(get_delete_glass_type_handler),
) -> None:
    await handler.handle(
        DeleteGlassTypeCommand(
            glass_type_id=glass_type_id,
            tenant_id=_resolve_tenant(get_settings().tenant_id_default),
        )
    )


# ── Product routes ────────────────────────────────────────────────────────────


@router.get("/products", response_model=list[ProductResponse])
async def list_products(
    current_user: CurrentUser = Depends(get_current_user),
    handler: ListProductsHandler = Depends(get_list_products_handler),
) -> list[ProductResponse]:
    results = await handler.handle(
        ListProductsQuery(tenant_id=_resolve_tenant(get_settings().tenant_id_default))
    )
    return [_to_product_response(r) for r in results]


@router.post(
    "/products", response_model=ProductResponse, status_code=status.HTTP_201_CREATED
)
async def create_product(
    body: CreateProductBody,
    _admin: CurrentUser = Depends(require_admin),
    handler: CreateProductHandler = Depends(get_create_product_handler),
) -> ProductResponse:
    result = await handler.handle(
        CreateProductCommand(
            tenant_id=_resolve_tenant(get_settings().tenant_id_default),
            name=body.name,
            brand_id=body.brand_id,
            sale_price_per_m2=body.sale_price_per_m2,
            purchase_price_per_m2=body.purchase_price_per_m2,
            uv_percentage=body.uv_percentage,
            irr_percentage=body.irr_percentage,
            tser_percentage=body.tser_percentage,
            warranty_years=body.warranty_years,
            category_id=body.category_id,
            roll_width_cm=body.roll_width_cm,
            roll_length_m=body.roll_length_m,
            application_types=body.application_types,
            compatible_glass_ids=body.compatible_glass_ids,
            technical_sheet_url=body.technical_sheet_url,
        )
    )
    return _to_product_response(result)


@router.get("/products/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    handler: GetProductHandler = Depends(get_product_handler),
) -> ProductResponse:
    result = await handler.handle(
        GetProductQuery(
            product_id=product_id,
            tenant_id=_resolve_tenant(get_settings().tenant_id_default),
        )
    )
    return _to_product_response(result)


@router.patch("/products/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: UUID,
    body: UpdateProductBody,
    _admin: CurrentUser = Depends(require_admin),
    handler: UpdateProductHandler = Depends(get_update_product_handler),
) -> ProductResponse:
    result = await handler.handle(
        UpdateProductCommand(
            product_id=product_id,
            tenant_id=_resolve_tenant(get_settings().tenant_id_default),
            name=body.name,
            brand_id=body.brand_id,
            sale_price_per_m2=body.sale_price_per_m2,
            purchase_price_per_m2=body.purchase_price_per_m2,
            uv_percentage=body.uv_percentage,
            irr_percentage=body.irr_percentage,
            tser_percentage=body.tser_percentage,
            warranty_years=body.warranty_years,
            category_id=body.category_id,
            roll_width_cm=body.roll_width_cm,
            roll_length_m=body.roll_length_m,
            application_types=body.application_types,
            compatible_glass_ids=body.compatible_glass_ids,
            technical_sheet_url=body.technical_sheet_url,
            clear_technical_sheet=body.clear_technical_sheet,
            is_active=body.is_active,
        )
    )
    return _to_product_response(result)


@router.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(
    product_id: UUID,
    _admin: CurrentUser = Depends(require_admin),
    handler: DeleteProductHandler = Depends(get_delete_product_handler),
) -> None:
    await handler.handle(
        DeleteProductCommand(
            product_id=product_id,
            tenant_id=_resolve_tenant(get_settings().tenant_id_default),
        )
    )


def _to_product_response(r: object) -> ProductResponse:
    return ProductResponse(
        id=str(r.product_id),  # type: ignore[attr-defined]
        tenant_id=r.tenant_id,  # type: ignore[attr-defined]
        name=r.name,  # type: ignore[attr-defined]
        brand_id=str(r.brand_id),  # type: ignore[attr-defined]
        sale_price_per_m2=r.sale_price_per_m2,  # type: ignore[attr-defined]
        purchase_price_per_m2=r.purchase_price_per_m2,  # type: ignore[attr-defined]
        uv_percentage=r.uv_percentage,  # type: ignore[attr-defined]
        irr_percentage=r.irr_percentage,  # type: ignore[attr-defined]
        tser_percentage=r.tser_percentage,  # type: ignore[attr-defined]
        warranty_years=r.warranty_years,  # type: ignore[attr-defined]
        category_id=str(r.category_id),  # type: ignore[attr-defined]
        roll_width_cm=r.roll_width_cm,  # type: ignore[attr-defined]
        roll_length_m=r.roll_length_m,  # type: ignore[attr-defined]
        application_types=r.application_types,  # type: ignore[attr-defined]
        compatible_glass_ids=[str(gid) for gid in r.compatible_glass_ids],  # type: ignore[attr-defined]
        technical_sheet_url=r.technical_sheet_url,  # type: ignore[attr-defined]
        is_active=r.is_active,  # type: ignore[attr-defined]
        created_at=r.created_at,  # type: ignore[attr-defined]
    )
