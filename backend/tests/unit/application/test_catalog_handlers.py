"""Tests para los use cases del catálogo (Brand, Category, GlassType, Product)."""

from decimal import Decimal
from uuid import UUID, uuid4

import pytest

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
    GetCategoryHandler,
    GetGlassTypeHandler,
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
    GetCategoryQuery,
    GetGlassTypeQuery,
    GetProductQuery,
    ListBrandsQuery,
    ListCategoriesQuery,
    ListGlassTypesQuery,
    ListProductsQuery,
)
from centy.domain.shared.exceptions import NotFoundError
from centy.domain.shared.value_objects import TenantId
from tests.conftest import FakeUnitOfWork

# ── Fixtures ──────────────────────────────────────────────────────────────────


@pytest.fixture
def tenant_id() -> TenantId:
    return TenantId(uuid4())


@pytest.fixture
def uow() -> FakeUnitOfWork:
    return FakeUnitOfWork()


# ── Brand handlers ────────────────────────────────────────────────────────────


class TestCreateBrandHandler:
    async def test_crea_marca_correctamente(
        self, uow: FakeUnitOfWork, tenant_id: TenantId
    ) -> None:
        handler = CreateBrandHandler(uow)
        result = await handler.handle(
            CreateBrandCommand(tenant_id=tenant_id, name="3M", color="#0f6e50")
        )
        assert result.name == "3M"
        assert result.color == "#0f6e50"
        assert result.is_active is True
        assert result.logo_url is None

    async def test_crea_con_logo_url(
        self, uow: FakeUnitOfWork, tenant_id: TenantId
    ) -> None:
        handler = CreateBrandHandler(uow)
        result = await handler.handle(
            CreateBrandCommand(
                tenant_id=tenant_id,
                name="Madico",
                color="#3b82f6",
                logo_url="https://cdn.example.com/madico.png",
            )
        )
        assert result.logo_url == "https://cdn.example.com/madico.png"

    async def test_hace_commit(self, uow: FakeUnitOfWork, tenant_id: TenantId) -> None:
        await CreateBrandHandler(uow).handle(
            CreateBrandCommand(tenant_id=tenant_id, name="Brand", color="#000000")
        )
        assert uow.committed is True

    async def test_persiste_en_repositorio(
        self, uow: FakeUnitOfWork, tenant_id: TenantId
    ) -> None:
        result = await CreateBrandHandler(uow).handle(
            CreateBrandCommand(tenant_id=tenant_id, name="Persistida", color="#000000")
        )
        saved = await uow.brands.get_by_id(result.brand_id, tenant_id)
        assert saved is not None
        assert saved.name == "Persistida"

    async def test_retorna_brand_id(
        self, uow: FakeUnitOfWork, tenant_id: TenantId
    ) -> None:
        result = await CreateBrandHandler(uow).handle(
            CreateBrandCommand(tenant_id=tenant_id, name="Cualquiera", color="#000000")
        )
        assert isinstance(result.brand_id, UUID)


class TestGetBrandHandler:
    async def test_devuelve_marca_existente(
        self, uow: FakeUnitOfWork, tenant_id: TenantId
    ) -> None:
        created = await CreateBrandHandler(uow).handle(
            CreateBrandCommand(tenant_id=tenant_id, name="3M", color="#0f6e50")
        )
        result = await GetBrandHandler(uow.brands).handle(
            GetBrandQuery(brand_id=created.brand_id, tenant_id=tenant_id)
        )
        assert result.name == "3M"

    async def test_marca_inexistente_lanza_not_found(
        self, uow: FakeUnitOfWork, tenant_id: TenantId
    ) -> None:
        with pytest.raises(NotFoundError):
            await GetBrandHandler(uow.brands).handle(
                GetBrandQuery(brand_id=uuid4(), tenant_id=tenant_id)
            )


