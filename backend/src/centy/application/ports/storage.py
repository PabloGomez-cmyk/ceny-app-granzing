from abc import ABC, abstractmethod


class IObjectStorage(ABC):
    """Puerto de salida para almacenamiento de archivos binarios.

    La implementación de MVP usa almacenamiento local. Cuando se migre a
    Cloudflare R2 basta con crear R2ObjectStorage implementando esta misma
    interfaz — el resto del código no cambia.
    """

    @abstractmethod
    async def save(self, *, filename: str, content: bytes, content_type: str) -> str:
        """Persiste el archivo y retorna la URL pública de acceso."""
        ...

    @abstractmethod
    async def delete(self, url: str) -> None:
        """Elimina el archivo asociado a la URL dada. No lanza si no existe."""
        ...
