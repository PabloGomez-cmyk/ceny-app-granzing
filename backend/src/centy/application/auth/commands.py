from dataclasses import dataclass

from centy.domain.shared.value_objects import TenantId


@dataclass(frozen=True)
class LoginCommand:
    email: str
    password: str
    tenant_id: TenantId


@dataclass(frozen=True)
class RefreshTokenCommand:
    refresh_token: str


@dataclass(frozen=True)
class LogoutCommand:
    refresh_token: str