class TestListBrandsHandler:
    async def test_devuelve_todas_las_marcas_del_tenant(
        self, uow: FakeUnitOfWork, tenant_id: TenantId
    ) -> None:
        create = CreateBrandHandler(uow)
        await create.handle(
            CreateBrandCommand(tenant_id=tenant_id, name="A", color="#000000")
        )
        await create.handle(
            CreateBrandCommand(tenant_id=tenant_id, name="B", color="#111111")
        )

        results = await ListBrandsHandler(uow.brands).handle(
            ListBrandsQuery(tenant_id=tenant_id)
        )
        assert len(results) == 2
        names = {r.name for r in results}
        assert names == {"A", "B"}

    async def test_no_devuelve_marcas_de_otro_tenant(
        self, uow: FakeUnitOfWork, tenant_id: TenantId
    ) -> None:
        otro = TenantId(uuid4())
        await CreateBrandHandler(uow).handle(
            CreateBrandCommand(tenant_id=otro, name="Ajena", color="#000000")
        )
        results = await ListBrandsHandler(uow.brands).handle(
            ListBrandsQuery(tenant_id=tenant_id)
        )
        assert results == []

    async def test_devuelve_lista_vacia_si_no_hay_marcas(
        self, uow: FakeUnitOfWork, tenant_id: TenantId
    ) -> None:
        results = await ListBrandsHandler(uow.brands).handle(
            ListBrandsQuery(tenant_id=tenant_id)
        )
        assert results == []


class TestUpdateBrandHandler:
    async def test_actualiza_nombre(
        self, uow: FakeUnitOfWork, tenant_id: TenantId
    ) -> None:
        created = await CreateBrandHandler(uow).handle(
            CreateBrandCommand(tenant_id=tenant_id, name="Viejo", color="#000000")
        )
        uow.committed = False

        result = await UpdateBrandHandler(uow).handle(
            UpdateBrandCommand(
                brand_id=created.brand_id, tenant_id=tenant_id, name="Nuevo"
            )
        )
        assert result.name == "Nuevo"
        assert uow.committed is True

    async def test_actualiza_color(
        self, uow: FakeUnitOfWork, tenant_id: TenantId
    ) -> None:
        created = await CreateBrandHandler(uow).handle(
            CreateBrandCommand(tenant_id=tenant_id, name="3M", color="#000000")
        )
        result = await UpdateBrandHandler(uow).handle(
            UpdateBrandCommand(
                brand_id=created.brand_id, tenant_id=tenant_id, color="#ffffff"
            )
        )
        assert result.color == "#ffffff"

    async def test_clear_logo(self, uow: FakeUnitOfWork, tenant_id: TenantId) -> None:
        created = await CreateBrandHandler(uow).handle(
            CreateBrandCommand(
                tenant_id=tenant_id,
                name="3M",
                color="#000000",
                logo_url="https://cdn.example.com/logo.png",
            )
        )
        result = await UpdateBrandHandler(uow).handle(
            UpdateBrandCommand(
                brand_id=created.brand_id, tenant_id=tenant_id, clear_logo=True
            )
        )
        assert result.logo_url is None

    async def test_marca_inexistente_lanza_not_found(
        self, uow: FakeUnitOfWork, tenant_id: TenantId
    ) -> None:
        with pytest.raises(NotFoundError):
            await UpdateBrandHandler(uow).handle(
                UpdateBrandCommand(brand_id=uuid4(), tenant_id=tenant_id, name="X")
            )


