from decimal import Decimal
from enum import Enum


class QuoteStatus(str, Enum):
    DRAFT = "DRAFT"
    SENT = "SENT"
    ACCEPTED = "ACCEPTED"
    INVOICED = "INVOICED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class LocationType(str, Enum):
    SUPERFICIE = "SUPERFICIE"
    ALTURA = "ALTURA"


class FilmMode(str, Enum):
    SINGLE = "SINGLE"
    PER_GLASS = "PER_GLASS"
