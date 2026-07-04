FROM python:3.12-slim

RUN pip install uv

WORKDIR /app

COPY pyproject.toml uv.lock ./
RUN uv sync --no-dev --frozen

COPY src/ ./src/
COPY alembic/ ./alembic/
COPY alembic.ini ./

ENV PYTHONPATH=/app/src
ENV PATH="/app/.venv/bin:$PATH"

RUN useradd --create-home --shell /bin/bash appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# $PORT lo inyecta Railway en runtime (no es fijo como en dev).
# Las migraciones corren vía preDeployCommand (railway.toml), no acá: así se
# ejecutan una sola vez por deploy en vez de una vez por réplica/restart.
CMD exec uvicorn centy.infrastructure.api.main:app --host 0.0.0.0 --port ${PORT:-8000}