class TestDeleteBrandHandler:
    async def test_elimina_marca(
        self, uow: FakeUnitOfWork, tenant_id: TenantId
    ) -> None:
        created = await CreateBrandHandler(uow).handle(
            CreateBrandCommand(tenant_id=tenant_id, name="Para borrar", color="#000000")
        )
        uow.committed = False

        await DeleteBrandHandler(uow).handle(
            DeleteBrandCommand(brand_id=created.brand_id, tenant_id=tenant_id)
        )
        assert uow.committed is True
        saved = await uow.brands.get_by_id(created.brand_id, tenant_id)
        assert saved is None

    async def test_marca_inexistente_lanza_not_found(
        self, uow: FakeUnitOfWork, tenant_id: TenantId
    ) -> None:
        with pytest.raises(NotFoundError):
            await DeleteBrandHandler(uow).handle(
                DeleteBrandCommand(brand_id=uuid4(), tenant_id=tenant_id)
            )


# ── ProductCategory handlers ──────────────────────────────────────────────────


class TestCreateCategoryHandler:
    async def test_crea_categoria_correctamente(
        self, uow: FakeUnitOfWork, tenant_id: TenantId
    ) -> None:
        result = await CreateCategoryHandler(uow).handle(
            CreateCategoryCommand(tenant_id=tenant_id, name="Solar")
        )
        assert result.name == "Solar"
        assert result.is_active is True

    async def test_hace_commit(self, uow: FakeUnitOfWork, tenant_id: TenantId) -> None:
        await CreateCategoryHandler(uow).handle(
            CreateCategoryCommand(tenant_id=tenant_id, name="Seguridad")
        )
        assert uow.committed is True

    async def test_persiste_en_repositorio(
        self, uow: FakeUnitOfWork, tenant_id: TenantId
    ) -> None:
        result = await CreateCategoryHandler(uow).handle(
            CreateCategoryCommand(tenant_id=tenant_id, name="Privacidad")
        )
        saved = await uow.product_categories.get_by_id(result.category_id, tenant_id)
        assert saved is not None


class TestGetCategoryHandler:
    async def test_devuelve_categoria_existente(
        self, uow: FakeUnitOfWork, tenant_id: TenantId
    ) -> None:
        created = await CreateCategoryHandler(uow).handle(
            CreateCategoryCommand(tenant_id=tenant_id, name="Solar")
        )
        result = await GetCategoryHandler(uow.product_categories).handle(
            GetCategoryQuery(category_id=created.category_id, tenant_id=tenant_id)
        )
        assert result.name == "Solar"

    async def test_categoria_inexistente_lanza_not_found(
        self, uow: FakeUnitOfWork, tenant_id: TenantId
    ) -> None:
        with pytest.raises(NotFoundError):
            await GetCategoryHandler(uow.product_categories).handle(
                GetCategoryQuery(category_id=uuid4(), tenant_id=tenant_id)
            )


class TestListCategoriesHandler:
    async def test_devuelve_todas_las_categorias(
        self, uow: FakeUnitOfWork, tenant_id: TenantId
    ) -> None:
        create = CreateCategoryHandler(uow)
        await create.handle(CreateCategoryCommand(tenant_id=tenant_id, name="Solar"))
        await create.handle(
            CreateCategoryCommand(tenant_id=tenant_id, name="Seguridad")
        )
        await create.handle(
            CreateCategoryCommand(tenant_id=tenant_id, name="Decorativo")
        )

        results = await ListCategoriesHandler(uow.product_categories).handle(
            ListCategoriesQuery(tenant_id=tenant_id)
        )
        assert len(results) == 3

    async def test_no_devuelve_categorias_de_otro_tenant(
        self, uow: FakeUnitOfWork, tenant_id: TenantId
    ) -> None:
        otro = TenantId(uuid4())
        await CreateCategoryHandler(uow).handle(
            CreateCategoryCommand(tenant_id=otro, name="Ajena")
        )
        results = await ListCategoriesHandler(uow.product_categories).handle(
            ListCategoriesQuery(tenant_id=tenant_id)
        )
        assert results == []


