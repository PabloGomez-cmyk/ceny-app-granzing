from dataclasses import dataclass
from decimal import Decimal
from uuid import UUID

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
from centy.application.catalog.queries import (
    GetBrandQuery,
    GetCategoryQuery,
    GetGlassTypeQuery,
    GetProductQuery,
    ListBrandsQuery,
    ListCategoriesQuery,
    ListGlassTypesQuery,
    ListProductsQuery,
)
from centy.application.ports.repositories import (
    IBrandRepository,
    IGlassTypeRepository,
    IProductCategoryRepository,
    IProductRepository,
)
from centy.application.ports.unit_of_work import IUnitOfWork
from centy.domain.catalog.entities import Brand, GlassType, Product, ProductCategory
from centy.domain.shared.exceptions import ConflictError, NotFoundError

# ── Result dataclasses ────────────────────────────────────────────────────────


@dataclass(frozen=True)
class BrandResult:
    brand_id: UUID
    name: str
    color: str
    logo_url: str | None
    is_active: bool
    created_at: str


@dataclass(frozen=True)
class CategoryResult:
    category_id: UUID
    name: str
    is_active: bool
    created_at: str


@dataclass(frozen=True)
class GlassTypeResult:
    glass_type_id: UUID
    name: str
    is_active: bool
    created_at: str


@dataclass(frozen=True)
class ProductResult:
    product_id: UUID
    tenant_id: str
    name: str
    brand_id: UUID
    sale_price_per_m2: Decimal
    purchase_price_per_m2: Decimal
    uv_percentage: Decimal
    irr_percentage: Decimal
    tser_percentage: Decimal
    warranty_years: int
    category_id: UUID
    roll_width_cm: Decimal
    roll_length_m: Decimal
    application_types: list[str]
    compatible_glass_ids: list[UUID]
    technical_sheet_url: str | None
    is_active: bool
    created_at: str
    sale_price_per_unit: Decimal
    purchase_price_per_unit: Decimal
    default_sale_unit: str


# ── Mappers ───────────────────────────────────────────────────────────────────


def _brand_result(b: Brand) -> BrandResult:
    return BrandResult(
        brand_id=b.id,
        name=b.name,
        color=b.color,
        logo_url=b.logo_url,
        is_active=b.is_active,
        created_at=b.created_at.isoformat(),
    )


def _category_result(c: ProductCategory) -> CategoryResult:
    return CategoryResult(
        category_id=c.id,
        name=c.name,
        is_active=c.is_active,
        created_at=c.created_at.isoformat(),
    )


def _glass_type_result(g: GlassType) -> GlassTypeResult:
    return GlassTypeResult(
        glass_type_id=g.id,
        name=g.name,
        is_active=g.is_active,
        created_at=g.created_at.isoformat(),
    )


def _product_result(p: Product) -> ProductResult:
    return ProductResult(
        product_id=p.id,
        tenant_id=str(p.tenant_id),
        name=p.name,
        brand_id=p.brand_id,
        sale_price_per_m2=p.sale_price_per_m2.amount,
        purchase_price_per_m2=p.purchase_price_per_m2.amount,
        uv_percentage=p.uv_percentage.value,
        irr_percentage=p.irr_percentage.value,
        tser_percentage=p.tser_percentage.value,
        warranty_years=p.warranty_years,
        category_id=p.category_id,
        roll_width_cm=p.roll_width_cm,
        roll_length_m=p.roll_length_m,
        application_types=[t.value for t in p.application_types],
        compatible_glass_ids=list(p.compatible_glass_ids),
        technical_sheet_url=p.technical_sheet_url,
        is_active=p.is_active,
        created_at=p.created_at.isoformat(),
        sale_price_per_unit=p.sale_price_per_unit.amount,
        purchase_price_per_unit=p.purchase_price_per_unit.amount,
        default_sale_unit=p.default_sale_unit.value,
    )


# ── Brand handlers ────────────────────────────────────────────────────────────


class CreateBrandHandler:
    def __init__(self, uow: IUnitOfWork) -> None:
        self._uow = uow

    async def handle(self, command: CreateBrandCommand) -> BrandResult:
        async with self._uow as uow:
            brand = Brand.create(
                tenant_id=command.tenant_id,
                name=command.name,
                color=command.color,
                logo_url=command.logo_url,
            )
            await uow.brands.save(brand)
            await uow.commit()
        return _brand_result(brand)


class GetBrandHandler:
    def __init__(self, repo: IBrandRepository) -> None:
        self._repo = repo

    async def handle(self, query: GetBrandQuery) -> BrandResult:
        brand = await self._repo.get_by_id(query.brand_id, query.tenant_id)
        if brand is None:
            raise NotFoundError(f"Marca {query.brand_id} no encontrada")
        return _brand_result(brand)


class ListBrandsHandler:
    def __init__(self, repo: IBrandRepository) -> None:
        self._repo = repo

    async def handle(self, query: ListBrandsQuery) -> list[BrandResult]:
        brands = await self._repo.list_by_tenant(query.tenant_id)
        return [_brand_result(b) for b in brands]


