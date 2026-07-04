class DomainError(Exception):
    """Base para todos los errores del dominio."""


class NotFoundError(DomainError):
    """Entidad no encontrada."""


class ValidationError(DomainError):
    """Validación de dominio fallida."""


class AuthorizationError(DomainError):
    """Operación no autorizada para este actor."""


class ConflictError(DomainError):
    """La operación conflictúa con el estado existente."""


class BusinessRuleViolationError(DomainError):
    """Violación de una regla de negocio."""