class TestUpdateCategoryHandler:
    async def test_renombra_categoria(
        self, uow: FakeUnitOfWork, tenant_id: TenantId
    ) -> None:
        created = await CreateCategoryHandler(uow).handle(
            CreateCategoryCommand(tenant_id=tenant_id, name="Viejo")
        )
        uow.committed = False

        result = await UpdateCategoryHandler(uow).handle(
            UpdateCategoryCommand(
                category_id=created.category_id, tenant_id=tenant_id, name="Nuevo"
            )
        )
        assert result.name == "Nuevo"
        assert uow.committed is True

    async def test_categoria_inexistente_lanza_not_found(
        self, uow: FakeUnitOfWork, tenant_id: TenantId
    ) -> None:
        with pytest.raises(NotFoundError):
            await UpdateCategoryHandler(uow).handle(
                UpdateCategoryCommand(
                    category_id=uuid4(), tenant_id=tenant_id, name="X"
                )
            )


class TestDeleteCategoryHandler:
    async def test_elimina_categoria(
        self, uow: FakeUnitOfWork, tenant_id: TenantId
    ) -> None:
        created = await CreateCategoryHandler(uow).handle(
            CreateCategoryCommand(tenant_id=tenant_id, name="Borrar")
        )
        uow.committed = False

        await DeleteCategoryHandler(uow).handle(
            DeleteCategoryCommand(category_id=created.category_id, tenant_id=tenant_id)
        )
        assert uow.committed is True
        saved = await uow.product_categories.get_by_id(created.category_id, tenant_id)
        assert saved is None

    async def test_categoria_inexistente_lanza_not_found(
        self, uow: FakeUnitOfWork, tenant_id: TenantId
    ) -> None:
        with pytest.raises(NotFoundError):
            await DeleteCategoryHandler(uow).handle(
                DeleteCategoryCommand(category_id=uuid4(), tenant_id=tenant_id)
            )


# ── GlassType handlers ────────────────────────────────────────────────────────


class TestCreateGlassTypeHandler:
    async def test_crea_tipo_de_vidrio_correctamente(
        self, uow: FakeUnitOfWork, tenant_id: TenantId
    ) -> None:
        result = await CreateGlassTypeHandler(uow).handle(
            CreateGlassTypeCommand(tenant_id=tenant_id, name="Monolítico")
        )
        assert result.name == "Monolítico"
        assert result.is_active is True

    async def test_hace_commit(self, uow: FakeUnitOfWork, tenant_id: TenantId) -> None:
        await CreateGlassTypeHandler(uow).handle(
            CreateGlassTypeCommand(tenant_id=tenant_id, name="DVH")
        )
        assert uow.committed is True

    async def test_persiste_en_repositorio(
        self, uow: FakeUnitOfWork, tenant_id: TenantId
    ) -> None:
        result = await CreateGlassTypeHandler(uow).handle(
            CreateGlassTypeCommand(tenant_id=tenant_id, name="Templado")
        )
        saved = await uow.glass_types.get_by_id(result.glass_type_id, tenant_id)
        assert saved is not None


class TestGetGlassTypeHandler:
    async def test_devuelve_tipo_existente(
        self, uow: FakeUnitOfWork, tenant_id: TenantId
    ) -> None:
        created = await CreateGlassTypeHandler(uow).handle(
            CreateGlassTypeCommand(tenant_id=tenant_id, name="Laminado")
        )
        result = await GetGlassTypeHandler(uow.glass_types).handle(
            GetGlassTypeQuery(glass_type_id=created.glass_type_id, tenant_id=tenant_id)
        )
        assert result.name == "Laminado"

    async def test_tipo_inexistente_lanza_not_found(
        self, uow: FakeUnitOfWork, tenant_id: TenantId
    ) -> None:
        with pytest.raises(NotFoundError):
            await GetGlassTypeHandler(uow.glass_types).handle(
                GetGlassTypeQuery(glass_type_id=uuid4(), tenant_id=tenant_id)
            )


