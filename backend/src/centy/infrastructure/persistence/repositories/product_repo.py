from decimal import Decimal
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from centy.application.ports.repositories import (
    IBrandRepository,
    IGlassTypeRepository,
    IProductCategoryRepository,
    IProductRepository,
)
from centy.domain.catalog.entities import Brand, GlassType, Product, ProductCategory
from centy.domain.catalog.value_objects import ApplicationType, Percentage
from centy.domain.shared.value_objects import Money, TenantId
from centy.infrastructure.persistence.models.product import (
    BrandModel,
    GlassTypeModel,
    ProductCategoryModel,
    ProductGlassTypeModel,
    ProductModel,
)

# ── Brand repository ──────────────────────────────────────────────────────────


class SQLAlchemyBrandRepository(IBrandRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, brand_id: UUID, tenant_id: TenantId) -> Brand | None:
        result = await self._session.execute(
            select(BrandModel).where(
                BrandModel.id == str(brand_id),
                BrandModel.tenant_id == str(tenant_id),
            )
        )
        row = result.scalar_one_or_none()
        return _brand_to_domain(row) if row else None

    async def save(self, brand: Brand) -> None:
        existing = await self._session.get(BrandModel, str(brand.id))
        if existing:
            existing.name = brand.name
            existing.color = brand.color
            existing.logo_url = brand.logo_url
            existing.is_active = brand.is_active
        else:
            self._session.add(
                BrandModel(
                    id=str(brand.id),
                    tenant_id=str(brand.tenant_id),
                    name=brand.name,
                    color=brand.color,
                    logo_url=brand.logo_url,
                    is_active=brand.is_active,
                    created_at=brand.created_at,
                )
            )

    async def list_by_tenant(self, tenant_id: TenantId) -> list[Brand]:
        result = await self._session.execute(
            select(BrandModel)
            .where(BrandModel.tenant_id == str(tenant_id))
            .order_by(BrandModel.name)
        )
        return [_brand_to_domain(row) for row in result.scalars()]

    async def delete(self, brand_id: UUID, tenant_id: TenantId) -> None:
        await self._session.execute(
            delete(BrandModel).where(
                BrandModel.id == str(brand_id),
                BrandModel.tenant_id == str(tenant_id),
            )
        )


def _brand_to_domain(row: BrandModel) -> Brand:
    b = Brand.__new__(Brand)
    b.id = UUID(row.id)
    b.tenant_id = TenantId(UUID(row.tenant_id))
    b.name = row.name
    b.color = row.color
    b.logo_url = row.logo_url
    b.is_active = row.is_active
    b.created_at = row.created_at
    return b


# ── ProductCategory repository ────────────────────────────────────────────────


