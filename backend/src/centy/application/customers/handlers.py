from dataclasses import dataclass
from uuid import UUID

from centy.application.customers.commands import (
    CreateCustomerCommand,
    CreateCustomerLabelCommand,
    DeactivateCustomerCommand,
    DeleteCustomerLabelCommand,
    UpdateCustomerCommand,
    UpdateCustomerLabelCommand,
)
from centy.application.customers.queries import (
    GetCustomerQuery,
    ListCustomerLabelsQuery,
    ListCustomersQuery,
)
from centy.application.ports.repositories import (
    ICustomerLabelRepository,
    ICustomerRepository,
)
from centy.application.ports.unit_of_work import IUnitOfWork
from centy.domain.customers.entities import Customer, CustomerLabel
from centy.domain.shared.exceptions import AuthorizationError, NotFoundError


@dataclass(frozen=True)
class CustomerLabelResult:
    label_id: UUID
    name: str
    color: str
    is_active: bool


@dataclass(frozen=True)
class CustomerResult:
    customer_id: UUID
    tenant_id: str
    owner_user_id: UUID
    name: str
    email: str | None
    phone: str | None
    address: str | None
    city: str | None
    province: str | None
    neighborhood: str | None
    postal_code: str | None
    label_id: UUID | None
    notes: str | None
    is_active: bool
    created_at: str


def _label_result(label: CustomerLabel) -> CustomerLabelResult:
    return CustomerLabelResult(
        label_id=label.id,
        name=label.name,
        color=label.color,
        is_active=label.is_active,
    )


def _customer_result(c: Customer) -> CustomerResult:
    return CustomerResult(
        customer_id=c.id,
        tenant_id=str(c.tenant_id),
        owner_user_id=c.owner_user_id,
        name=c.name,
        email=c.email.value if c.email else None,
        phone=c.phone,
        address=c.address,
        city=c.city,
        province=c.province,
        neighborhood=c.neighborhood,
        postal_code=c.postal_code,
        label_id=c.label_id,
        notes=c.notes,
        is_active=c.is_active,
        created_at=c.created_at.isoformat(),
    )


def _assert_can_access_customer(
    customer: Customer, requester_user_id: UUID, requester_role: str
) -> None:
    if customer.owner_user_id != requester_user_id:
        raise AuthorizationError("No tenés permiso para acceder a este cliente")


# ── Customer handlers ─────────────────────────────────────────────────────────


class CreateCustomerHandler:
    def __init__(self, uow: IUnitOfWork) -> None:
        self._uow = uow

    async def handle(self, command: CreateCustomerCommand) -> CustomerResult:
        async with self._uow as uow:
            customer = Customer.create(
                tenant_id=command.tenant_id,
                owner_user_id=command.owner_user_id,
                name=command.name,
                email=command.email,
                phone=command.phone,
                address=command.address,
                city=command.city,
                province=command.province,
                neighborhood=command.neighborhood,
                postal_code=command.postal_code,
                label_id=command.label_id,
                notes=command.notes,
            )
            await uow.customers.save(customer)
            await uow.commit()
        return _customer_result(customer)


class GetCustomerHandler:
    def __init__(self, repo: ICustomerRepository) -> None:
        self._repo = repo

    async def handle(self, query: GetCustomerQuery) -> CustomerResult:
        customer = await self._repo.get_by_id(query.customer_id, query.tenant_id)
        if customer is None:
            raise NotFoundError(f"Cliente {query.customer_id} no encontrado")
        _assert_can_access_customer(
            customer, query.requester_user_id, query.requester_role
        )
        return _customer_result(customer)


class ListCustomersHandler:
    def __init__(self, repo: ICustomerRepository) -> None:
        self._repo = repo

    async def handle(self, query: ListCustomersQuery) -> list[CustomerResult]:
        customers = await self._repo.list_by_owner(
            query.requester_user_id, query.tenant_id
        )
        return [_customer_result(c) for c in customers]


