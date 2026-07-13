from dataclasses import dataclass
from decimal import Decimal
from uuid import UUID

from centy.application.ports.repositories import (
    IBrandRepository,
    IPriceListItemRepository,
    IProductRepository,
    IUserRepository,
)
from centy.application.ports.unit_of_work import IUnitOfWork
from centy.application.pricing.commands import (
    DeletePriceOverrideCommand,
    SetPriceOverrideCommand,
)
from centy.application.pricing.queries import GetEffectivePriceListQuery
from centy.domain.pricing.entities import PriceListItem
from centy.domain.shared.exceptions import AuthorizationError, NotFoundError


@dataclass(frozen=True)
class EffectivePriceItemResult:
    product_id: UUID
    product_name: str
    brand_name: str
    catalog_purchase_price: Decimal
    catalog_sale_price: Decimal
    effective_purchase_price: Decimal
    effective_sale_price: Decimal
    has_purchase_override: bool
    has_sale_override: bool


@dataclass(frozen=True)
class PriceListItemResult:
    user_id: UUID
    product_id: UUID
    purchase_price: Decimal | None
    sale_price: Decimal | None


def _assert_self_or_admin(
    target_user_id: UUID, requester_user_id: UUID, requester_role: str
) -> None:
    if requester_role != "ADMIN" and requester_user_id != target_user_id:
        raise AuthorizationError(
            "No tenés permiso para acceder a esta lista de precios"
        )


def _item_result(item: PriceListItem) -> PriceListItemResult:
    return PriceListItemResult(
        user_id=item.user_id,
        product_id=item.product_id,
        purchase_price=item.purchase_price.amount if item.purchase_price else None,
        sale_price=item.sale_price.amount if item.sale_price else None,
    )


class GetEffectivePriceListHandler:
    def __init__(
        self,
        products_repo: IProductRepository,
        brands_repo: IBrandRepository,
        price_list_repo: IPriceListItemRepository,
        users_repo: IUserRepository,
    ) -> None:
        self._products = products_repo
        self._brands = brands_repo
        self._price_list = price_list_repo
        self._users = users_repo

    async def handle(
        self, query: GetEffectivePriceListQuery
    ) -> list[EffectivePriceItemResult]:
        target_user = await self._users.get_by_id(query.user_id, query.tenant_id)
        if target_user is None:
            raise NotFoundError(f"Usuario {query.user_id} no encontrado")
        _assert_self_or_admin(
            query.user_id, query.requester_user_id, query.requester_role
        )

        products = await self._products.list_by_tenant(query.tenant_id)
        brands = {
            b.id: b.name for b in await self._brands.list_by_tenant(query.tenant_id)
        }
        overrides = {
            item.product_id: item
            for item in await self._price_list.list_by_user(
                query.user_id, query.tenant_id
            )
        }

        results: list[EffectivePriceItemResult] = []
        for product in products:
            if not product.is_active:
                continue
            override = overrides.get(product.id)
            results.append(
                EffectivePriceItemResult(
                    product_id=product.id,
                    product_name=product.name,
                    brand_name=brands.get(product.brand_id, ""),
                    catalog_purchase_price=product.purchase_price_per_m2.amount,
                    catalog_sale_price=product.sale_price_per_m2.amount,
                    effective_purchase_price=(
                        override.purchase_price.amount
                        if override and override.purchase_price is not None
                        else product.purchase_price_per_m2.amount
                    ),
                    effective_sale_price=(
                        override.sale_price.amount
                        if override and override.sale_price is not None
                        else product.sale_price_per_m2.amount
                    ),
                    has_purchase_override=bool(
                        override and override.purchase_price is not None
                    ),
                    has_sale_override=bool(
                        override and override.sale_price is not None
                    ),
                )
            )
        return results


class SetPriceOverrideHandler:
    def __init__(self, uow: IUnitOfWork) -> None:
        self._uow = uow

    async def handle(self, command: SetPriceOverrideCommand) -> PriceListItemResult:
        if command.requester_role != "ADMIN":
            raise AuthorizationError("Solo el admin puede asignar precios por operador")
        async with self._uow as uow:
            target_user = await uow.users.get_by_id(command.user_id, command.tenant_id)
            if target_user is None:
                raise NotFoundError(f"Usuario {command.user_id} no encontrado")
            product = await uow.products.get_by_id(
                command.product_id, command.tenant_id
            )
            if product is None:
                raise NotFoundError(f"Producto {command.product_id} no encontrado")

            item = await uow.price_list_items.get_by_user_and_product(
                command.user_id, command.product_id, command.tenant_id
            )
            if item is None:
                item = PriceListItem.create(
                    tenant_id=command.tenant_id,
                    user_id=command.user_id,
                    product_id=command.product_id,
                    purchase_price=command.purchase_price,
                    sale_price=command.sale_price,
                )
            else:
                item.update(
                    purchase_price=command.purchase_price,
                    sale_price=command.sale_price,
                    clear_purchase_price=command.clear_purchase_price,
                    clear_sale_price=command.clear_sale_price,
                )
            await uow.price_list_items.save(item)
            await uow.commit()
        return _item_result(item)


class DeletePriceOverrideHandler:
    def __init__(self, uow: IUnitOfWork) -> None:
        self._uow = uow

    async def handle(self, command: DeletePriceOverrideCommand) -> None:
        if command.requester_role != "ADMIN":
            raise AuthorizationError("Solo el admin puede borrar precios por operador")
        async with self._uow as uow:
            target_user = await uow.users.get_by_id(command.user_id, command.tenant_id)
            if target_user is None:
                raise NotFoundError(f"Usuario {command.user_id} no encontrado")
            await uow.price_list_items.delete(
                command.user_id, command.product_id, command.tenant_id
            )
            await uow.commit()