class TestListGlassTypesHandler:
    async def test_devuelve_todos_los_tipos(
        self, uow: FakeUnitOfWork, tenant_id: TenantId
    ) -> None:
        create = CreateGlassTypeHandler(uow)
        await create.handle(
            CreateGlassTypeCommand(tenant_id=tenant_id, name="Monolítico")
        )
        await create.handle(CreateGlassTypeCommand(tenant_id=tenant_id, name="DVH"))

        results = await ListGlassTypesHandler(uow.glass_types).handle(
            ListGlassTypesQuery(tenant_id=tenant_id)
        )
        assert len(results) == 2

    async def test_no_devuelve_tipos_de_otro_tenant(
        self, uow: FakeUnitOfWork, tenant_id: TenantId
    ) -> None:
        otro = TenantId(uuid4())
        await CreateGlassTypeHandler(uow).handle(
            CreateGlassTypeCommand(tenant_id=otro, name="Ajeno")
        )
        results = await ListGlassTypesHandler(uow.glass_types).handle(
            ListGlassTypesQuery(tenant_id=tenant_id)
        )
        assert results == []


class TestUpdateGlassTypeHandler:
    async def test_renombra_tipo(
        self, uow: FakeUnitOfWork, tenant_id: TenantId
    ) -> None:
        created = await CreateGlassTypeHandler(uow).handle(
            CreateGlassTypeCommand(tenant_id=tenant_id, name="Viejo")
        )
        uow.committed = False

        result = await UpdateGlassTypeHandler(uow).handle(
            UpdateGlassTypeCommand(
                glass_type_id=created.glass_type_id, tenant_id=tenant_id, name="Nuevo"
            )
        )
        assert result.name == "Nuevo"
        assert uow.committed is True

    async def test_tipo_inexistente_lanza_not_found(
        self, uow: FakeUnitOfWork, tenant_id: TenantId
    ) -> None:
        with pytest.raises(NotFoundError):
            await UpdateGlassTypeHandler(uow).handle(
                UpdateGlassTypeCommand(
                    glass_type_id=uuid4(), tenant_id=tenant_id, name="X"
                )
            )


class TestDeleteGlassTypeHandler:
    async def test_elimina_tipo(self, uow: FakeUnitOfWork, tenant_id: TenantId) -> None:
        created = await CreateGlassTypeHandler(uow).handle(
            CreateGlassTypeCommand(tenant_id=tenant_id, name="Borrar")
        )
        uow.committed = False

        await DeleteGlassTypeHandler(uow).handle(
            DeleteGlassTypeCommand(
                glass_type_id=created.glass_type_id, tenant_id=tenant_id
            )
        )
        assert uow.committed is True
        saved = await uow.glass_types.get_by_id(created.glass_type_id, tenant_id)
        assert saved is None

    async def test_tipo_inexistente_lanza_not_found(
        self, uow: FakeUnitOfWork, tenant_id: TenantId
    ) -> None:
        with pytest.raises(NotFoundError):
            await DeleteGlassTypeHandler(uow).handle(
                DeleteGlassTypeCommand(glass_type_id=uuid4(), tenant_id=tenant_id)
            )


# ── Product handlers ──────────────────────────────────────────────────────────


def _product_cmd(tenant_id: TenantId, **overrides) -> CreateProductCommand:  # type: ignore[no-untyped-def]
    defaults: dict = dict(
        tenant_id=tenant_id,
        name="FX-5 Carbono",
        brand_id=uuid4(),
        sale_price_per_m2=Decimal("1500.00"),
        uv_percentage=Decimal("99"),
        irr_percentage=Decimal("72"),
        tser_percentage=Decimal("58"),
        warranty_years=5,
        category_id=uuid4(),
        application_types=["WINDOW"],
    )
    defaults.update(overrides)
    return CreateProductCommand(**defaults)