class UpdateCustomerHandler:
    def __init__(self, uow: IUnitOfWork) -> None:
        self._uow = uow

    async def handle(self, command: UpdateCustomerCommand) -> CustomerResult:
        async with self._uow as uow:
            customer = await uow.customers.get_by_id(
                command.customer_id, command.tenant_id
            )
            if customer is None:
                raise NotFoundError(f"Cliente {command.customer_id} no encontrado")
            _assert_can_access_customer(
                customer, command.requester_user_id, command.requester_role
            )
            if command.is_active is not None:
                if command.is_active and not customer.is_active:
                    customer.reactivate()
                elif not command.is_active and customer.is_active:
                    customer.deactivate()
            customer.update(
                name=command.name,
                email=command.email,
                phone=command.phone,
                address=command.address,
                city=command.city,
                province=command.province,
                neighborhood=command.neighborhood,
                postal_code=command.postal_code,
                label_id=command.label_id,
                clear_label=command.clear_label,
                notes=command.notes,
            )
            await uow.customers.save(customer)
            await uow.commit()
        return _customer_result(customer)


class DeactivateCustomerHandler:
    def __init__(self, uow: IUnitOfWork) -> None:
        self._uow = uow

    async def handle(self, command: DeactivateCustomerCommand) -> None:
        async with self._uow as uow:
            customer = await uow.customers.get_by_id(
                command.customer_id, command.tenant_id
            )
            if customer is None:
                raise NotFoundError(f"Cliente {command.customer_id} no encontrado")
            _assert_can_access_customer(
                customer, command.requester_user_id, command.requester_role
            )
            customer.deactivate()
            await uow.customers.save(customer)
            await uow.commit()


# ── CustomerLabel handlers ────────────────────────────────────────────────────


class CreateCustomerLabelHandler:
    def __init__(self, uow: IUnitOfWork) -> None:
        self._uow = uow

    async def handle(self, command: CreateCustomerLabelCommand) -> CustomerLabelResult:
        async with self._uow as uow:
            label = CustomerLabel.create(
                tenant_id=command.tenant_id,
                owner_user_id=command.owner_user_id,
                name=command.name,
                color=command.color,
            )
            await uow.customer_labels.save(label)
            await uow.commit()
        return _label_result(label)


class ListCustomerLabelsHandler:
    def __init__(self, repo: ICustomerLabelRepository) -> None:
        self._repo = repo

    async def handle(self, query: ListCustomerLabelsQuery) -> list[CustomerLabelResult]:
        labels = await self._repo.list_by_owner(query.owner_user_id, query.tenant_id)
        return [_label_result(lb) for lb in labels]


class UpdateCustomerLabelHandler:
    def __init__(self, uow: IUnitOfWork) -> None:
        self._uow = uow

    async def handle(self, command: UpdateCustomerLabelCommand) -> CustomerLabelResult:
        async with self._uow as uow:
            label = await uow.customer_labels.get_by_id(
                command.label_id, command.tenant_id
            )
            if label is None:
                raise NotFoundError(f"Etiqueta {command.label_id} no encontrada")
            if label.owner_user_id != command.owner_user_id:
                raise AuthorizationError(
                    "No tenés permiso para modificar esta etiqueta"
                )
            if command.name is not None:
                label.rename(command.name)
            if command.color is not None:
                label.change_color(command.color)
            await uow.customer_labels.save(label)
            await uow.commit()
        return _label_result(label)


class DeleteCustomerLabelHandler:
    def __init__(self, uow: IUnitOfWork) -> None:
        self._uow = uow

    async def handle(self, command: DeleteCustomerLabelCommand) -> None:
        async with self._uow as uow:
            label = await uow.customer_labels.get_by_id(
                command.label_id, command.tenant_id
            )
            if label is None:
                raise NotFoundError(f"Etiqueta {command.label_id} no encontrada")
            if label.owner_user_id != command.owner_user_id:
                raise AuthorizationError("No tenés permiso para eliminar esta etiqueta")
            await uow.customer_labels.delete(command.label_id, command.tenant_id)
            await uow.commit()