class UpdateBrandHandler:
    def __init__(self, uow: IUnitOfWork) -> None:
        self._uow = uow

    async def handle(self, command: UpdateBrandCommand) -> BrandResult:
        async with self._uow as uow:
            brand = await uow.brands.get_by_id(command.brand_id, command.tenant_id)
            if brand is None:
                raise NotFoundError(f"Marca {command.brand_id} no encontrada")
            brand.update(
                name=command.name,
                color=command.color,
                logo_url=command.logo_url,
                clear_logo=command.clear_logo,
            )
            await uow.brands.save(brand)
            await uow.commit()
        return _brand_result(brand)


class DeleteBrandHandler:
    def __init__(self, uow: IUnitOfWork) -> None:
        self._uow = uow

    async def handle(self, command: DeleteBrandCommand) -> None:
        async with self._uow as uow:
            brand = await uow.brands.get_by_id(command.brand_id, command.tenant_id)
            if brand is None:
                raise NotFoundError(f"Marca {command.brand_id} no encontrada")
            products = await uow.products.list_by_tenant(command.tenant_id)
            if any(p.brand_id == command.brand_id for p in products):
                raise ConflictError(
                    "No se puede eliminar la marca porque hay productos que la "
                    "usan. Reasigná o eliminá esos productos primero."
                )
            await uow.brands.delete(command.brand_id, command.tenant_id)
            await uow.commit()


# ── ProductCategory handlers ──────────────────────────────────────────────────


class CreateCategoryHandler:
    def __init__(self, uow: IUnitOfWork) -> None:
        self._uow = uow

    async def handle(self, command: CreateCategoryCommand) -> CategoryResult:
        async with self._uow as uow:
            category = ProductCategory.create(
                tenant_id=command.tenant_id,
                name=command.name,
            )
            await uow.product_categories.save(category)
            await uow.commit()
        return _category_result(category)


class GetCategoryHandler:
    def __init__(self, repo: IProductCategoryRepository) -> None:
        self._repo = repo

    async def handle(self, query: GetCategoryQuery) -> CategoryResult:
        cat = await self._repo.get_by_id(query.category_id, query.tenant_id)
        if cat is None:
            raise NotFoundError(f"Categoría {query.category_id} no encontrada")
        return _category_result(cat)


class ListCategoriesHandler:
    def __init__(self, repo: IProductCategoryRepository) -> None:
        self._repo = repo

    async def handle(self, query: ListCategoriesQuery) -> list[CategoryResult]:
        cats = await self._repo.list_by_tenant(query.tenant_id)
        return [_category_result(c) for c in cats]


class UpdateCategoryHandler:
    def __init__(self, uow: IUnitOfWork) -> None:
        self._uow = uow

    async def handle(self, command: UpdateCategoryCommand) -> CategoryResult:
        async with self._uow as uow:
            cat = await uow.product_categories.get_by_id(
                command.category_id, command.tenant_id
            )
            if cat is None:
                raise NotFoundError(f"Categoría {command.category_id} no encontrada")
            if command.name is not None:
                cat.rename(command.name)
            await uow.product_categories.save(cat)
            await uow.commit()
        return _category_result(cat)


class DeleteCategoryHandler:
    def __init__(self, uow: IUnitOfWork) -> None:
        self._uow = uow

    async def handle(self, command: DeleteCategoryCommand) -> None:
        async with self._uow as uow:
            cat = await uow.product_categories.get_by_id(
                command.category_id, command.tenant_id
            )
            if cat is None:
                raise NotFoundError(f"Categoría {command.category_id} no encontrada")
            products = await uow.products.list_by_tenant(command.tenant_id)
            if any(p.category_id == command.category_id for p in products):
                raise ConflictError(
                    "No se puede eliminar la categoría porque hay productos que "
                    "la usan. Reasigná o eliminá esos productos primero."
                )
            await uow.product_categories.delete(command.category_id, command.tenant_id)
            await uow.commit()


# ── GlassType handlers ────────────────────────────────────────────────────────


class CreateGlassTypeHandler:
    def __init__(self, uow: IUnitOfWork) -> None:
        self._uow = uow

    async def handle(self, command: CreateGlassTypeCommand) -> GlassTypeResult:
        async with self._uow as uow:
            glass_type = GlassType.create(
                tenant_id=command.tenant_id,
                name=command.name,
            )
            await uow.glass_types.save(glass_type)
            await uow.commit()
        return _glass_type_result(glass_type)


class GetGlassTypeHandler:
    def __init__(self, repo: IGlassTypeRepository) -> None:
        self._repo = repo

    async def handle(self, query: GetGlassTypeQuery) -> GlassTypeResult:
        gt = await self._repo.get_by_id(query.glass_type_id, query.tenant_id)
        if gt is None:
            raise NotFoundError(f"Tipo de vidrio {query.glass_type_id} no encontrado")
        return _glass_type_result(gt)


class ListGlassTypesHandler:
    def __init__(self, repo: IGlassTypeRepository) -> None:
        self._repo = repo

    async def handle(self, query: ListGlassTypesQuery) -> list[GlassTypeResult]:
        glass_types = await self._repo.list_by_tenant(query.tenant_id)
        return [_glass_type_result(g) for g in glass_types]


