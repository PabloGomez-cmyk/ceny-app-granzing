import re
from dataclasses import dataclass, field
from decimal import Decimal
from uuid import UUID

from centy.domain.catalog.value_objects import ApplicationType, Percentage
from centy.domain.shared.entity import Entity
from centy.domain.shared.exceptions import BusinessRuleViolationError, ValidationError
from centy.domain.shared.value_objects import Money, TenantId

_COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")


@dataclass(kw_only=True)
class Brand(Entity):
    """Marca del fabricante de láminas.

    Entidad administrada por el ADMIN. Contiene identidad visual
    (color y logo) que se muestra en el catálogo.
    """

    tenant_id: TenantId
    name: str
    color: str = "#0f6e50"
    logo_url: str | None = None
    is_active: bool = True

    @classmethod
    def create(
        cls,
        *,
        tenant_id: TenantId,
        name: str,
        color: str = "#0f6e50",
        logo_url: str | None = None,
    ) -> "Brand":
        name = name.strip()
        if not name:
            raise BusinessRuleViolationError("El nombre de la marca no puede estar vacío")
        if len(name) > 100:
            raise BusinessRuleViolationError("El nombre de la marca no puede superar 100 caracteres")
        if not _COLOR_RE.match(color):
            raise ValidationError(f"Color inválido: '{color}'. Usar formato hex #RRGGBB")
        return cls(tenant_id=tenant_id, name=name, color=color, logo_url=logo_url)

    def update(
        self,
        *,
        name: str | None = None,
        color: str | None = None,
        logo_url: str | None = None,
        clear_logo: bool = False,
    ) -> None:
        if name is not None:
            name = name.strip()
            if not name:
                raise BusinessRuleViolationError("El nombre de la marca no puede estar vacío")
            if len(name) > 100:
                raise BusinessRuleViolationError("El nombre de la marca no puede superar 100 caracteres")
            self.name = name
        if color is not None:
            if not _COLOR_RE.match(color):
                raise ValidationError(f"Color inválido: '{color}'")
            self.color = color
        if clear_logo:
            self.logo_url = None
        elif logo_url is not None:
            self.logo_url = logo_url

    def deactivate(self) -> None:
        if not self.is_active:
            raise BusinessRuleViolationError("La marca ya está inactiva")
        self.is_active = False

    def reactivate(self) -> None:
        if self.is_active:
            raise BusinessRuleViolationError("La marca ya está activa")
        self.is_active = True


@dataclass(kw_only=True)
class ProductCategory(Entity):
    """Categoría de producto configurada dinámicamente por el ADMIN.

    Reemplaza el enum ProductCategory fijo del CLAUDE.md. El admin
    puede crear, renombrar y desactivar categorías sin deploys.
    """

    tenant_id: TenantId
    name: str
    is_active: bool = True

    @classmethod
    def create(cls, *, tenant_id: TenantId, name: str) -> "ProductCategory":
        name = name.strip()
        if not name:
            raise BusinessRuleViolationError("El nombre de la categoría no puede estar vacío")
        if len(name) > 100:
            raise BusinessRuleViolationError("El nombre de la categoría no puede superar 100 caracteres")
        return cls(tenant_id=tenant_id, name=name)

    def rename(self, new_name: str) -> None:
        new_name = new_name.strip()
        if not new_name:
            raise BusinessRuleViolationError("El nombre de la categoría no puede estar vacío")
        if len(new_name) > 100:
            raise BusinessRuleViolationError("El nombre de la categoría no puede superar 100 caracteres")
        self.name = new_name

    def deactivate(self) -> None:
        if not self.is_active:
            raise BusinessRuleViolationError("La categoría ya está inactiva")
        self.is_active = False

    def reactivate(self) -> None:
        if self.is_active:
            raise BusinessRuleViolationError("La categoría ya está activa")
        self.is_active = True


@dataclass(kw_only=True)
class GlassType(Entity):
    """Tipo de vidrio compatible, administrado dinámicamente por el ADMIN."""

    tenant_id: TenantId
    name: str
    is_active: bool = True

    @classmethod
    def create(cls, *, tenant_id: TenantId, name: str) -> "GlassType":
        name = name.strip()
        if not name:
            raise BusinessRuleViolationError("El nombre del tipo de vidrio no puede estar vacío")
        if len(name) > 100:
            raise BusinessRuleViolationError("El nombre del tipo de vidrio no puede superar 100 caracteres")
        return cls(tenant_id=tenant_id, name=name)

    def rename(self, new_name: str) -> None:
        new_name = new_name.strip()
        if not new_name:
            raise BusinessRuleViolationError("El nombre del tipo de vidrio no puede estar vacío")
        if len(new_name) > 100:
            raise BusinessRuleViolationError("El nombre del tipo de vidrio no puede superar 100 caracteres")
        self.name = new_name

    def deactivate(self) -> None:
        if not self.is_active:
            raise BusinessRuleViolationError("El tipo de vidrio ya está inactivo")
        self.is_active = False

    def reactivate(self) -> None:
        if self.is_active:
            raise BusinessRuleViolationError("El tipo de vidrio ya está activo")
        self.is_active = True


