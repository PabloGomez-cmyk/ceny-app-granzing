from enum import StrEnum


class QuoteStatus(StrEnum):
    DRAFT = "DRAFT"
    SENT = "SENT"
    ACCEPTED = "ACCEPTED"
    INVOICED = "INVOICED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class LocationType(StrEnum):
    SUPERFICIE = "SUPERFICIE"
    ALTURA = "ALTURA"


class FilmMode(StrEnum):
    SINGLE = "SINGLE"
    PER_GLASS = "PER_GLASS"


class SaleType(StrEnum):
    ARCHITECTURE = "ARCHITECTURE"
    AUTOMOTIVE = "AUTOMOTIVE"
