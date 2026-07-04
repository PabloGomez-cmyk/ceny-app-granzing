from dataclasses import dataclass
from uuid import UUID

from centy.application.ports.auth import IPasswordHasher
from centy.application.ports.repositories import IUserRepository
from centy.application.ports.unit_of_work import IUnitOfWork
from centy.application.users.commands import (
    AssignRoleCommand,
    CreateUserCommand,
    DeactivateUserCommand,
    UpdateUserCommand,
)
from centy.application.users.queries import GetUserByIdQuery, ListUsersQuery
from centy.domain.shared.exceptions import ConflictError, NotFoundError
from centy.domain.shared.value_objects import Email
from centy.domain.users.entities import User


@dataclass(frozen=True)
class UserResult:
    user_id: UUID
    email: str
    full_name: str
    role: str
    is_active: bool
    company_name: str | None = None
    company_logo_url: str | None = None
    company_street: str | None = None
    company_city: str | None = None
    company_province: str | None = None
    company_postal_code: str | None = None
    company_cuit: str | None = None
    company_color_primary: str | None = None
    company_color_secondary: str | None = None
    default_commercial_conditions: str | None = None


class CreateUserHandler:
    def __init__(self, uow: IUnitOfWork, hasher: IPasswordHasher) -> None:
        self._uow = uow
        self._hasher = hasher

    async def handle(self, command: CreateUserCommand) -> UserResult:
        async with self._uow as uow:
            existing = await uow.users.get_by_email(
                Email(command.email), command.tenant_id
            )
            if existing is not None:
                raise ConflictError(
                    f"El email '{command.email}' ya está registrado en este tenant"
                )

            hashed = self._hasher.hash(command.password)
            user = User.create(
                tenant_id=command.tenant_id,
                email=Email(command.email),
                hashed_password=hashed,
                full_name=command.full_name,
                role=command.role,
            )

            await uow.users.save(user)
            await uow.commit()

        return UserResult(
            user_id=user.id,
            email=user.email.value,
            full_name=user.full_name,
            role=user.role.value,
            is_active=user.is_active,
            company_name=user.company_name,
            company_logo_url=user.company_logo_url,
            company_street=user.company_street,
            company_city=user.company_city,
            company_province=user.company_province,
            company_postal_code=user.company_postal_code,
            company_cuit=user.company_cuit,
            company_color_primary=user.company_color_primary,
            company_color_secondary=user.company_color_secondary,
            default_commercial_conditions=user.default_commercial_conditions,
        )


class GetUserHandler:
    def __init__(self, repo: IUserRepository) -> None:
        self._repo = repo

    async def handle(self, query: GetUserByIdQuery) -> UserResult:
        user = await self._repo.get_by_id(query.user_id, query.tenant_id)
        if user is None:
            raise NotFoundError(f"Usuario {query.user_id} no encontrado")
        return UserResult(
            user_id=user.id,
            email=user.email.value,
            full_name=user.full_name,
            role=user.role.value,
            is_active=user.is_active,
            company_name=user.company_name,
            company_logo_url=user.company_logo_url,
            company_street=user.company_street,
            company_city=user.company_city,
            company_province=user.company_province,
            company_postal_code=user.company_postal_code,
            company_cuit=user.company_cuit,
            company_color_primary=user.company_color_primary,
            company_color_secondary=user.company_color_secondary,
            default_commercial_conditions=user.default_commercial_conditions,
        )


class ListUsersHandler:
    def __init__(self, repo: IUserRepository) -> None:
        self._repo = repo

    async def handle(self, query: ListUsersQuery) -> list[UserResult]:
        users = await self._repo.list_by_tenant(query.tenant_id)
        return [
            UserResult(
                user_id=u.id,
                email=u.email.value,
                full_name=u.full_name,
                role=u.role.value,
                is_active=u.is_active,
                company_name=u.company_name,
                company_logo_url=u.company_logo_url,
                company_street=u.company_street,
                company_city=u.company_city,
                company_province=u.company_province,
                company_postal_code=u.company_postal_code,
                company_cuit=u.company_cuit,
                company_color_primary=u.company_color_primary,
                company_color_secondary=u.company_color_secondary,
                default_commercial_conditions=u.default_commercial_conditions,
            )
            for u in users
        ]


class DeactivateUserHandler:
    def __init__(self, uow: IUnitOfWork) -> None:
        self._uow = uow

    async def handle(self, command: DeactivateUserCommand) -> None:
        async with self._uow as uow:
            user = await uow.users.get_by_id(command.user_id, command.tenant_id)
            if user is None:
                raise NotFoundError(f"Usuario {command.user_id} no encontrado")
            user.deactivate()
            await uow.users.save(user)
            await uow.commit()


class AssignRoleHandler:
    def __init__(self, uow: IUnitOfWork) -> None:
        self._uow = uow

    async def handle(self, command: AssignRoleCommand) -> None:
        async with self._uow as uow:
            user = await uow.users.get_by_id(command.user_id, command.tenant_id)
            if user is None:
                raise NotFoundError(f"Usuario {command.user_id} no encontrado")
            user.assign_role(command.new_role)
            await uow.users.save(user)
            await uow.commit()


class UpdateUserHandler:
    def __init__(self, uow: IUnitOfWork, hasher: IPasswordHasher) -> None:
        self._uow = uow
        self._hasher = hasher

    async def handle(self, command: UpdateUserCommand) -> UserResult:
        async with self._uow as uow:
            user = await uow.users.get_by_id(command.user_id, command.tenant_id)
            if user is None:
                raise NotFoundError(f"Usuario {command.user_id} no encontrado")

            if command.email is not None:
                new_email = Email(command.email)
                if new_email.value != user.email.value:
                    conflict = await uow.users.get_by_email(
                        new_email, command.tenant_id
                    )
                    if conflict is not None:
                        raise ConflictError(
                            f"El email '{command.email}' ya está en uso"
                        )
                    user.email = new_email

            if command.role is not None:
                user.assign_role(command.role)

            if command.is_active is not None:
                if command.is_active and not user.is_active:
                    user.reactivate()
                elif not command.is_active and user.is_active:
                    user.deactivate()

            if command.password is not None:
                user.change_password(self._hasher.hash(command.password))

            user.update_profile(
                full_name=command.full_name,
                company_name=command.company_name,
                company_logo_url=command.company_logo_url,
                company_street=command.company_street,
                company_city=command.company_city,
                company_province=command.company_province,
                company_postal_code=command.company_postal_code,
                company_cuit=command.company_cuit,
                company_color_primary=command.company_color_primary,
                company_color_secondary=command.company_color_secondary,
                default_commercial_conditions=command.default_commercial_conditions,
            )

            await uow.users.save(user)
            await uow.commit()

        return UserResult(
            user_id=user.id,
            email=user.email.value,
            full_name=user.full_name,
            role=user.role.value,
            is_active=user.is_active,
            company_name=user.company_name,
            company_logo_url=user.company_logo_url,
            company_street=user.company_street,
            company_city=user.company_city,
            company_province=user.company_province,
            company_postal_code=user.company_postal_code,
            company_cuit=user.company_cuit,
            company_color_primary=user.company_color_primary,
            company_color_secondary=user.company_color_secondary,
            default_commercial_conditions=user.default_commercial_conditions,
        )
