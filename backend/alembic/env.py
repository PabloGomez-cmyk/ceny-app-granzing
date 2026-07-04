"""Alembic env.py — conexión sincrónica con psycopg2.

La app usa asyncpg; Alembic usa psycopg2. Son independientes.
"""

import os
import re
from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine, pool

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Importar Base para soporte de --autogenerate en el futuro.
# Si falla el import (e.g. módulo no instalado), target_metadata queda None.
try:
    # Importar todos los modelos para que autogenerate detecte cambios en todas las tablas
    from centy.infrastructure.persistence.models import CustomerLabelModel, CustomerModel, UserModel  # noqa: F401
    from centy.infrastructure.persistence.models.user import Base
    target_metadata = Base.metadata
except Exception:
    target_metadata = None  # type: ignore[assignment]


def _get_sync_url() -> str:
    """Lee la URL de DATABASE_URL (env) o de alembic.ini, normalizando a psycopg2."""
    url = os.environ.get("DATABASE_URL") or config.get_main_option("sqlalchemy.url", "")
    # asyncpg (async) → psycopg v3 (sync, Python puro, sin libpq)
    return re.sub(r"\+asyncpg", "+psycopg", url)


def run_migrations_offline() -> None:
    context.configure(
        url=_get_sync_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    # "disable" por defecto para el Postgres local de docker-compose (sin TLS).
    # En Railway (u otro proveedor gestionado) setear DATABASE_SSL_MODE=require.
    sslmode = os.environ.get("DATABASE_SSL_MODE", "disable")
    engine = create_engine(
        _get_sync_url(),
        poolclass=pool.NullPool,
        connect_args={"sslmode": sslmode},
    )
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()
    engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