@dataclass(kw_only=True)
class Product(Entity):
    """Lámina solar del catálogo.

    Los campos de porcentaje (UV, IRR, TSER) modelan propiedades ópticas
    de la lámina. sale_price_per_m2 es fijo hasta que se implemente el
    módulo de listas de precios por usuario.

    compatible_glass_ids referencia IDs de GlassType — el dominio solo
    conoce las IDs; la join table es responsabilidad de infraestructura.
    """

    tenant_id: TenantId
    name: str
    brand_id: UUID
    sale_price_per_m2: Money
    uv_percentage: Percentage
    irr_percentage: Percentage
    tser_percentage: Percentage
    warranty_years: int
    category_id: UUID
    roll_width_cm: Decimal = Decimal("152")
    roll_length_m: Decimal = Decimal("30")
    application_types: list[ApplicationType] = field(default_factory=list)
    compatible_glass_ids: list[UUID] = field(default_factory=list)
    technical_sheet_url: str | None = None
    is_active: bool = True

    @classmethod
    def create(
        cls,
        *,
        tenant_id: TenantId,
        name: str,
        brand_id: UUID,
        sale_price_per_m2: Decimal,
        uv_percentage: Decimal,
        irr_percentage: Decimal,
        tser_percentage: Decimal,
        warranty_years: int,
        category_id: UUID,
        roll_width_cm: Decimal = Decimal("152"),
        roll_length_m: Decimal = Decimal("30"),
        application_types: list[str],
        compatible_glass_ids: list[UUID] | None = None,
        technical_sheet_url: str | None = None,
    ) -> "Product":
        name = name.strip()
        if not name:
            raise BusinessRuleViolationError("El nombre del producto no puede estar vacío")
        if len(name) > 200:
            raise BusinessRuleViolationError("El nombre del producto no puede superar 200 caracteres")
        if warranty_years < 0:
            raise BusinessRuleViolationError("Los años de garantía no pueden ser negativos")
        if not application_types:
            raise BusinessRuleViolationError(
                "El producto debe aplicarse a al menos una superficie (Ventana o Automóvil)"
            )

        parsed_types: list[ApplicationType] = []
        for t in application_types:
            try:
                parsed_types.append(ApplicationType(t))
            except ValueError:
                raise ValidationError(f"Tipo de aplicación inválido: '{t}'. Valores: WINDOW, AUTOMOTIVE")

        if roll_width_cm <= 0:
            raise BusinessRuleViolationError("El ancho del rollo debe ser mayor a 0")
        if roll_length_m <= 0:
            raise BusinessRuleViolationError("El largo del rollo debe ser mayor a 0")

        return cls(
            tenant_id=tenant_id,
            name=name,
            brand_id=brand_id,
            sale_price_per_m2=Money(sale_price_per_m2),
            uv_percentage=Percentage(uv_percentage),
            irr_percentage=Percentage(irr_percentage),
            tser_percentage=Percentage(tser_percentage),
            warranty_years=warranty_years,
            category_id=category_id,
            roll_width_cm=roll_width_cm,
            roll_length_m=roll_length_m,
            application_types=parsed_types,
            compatible_glass_ids=compatible_glass_ids or [],
            technical_sheet_url=technical_sheet_url,
        )

    def update(
        self,
        *,
        name: str | None = None,
        brand_id: UUID | None = None,
        sale_price_per_m2: Decimal | None = None,
        uv_percentage: Decimal | None = None,
        irr_percentage: Decimal | None = None,
        tser_percentage: Decimal | None = None,
        warranty_years: int | None = None,
        category_id: UUID | None = None,
        roll_width_cm: Decimal | None = None,
        roll_length_m: Decimal | None = None,
        application_types: list[str] | None = None,
        compatible_glass_ids: list[UUID] | None = None,
        technical_sheet_url: str | None = None,
        clear_technical_sheet: bool = False,
    ) -> None:
        if name is not None:
            name = name.strip()
            if not name:
                raise BusinessRuleViolationError("El nombre del producto no puede estar vacío")
            if len(name) > 200:
                raise BusinessRuleViolationError("El nombre del producto no puede superar 200 caracteres")
            self.name = name
        if brand_id is not None:
            self.brand_id = brand_id
        if sale_price_per_m2 is not None:
            self.sale_price_per_m2 = Money(sale_price_per_m2)
        if uv_percentage is not None:
            self.uv_percentage = Percentage(uv_percentage)
        if irr_percentage is not None:
            self.irr_percentage = Percentage(irr_percentage)
        if tser_percentage is not None:
            self.tser_percentage = Percentage(tser_percentage)
        if warranty_years is not None:
            if warranty_years < 0:
                raise BusinessRuleViolationError("Los años de garantía no pueden ser negativos")
            self.warranty_years = warranty_years
        if category_id is not None:
            self.category_id = category_id
        if roll_width_cm is not None:
            if roll_width_cm <= 0:
                raise BusinessRuleViolationError("El ancho del rollo debe ser mayor a 0")
            self.roll_width_cm = roll_width_cm
        if roll_length_m is not None:
            if roll_length_m <= 0:
                raise BusinessRuleViolationError("El largo del rollo debe ser mayor a 0")
            self.roll_length_m = roll_length_m
        if application_types is not None:
            if not application_types:
                raise BusinessRuleViolationError(
                    "El producto debe aplicarse a al menos una superficie"
                )
            self.application_types = [ApplicationType(t) for t in application_types]
        if compatible_glass_ids is not None:
            self.compatible_glass_ids = compatible_glass_ids
        if clear_technical_sheet:
            self.technical_sheet_url = None
        elif technical_sheet_url is not None:
            self.technical_sheet_url = technical_sheet_url

    def deactivate(self) -> None:
        if not self.is_active:
            raise BusinessRuleViolationError("El producto ya está inactivo")
        self.is_active = False

    def reactivate(self) -> None:
        if self.is_active:
            raise BusinessRuleViolationError("El producto ya está activo")
        self.is_active = True
