import asyncio
import uuid
from pathlib import Path
from typing import Any

import boto3

from centy.application.ports.storage import IObjectStorage


class R2ObjectStorage(IObjectStorage):
    """Implementación de IObjectStorage sobre Cloudflare R2 (API compatible con S3).

    Usar en producción: el filesystem de Railway es efímero y no sobrevive
    a un redeploy, por lo que LocalObjectStorage pierde los archivos subidos.
    """

    def __init__(
        self,
        *,
        account_id: str,
        access_key_id: str,
        secret_access_key: str,
        bucket: str,
        public_base_url: str,
    ) -> None:
        self._bucket = bucket
        self._public_base_url = public_base_url.rstrip("/")
        self._client: Any = boto3.client(
            "s3",
            endpoint_url=f"https://{account_id}.r2.cloudflarestorage.com",
            aws_access_key_id=access_key_id,
            aws_secret_access_key=secret_access_key,
            region_name="auto",
        )

    async def save(self, *, filename: str, content: bytes, content_type: str) -> str:
        ext = Path(filename).suffix.lower()
        key = f"{uuid.uuid4().hex}{ext}"
        await asyncio.to_thread(
            self._client.put_object,
            Bucket=self._bucket,
            Key=key,
            Body=content,
            ContentType=content_type,
        )
        return f"{self._public_base_url}/{key}"

    async def delete(self, url: str) -> None:
        key = url.rsplit("/", 1)[-1]
        await asyncio.to_thread(
            self._client.delete_object, Bucket=self._bucket, Key=key
        )
