from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: str = "development"
    log_level: str = "INFO"
    tenant_id_default: str = "glazing-sa"

    database_url: str = "postgresql+asyncpg://centy:centy_dev@localhost:5432/centy_dev"
    redis_url: str = "redis://localhost:6379/0"

    # En producción (Railway) no hay filesystem persistente para .pem: se pasa
    # el contenido de la clave directo por variable de entorno. En dev local,
    # si estas quedan vacías, se cae al archivo en jwt_*_key_path.
    jwt_private_key: str = ""
    jwt_public_key: str = ""
    jwt_private_key_path: Path = Path("./jwt_private.pem")
    jwt_public_key_path: Path = Path("./jwt_public.pem")
    jwt_access_token_expire_minutes: int = 15
    jwt_refresh_token_expire_days: int = 7

    sentry_dsn: str = ""
    allowed_origins: str = "http://localhost:3000"
    backend_base_url: str = "http://localhost:8000"
    frontend_base_url: str = "http://localhost:3000"

    # Gmail OAuth2 — crear en Google Cloud Console > APIs & Services > Credentials
    gmail_oauth_client_id: str = ""
    gmail_oauth_client_secret: str = ""
    # Generar con: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    gmail_token_encryption_key: str = ""

    # Storage: "local" (filesystem, solo dev) o "r2" (Cloudflare R2, producción)
    storage_backend: str = "local"
    r2_account_id: str = ""
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_bucket: str = "centy-media"
    # URL pública desde la que se sirven los archivos (dominio custom o r2.dev)
    r2_public_base_url: str = ""

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    def load_jwt_private_key(self) -> str:
        if self.jwt_private_key:
            return self.jwt_private_key.replace("\\n", "\n")
        return self.jwt_private_key_path.read_text()

    def load_jwt_public_key(self) -> str:
        if self.jwt_public_key:
            return self.jwt_public_key.replace("\\n", "\n")
        return self.jwt_public_key_path.read_text()


_settings: Settings | None = None


def get_settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings
