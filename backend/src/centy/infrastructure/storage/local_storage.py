import uuid
from pathlib import Path

from centy.application.ports.storage import IObjectStorage


class LocalObjectStorage(IObjectStorage):
    """Implementación de IObjectStorage sobre el sistema de archivos local.

    Para MVP y desarrollo. En producción, reemplazar con R2ObjectStorage
    sin tocar ninguna otra capa — ambas implementan IObjectStorage.
    """

    def __init__(self, media_dir: Path, base_url: str) -> None:
        self._media_dir = media_dir
        self._base_url = base_url.rstrip("/")
        media_dir.mkdir(parents=True, exist_ok=True)

    async def save(self, *, filename: str, content: bytes, content_type: str) -> str:
        ext = Path(filename).suffix.lower()
        unique_name = f"{uuid.uuid4().hex}{ext}"
        (self._media_dir / unique_name).write_bytes(content)
        return f"{self._base_url}/{unique_name}"

    async def delete(self, url: str) -> None:
        filename = url.rsplit("/", 1)[-1]
        path = self._media_dir / filename
        if path.exists():
            path.unlink()
