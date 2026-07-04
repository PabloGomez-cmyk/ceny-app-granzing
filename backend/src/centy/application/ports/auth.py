from abc import ABC, abstractmethod

from centy.domain.users.value_objects import HashedPassword


class IPasswordHasher(ABC):
    @abstractmethod
    def hash(self, plain_password: str) -> HashedPassword: ...

    @abstractmethod
    def verify(self, plain_password: str, hashed: HashedPassword) -> bool: ...


class ITokenService(ABC):
    @abstractmethod
    def create_access_token(
        self, subject: str, extra_claims: dict[str, str]
    ) -> str: ...

    @abstractmethod
    def create_refresh_token(self, subject: str) -> str: ...

    @abstractmethod
    def decode_access_token(self, token: str) -> dict[str, str]: ...

    @abstractmethod
    def decode_refresh_token(self, token: str) -> dict[str, str]: ...
