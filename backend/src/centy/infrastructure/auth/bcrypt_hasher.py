import bcrypt

from centy.application.ports.auth import IPasswordHasher
from centy.domain.users.value_objects import HashedPassword


class BcryptPasswordHasher(IPasswordHasher):
    _ROUNDS = 12

    def hash(self, plain_password: str) -> HashedPassword:
        hashed = bcrypt.hashpw(plain_password.encode(), bcrypt.gensalt(self._ROUNDS))
        return HashedPassword(hashed.decode())

    def verify(self, plain_password: str, hashed: HashedPassword) -> bool:
        return bcrypt.checkpw(plain_password.encode(), hashed.value.encode())
