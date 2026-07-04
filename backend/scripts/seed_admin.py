"""Crea el primer usuario admin del tenant glazing-sa.

Uso:
    uv run python scripts/seed_admin.py
    uv run python scripts/seed_admin.py --email otro@mail.com --password MiPass123
"""

import argparse
import asyncio
import uuid

from centy.application.users.commands import CreateUserCommand
from centy.application.users.handlers import CreateUserHandler
from centy.domain.shared.exceptions import ConflictError
from centy.domain.shared.value_objects import TenantId
from centy.domain.users.entities import Role
from centy.infrastructure.auth.bcrypt_hasher import BcryptPasswordHasher
from centy.infrastructure.config.settings import get_settings
from centy.infrastructure.persistence.database import get_session_factory, init_db
from centy.infrastructure.persistence.unit_of_work import SQLAlchemyUnitOfWork

# UUID fijo y determinista para el tenant glazing-sa en el MVP.
GLAZING_TENANT_ID = TenantId(uuid.uuid5(uuid.NAMESPACE_DNS, "glazing-sa"))


async def create_admin(email: str, password: str, full_name: str) -> None:
    settings = get_settings()
    init_db(settings.database_url)

    uow = SQLAlchemyUnitOfWork(get_session_factory())
    hasher = BcryptPasswordHasher()
    handler = CreateUserHandler(uow=uow, hasher=hasher)

    command = CreateUserCommand(
        tenant_id=GLAZING_TENANT_ID,
        email=email,
        password=password,
        full_name=full_name,
        role=Role.ADMIN,
    )

    try:
        result = await handler.handle(command)
        print(f"✓ Admin creado: {result.email} (id={result.user_id})")
        print(f"  Tenant: {GLAZING_TENANT_ID}")
    except ConflictError:
        print(f"⚠ El email '{email}' ya existe en este tenant. No se creó nada.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed del usuario admin inicial")
    parser.add_argument("--email", default="admin@glazing.com")
    parser.add_argument("--password", default="Admin1234!")
    parser.add_argument("--full-name", default="Administrador Glazing")
    args = parser.parse_args()

    asyncio.run(create_admin(args.email, args.password, args.full_name))


if __name__ == "__main__":
    main()