class UpdateGlassTypeHandler:
    def __init__(self, uow: IUnitOfWork) -> None:
        self._uow = uow

    async def handle(self, command: UpdateGlassTypeCommand) -> GlassTypeResult:
        async with self._uow as uow:
            gt = await uow.glass_types.get_by_id(
                command.glass_type_id, command.tenant_id
            )
            if gt is None:
                raise NotFoundError(
                    f"Tipo de vidrio {command.glass_type_id} no encontrado"
                )
            if command.name is not None:
                gt.rename(command.name)
            await uow.glass_types.save(gt)
            await uow.commit()
        return _glass_type_result(gt)


class DeleteGlassTypeHandler:
    def __init__(self, uow: IUnitOfWork) -> None:
        self._uow = uow

    async def handle(self, command: DeleteGlassTypeCommand) -> None:
        async with self._uow as uow:
            gt = await uow.glass_types.get_by_id(
                command.glass_type_id, command.tenant_id
            )
            if gt is None:
                raise NotFoundError(
                    f"Tipo de vidrio {command.glass_type_id} no encontrado"
                )
            await uow.glass_types.delete(command.glass_type_id, command.tenant_id)
            await uow.commit()


# ── Product handlers ──────────────────────────────────────────────────────────


class CreateProductHandler:
    def __init__(self, uow: IUnitOfWork) -> None:
        self._uow = uow

    async def handle(self, command: CreateProductCommand) -> ProductResult:
        async with self._uow as uow:
            product = Product.create(
                tenant_id=command.tenant_id,
                name=command.name,
                brand_id=command.brand_id,
                sale_price_per_m2=command.sale_price_per_m2,
                purchase_price_per_m2=command.purchase_price_per_m2,
                uv_percentage=command.uv_percentage,
                irr_percentage=command.irr_percentage,
                tser_percentage=command.tser_percentage,
                warranty_years=command.warranty_years,
                category_id=command.category_id,
                roll_width_cm=command.roll_width_cm,
                roll_length_m=command.roll_length_m,
                application_types=command.application_types,
                compatible_glass_ids=command.compatible_glass_ids,
                technical_sheet_url=command.technical_sheet_url,
                sale_price_per_unit=command.sale_price_per_unit,
                purchase_price_per_unit=command.purchase_price_per_unit,
                default_sale_unit=command.default_sale_unit,
            )
            await uow.products.save(product)
            await uow.commit()
        return _product_result(product)


class GetProductHandler:
    def __init__(self, repo: IProductRepository) -> None:
        self._repo = repo

    async def handle(self, query: GetProductQuery) -> ProductResult:
        product = await self._repo.get_by_id(query.product_id, query.tenant_id)
        if product is None:
            raise NotFoundError(f"Producto {query.product_id} no encontrado")
        return _product_result(product)


class ListProductsHandler:
    def __init__(self, repo: IProductRepository) -> None:
        self._repo = repo

    async def handle(self, query: ListProductsQuery) -> list[ProductResult]:
        products = await self._repo.list_by_tenant(query.tenant_id)
        return [_product_result(p) for p in products]


class UpdateProductHandler:
    def __init__(self, uow: IUnitOfWork) -> None:
        self._uow = uow

    async def handle(self, command: UpdateProductCommand) -> ProductResult:
        async with self._uow as uow:
            product = await uow.products.get_by_id(
                command.product_id, command.tenant_id
            )
            if product is None:
                raise NotFoundError(f"Producto {command.product_id} no encontrado")
            if command.is_active is not None:
                if command.is_active and not product.is_active:
                    product.reactivate()
                elif not command.is_active and product.is_active:
                    product.deactivate()
            product.update(
                name=command.name,
                brand_id=command.brand_id,
                sale_price_per_m2=command.sale_price_per_m2,
                purchase_price_per_m2=command.purchase_price_per_m2,
                uv_percentage=command.uv_percentage,
                irr_percentage=command.irr_percentage,
                tser_percentage=command.tser_percentage,
                warranty_years=command.warranty_years,
                category_id=command.category_id,
                roll_width_cm=command.roll_width_cm,
                roll_length_m=command.roll_length_m,
                application_types=command.application_types,
                compatible_glass_ids=command.compatible_glass_ids,
                technical_sheet_url=command.technical_sheet_url,
                clear_technical_sheet=command.clear_technical_sheet,
                sale_price_per_unit=command.sale_price_per_unit,
                purchase_price_per_unit=command.purchase_price_per_unit,
                default_sale_unit=command.default_sale_unit,
            )
            await uow.products.save(product)
            await uow.commit()
        return _product_result(product)


class DeleteProductHandler:
    def __init__(self, uow: IUnitOfWork) -> None:
        self._uow = uow

    async def handle(self, command: DeleteProductCommand) -> None:
        async with self._uow as uow:
            product = await uow.products.get_by_id(
                command.product_id, command.tenant_id
            )
            if product is None:
                raise NotFoundError(f"Producto {command.product_id} no encontrado")
            await uow.products.delete(command.product_id, command.tenant_id)
            await uow.commit()