class TestCreateProductHandler:
    async def test_crea_producto_correctamente(
        self, uow: FakeUnitOfWork, tenant_id: TenantId
    ) -> None:
        result = await CreateProductHandler(uow).handle(_product_cmd(tenant_id))
        assert result.name == "FX-5 Carbono"
        assert result.is_active is True
        assert result.application_types == ["WINDOW"]
        assert result.compatible_glass_ids == []

    async def test_crea_con_multiples_tipos_y_vidrios(
        self, uow: FakeUnitOfWork, tenant_id: TenantId
    ) -> None:
        glass_ids = [uuid4(), uuid4()]
        result = await CreateProductHandler(uow).handle(
            _product_cmd(
                tenant_id,
                application_types=["WINDOW", "AUTOMOTIVE"],
                compatible_glass_ids=glass_ids,
            )
        )
        assert set(result.application_types) == {"WINDOW", "AUTOMOTIVE"}
        assert result.compatible_glass_ids == glass_ids

    async def test_hace_commit(self, uow: FakeUnitOfWork, tenant_id: TenantId) -> None:
        await CreateProductHandler(uow).handle(_product_cmd(tenant_id))
        assert uow.committed is True

    async def test_persiste_en_repositorio(
        self, uow: FakeUnitOfWork, tenant_id: TenantId
    ) -> None:
        result = await CreateProductHandler(uow).handle(
            _product_cmd(tenant_id, name="Persistido")
        )
        saved = await uow.products.get_by_id(result.product_id, tenant_id)
        assert saved is not None
        assert saved.name == "Persistido"

    async def test_retorna_product_id(
        self, uow: FakeUnitOfWork, tenant_id: TenantId
    ) -> None:
        result = await CreateProductHandler(uow).handle(_product_cmd(tenant_id))
        assert isinstance(result.product_id, UUID)


class TestGetProductHandler:
    async def test_devuelve_producto_existente(
        self, uow: FakeUnitOfWork, tenant_id: TenantId
    ) -> None:
        created = await CreateProductHandler(uow).handle(
            _product_cmd(tenant_id, name="Mi Lámina")
        )
        result = await GetProductHandler(uow.products).handle(
            GetProductQuery(product_id=created.product_id, tenant_id=tenant_id)
        )
        assert result.name == "Mi Lámina"

    async def test_producto_inexistente_lanza_not_found(
        self, uow: FakeUnitOfWork, tenant_id: TenantId
    ) -> None:
        with pytest.raises(NotFoundError):
            await GetProductHandler(uow.products).handle(
                GetProductQuery(product_id=uuid4(), tenant_id=tenant_id)
            )


class TestListProductsHandler:
    async def test_devuelve_todos_los_productos_del_tenant(
        self, uow: FakeUnitOfWork, tenant_id: TenantId
    ) -> None:
        create = CreateProductHandler(uow)
        await create.handle(_product_cmd(tenant_id, name="P1"))
        await create.handle(_product_cmd(tenant_id, name="P2"))
        await create.handle(_product_cmd(tenant_id, name="P3"))

        results = await ListProductsHandler(uow.products).handle(
            ListProductsQuery(tenant_id=tenant_id)
        )
        assert len(results) == 3
        names = {r.name for r in results}
        assert names == {"P1", "P2", "P3"}

    async def test_no_devuelve_productos_de_otro_tenant(
        self, uow: FakeUnitOfWork, tenant_id: TenantId
    ) -> None:
        otro = TenantId(uuid4())
        await CreateProductHandler(uow).handle(_product_cmd(otro, name="Ajeno"))

        results = await ListProductsHandler(uow.products).handle(
            ListProductsQuery(tenant_id=tenant_id)
        )
        assert results == []

    async def test_devuelve_lista_vacia_si_no_hay_productos(
        self, uow: FakeUnitOfWork, tenant_id: TenantId
    ) -> None:
        results = await ListProductsHandler(uow.products).handle(
            ListProductsQuery(tenant_id=tenant_id)
        )
        assert results == []