class SQLAlchemyProductCategoryRepository(IProductCategoryRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(
        self, category_id: UUID, tenant_id: TenantId
    ) -> ProductCategory | None:
        result = await self._session.execute(
            select(ProductCategoryModel).where(
                ProductCategoryModel.id == str(category_id),
                ProductCategoryModel.tenant_id == str(tenant_id),
            )
        )
        row = result.scalar_one_or_none()
        return _category_to_domain(row) if row else None

    async def save(self, category: ProductCategory) -> None:
        existing = await self._session.get(ProductCategoryModel, str(category.id))
        if existing:
            existing.name = category.name
            existing.is_active = category.is_active
        else:
            self._session.add(
                ProductCategoryModel(
                    id=str(category.id),
                    tenant_id=str(category.tenant_id),
                    name=category.name,
                    is_active=category.is_active,
                    created_at=category.created_at,
                )
            )

    async def list_by_tenant(self, tenant_id: TenantId) -> list[ProductCategory]:
        result = await self._session.execute(
            select(ProductCategoryModel)
            .where(ProductCategoryModel.tenant_id == str(tenant_id))
            .order_by(ProductCategoryModel.name)
        )
        return [_category_to_domain(row) for row in result.scalars()]

    async def delete(self, category_id: UUID, tenant_id: TenantId) -> None:
        await self._session.execute(
            delete(ProductCategoryModel).where(
                ProductCategoryModel.id == str(category_id),
                ProductCategoryModel.tenant_id == str(tenant_id),
            )
        )


def _category_to_domain(row: ProductCategoryModel) -> ProductCategory:
    c = ProductCategory.__new__(ProductCategory)
    c.id = UUID(row.id)
    c.tenant_id = TenantId(UUID(row.tenant_id))
    c.name = row.name
    c.is_active = row.is_active
    c.created_at = row.created_at
    return c


# ── GlassType repository ──────────────────────────────────────────────────────


class SQLAlchemyGlassTypeRepository(IGlassTypeRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(
        self, glass_type_id: UUID, tenant_id: TenantId
    ) -> GlassType | None:
        result = await self._session.execute(
            select(GlassTypeModel).where(
                GlassTypeModel.id == str(glass_type_id),
                GlassTypeModel.tenant_id == str(tenant_id),
            )
        )
        row = result.scalar_one_or_none()
        return _glass_type_to_domain(row) if row else None

    async def save(self, glass_type: GlassType) -> None:
        existing = await self._session.get(GlassTypeModel, str(glass_type.id))
        if existing:
            existing.name = glass_type.name
            existing.is_active = glass_type.is_active
        else:
            self._session.add(
                GlassTypeModel(
                    id=str(glass_type.id),
                    tenant_id=str(glass_type.tenant_id),
                    name=glass_type.name,
                    is_active=glass_type.is_active,
                    created_at=glass_type.created_at,
                )
            )

    async def list_by_tenant(self, tenant_id: TenantId) -> list[GlassType]:
        result = await self._session.execute(
            select(GlassTypeModel)
            .where(GlassTypeModel.tenant_id == str(tenant_id))
            .order_by(GlassTypeModel.name)
        )
        return [_glass_type_to_domain(row) for row in result.scalars()]

    async def delete(self, glass_type_id: UUID, tenant_id: TenantId) -> None:
        await self._session.execute(
            delete(GlassTypeModel).where(
                GlassTypeModel.id == str(glass_type_id),
                GlassTypeModel.tenant_id == str(tenant_id),
            )
        )


def _glass_type_to_domain(row: GlassTypeModel) -> GlassType:
    g = GlassType.__new__(GlassType)
    g.id = UUID(row.id)
    g.tenant_id = TenantId(UUID(row.tenant_id))
    g.name = row.name
    g.is_active = row.is_active
    g.created_at = row.created_at
    return g


# ── Product repository ────────────────────────────────────────────────────────


class SQLAlchemyProductRepository(IProductRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, product_id: UUID, tenant_id: TenantId) -> Product | None:
        result = await self._session.execute(
            select(ProductModel).where(
                ProductModel.id == str(product_id),
                ProductModel.tenant_id == str(tenant_id),
            )
        )
        row = result.scalar_one_or_none()
        if row is None:
            return None
        glass_ids = await self._load_glass_ids(str(product_id))
        return _product_to_domain(row, glass_ids)

    async def save(self, product: Product) -> None:
        existing = await self._session.get(ProductModel, str(product.id))
        if existing:
            existing.name = product.name
            existing.brand_id = str(product.brand_id)
            existing.category_id = str(product.category_id)
            existing.sale_price_per_m2 = float(product.sale_price_per_m2.amount)
            existing.purchase_price_per_m2 = float(product.purchase_price_per_m2.amount)
            existing.uv_percentage = float(product.uv_percentage.value)
            existing.irr_percentage = float(product.irr_percentage.value)
            existing.tser_percentage = float(product.tser_percentage.value)
            existing.warranty_years = product.warranty_years
            existing.roll_width_cm = float(product.roll_width_cm)
            existing.roll_length_m = float(product.roll_length_m)
            existing.application_types = [t.value for t in product.application_types]
            existing.technical_sheet_url = product.technical_sheet_url
            existing.is_active = product.is_active
        else:
            self._session.add(
                ProductModel(
                    id=str(product.id),
                    tenant_id=str(product.tenant_id),
                    name=product.name,
                    brand_id=str(product.brand_id),
                    category_id=str(product.category_id),
                    sale_price_per_m2=float(product.sale_price_per_m2.amount),
                    purchase_price_per_m2=float(product.purchase_price_per_m2.amount),
                    uv_percentage=float(product.uv_percentage.value),
                    irr_percentage=float(product.irr_percentage.value),
                    tser_percentage=float(product.tser_percentage.value),
                    warranty_years=product.warranty_years,
                    roll_width_cm=float(product.roll_width_cm),
                    roll_length_m=float(product.roll_length_m),
                    application_types=[t.value for t in product.application_types],
                    technical_sheet_url=product.technical_sheet_url,
                    is_active=product.is_active,
                    created_at=product.created_at,
                )
            )

        await self._sync_glass_types(str(product.id), product.compatible_glass_ids)

    async def list_by_tenant(self, tenant_id: TenantId) -> list[Product]:
        result = await self._session.execute(
            select(ProductModel)
            .where(ProductModel.tenant_id == str(tenant_id))
            .order_by(ProductModel.name)
        )
        rows = result.scalars().all()

        glass_map = await self._load_glass_ids_bulk([row.id for row in rows])
        return [_product_to_domain(row, glass_map.get(row.id, [])) for row in rows]

    async def delete(self, product_id: UUID, tenant_id: TenantId) -> None:
        await self._session.execute(
            delete(ProductModel).where(
                ProductModel.id == str(product_id),
                ProductModel.tenant_id == str(tenant_id),
            )
        )

    async def _load_glass_ids(self, product_id: str) -> list[UUID]:
        result = await self._session.execute(
            select(ProductGlassTypeModel.glass_type_id).where(
                ProductGlassTypeModel.product_id == product_id
            )
        )
        return [UUID(row) for row in result.scalars()]

    async def _load_glass_ids_bulk(
        self, product_ids: list[str]
    ) -> dict[str, list[UUID]]:
        if not product_ids:
            return {}
        result = await self._session.execute(
            select(ProductGlassTypeModel).where(
                ProductGlassTypeModel.product_id.in_(product_ids)
            )
        )
        glass_map: dict[str, list[UUID]] = {}
        for row in result.scalars():
            glass_map.setdefault(row.product_id, []).append(UUID(row.glass_type_id))
        return glass_map

    async def _sync_glass_types(self, product_id: str, glass_ids: list[UUID]) -> None:
        await self._session.execute(
            delete(ProductGlassTypeModel).where(
                ProductGlassTypeModel.product_id == product_id
            )
        )
        for gid in glass_ids:
            self._session.add(
                ProductGlassTypeModel(
                    product_id=product_id,
                    glass_type_id=str(gid),
                )
            )


def _product_to_domain(row: ProductModel, glass_ids: list[UUID]) -> Product:
    p = Product.__new__(Product)
    p.id = UUID(row.id)
    p.tenant_id = TenantId(UUID(row.tenant_id))
    p.name = row.name
    p.brand_id = UUID(row.brand_id)
    p.category_id = UUID(row.category_id)
    p.sale_price_per_m2 = Money(Decimal(str(row.sale_price_per_m2)))
    p.purchase_price_per_m2 = Money(Decimal(str(row.purchase_price_per_m2)))
    p.uv_percentage = Percentage(Decimal(str(row.uv_percentage)))
    p.irr_percentage = Percentage(Decimal(str(row.irr_percentage)))
    p.tser_percentage = Percentage(Decimal(str(row.tser_percentage)))
    p.warranty_years = row.warranty_years
    p.roll_width_cm = Decimal(str(row.roll_width_cm))
    p.roll_length_m = Decimal(str(row.roll_length_m))
    p.application_types = [ApplicationType(t) for t in row.application_types]
    p.compatible_glass_ids = glass_ids
    p.technical_sheet_url = row.technical_sheet_url
    p.is_active = row.is_active
    p.created_at = row.created_at
    return p