class TestUpdateProductHandler:
    async def _create(self, uow: FakeUnitOfWork, tenant_id: TenantId, **kwargs):  # type: ignore[return]
        uow.committed = False
        return await CreateProductHandler(uow).handle(_product_cmd(tenant_id, **kwargs))

    async def test_actualiza_nombre(
        self, uow: FakeUnitOfWork, tenant_id: TenantId
    ) -> None:
        created = await self._create(uow, tenant_id, name="Viejo")
        uow.committed = False

        result = await UpdateProductHandler(uow).handle(
            UpdateProductCommand(
                product_id=created.product_id,
                tenant_id=tenant_id,
                name="Nuevo",
            )
        )
        assert result.name == "Nuevo"
        assert uow.committed is True

    async def test_actualiza_precio(
        self, uow: FakeUnitOfWork, tenant_id: TenantId
    ) -> None:
        created = await self._create(uow, tenant_id)
        result = await UpdateProductHandler(uow).handle(
            UpdateProductCommand(
                product_id=created.product_id,
                tenant_id=tenant_id,
                sale_price_per_m2=Decimal("3000.00"),
            )
        )
        assert result.sale_price_per_m2 == Decimal("3000.00")

    async def test_desactiva_producto_via_update(
        self, uow: FakeUnitOfWork, tenant_id: TenantId
    ) -> None:
        created = await self._create(uow, tenant_id)
        result = await UpdateProductHandler(uow).handle(
            UpdateProductCommand(
                product_id=created.product_id,
                tenant_id=tenant_id,
                is_active=False,
            )
        )
        assert result.is_active is False

    async def test_reactiva_producto_via_update(
        self, uow: FakeUnitOfWork, tenant_id: TenantId
    ) -> None:
        created = await self._create(uow, tenant_id)
        await UpdateProductHandler(uow).handle(
            UpdateProductCommand(
                product_id=created.product_id,
                tenant_id=tenant_id,
                is_active=False,
            )
        )
        result = await UpdateProductHandler(uow).handle(
            UpdateProductCommand(
                product_id=created.product_id,
                tenant_id=tenant_id,
                is_active=True,
            )
        )
        assert result.is_active is True

    async def test_clear_technical_sheet(
        self, uow: FakeUnitOfWork, tenant_id: TenantId
    ) -> None:
        created = await self._create(
            uow, tenant_id, technical_sheet_url="https://cdn.example.com/sheet.pdf"
        )
        result = await UpdateProductHandler(uow).handle(
            UpdateProductCommand(
                product_id=created.product_id,
                tenant_id=tenant_id,
                clear_technical_sheet=True,
            )
        )
        assert result.technical_sheet_url is None

    async def test_producto_inexistente_lanza_not_found(
        self, uow: FakeUnitOfWork, tenant_id: TenantId
    ) -> None:
        with pytest.raises(NotFoundError):
            await UpdateProductHandler(uow).handle(
                UpdateProductCommand(product_id=uuid4(), tenant_id=tenant_id, name="X")
            )


class TestDeleteProductHandler:
    async def test_elimina_producto(
        self, uow: FakeUnitOfWork, tenant_id: TenantId
    ) -> None:
        created = await CreateProductHandler(uow).handle(
            _product_cmd(tenant_id, name="Para borrar")
        )
        uow.committed = False

        await DeleteProductHandler(uow).handle(
            DeleteProductCommand(product_id=created.product_id, tenant_id=tenant_id)
        )
        assert uow.committed is True
        saved = await uow.products.get_by_id(created.product_id, tenant_id)
        assert saved is None

    async def test_producto_inexistente_lanza_not_found(
        self, uow: FakeUnitOfWork, tenant_id: TenantId
    ) -> None:
        with pytest.raises(NotFoundError):
            await DeleteProductHandler(uow).handle(
                DeleteProductCommand(product_id=uuid4(), tenant_id=tenant_id)
            )
