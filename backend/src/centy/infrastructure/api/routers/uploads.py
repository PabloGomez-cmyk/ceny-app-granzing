from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from pydantic import BaseModel

from centy.application.ports.storage import IObjectStorage
from centy.infrastructure.api.dependencies import (
    CurrentUser,
    get_current_user,
    get_storage,
)

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
ALLOWED_DOC_TYPES = ALLOWED_IMAGE_TYPES | {"application/pdf"}
MAX_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB

router = APIRouter(prefix="/uploads", tags=["uploads"])


class UploadResponse(BaseModel):
    url: str


@router.post(
    "/image", response_model=UploadResponse, status_code=status.HTTP_201_CREATED
)
async def upload_image(
    file: UploadFile,
    current_user: CurrentUser = Depends(get_current_user),
    storage: IObjectStorage = Depends(get_storage),
) -> UploadResponse:
    """Sube una imagen (logo de marca). Solo ADMIN."""
    if current_user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Se requiere rol ADMIN"
        )
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Tipo de archivo no permitido: {file.content_type}. Se aceptan: {sorted(ALLOWED_IMAGE_TYPES)}",
        )
    content = await file.read()
    if len(content) > MAX_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="El archivo supera el límite de 10 MB",
        )
    url = await storage.save(
        filename=file.filename or "upload",
        content=content,
        content_type=file.content_type,
    )
    return UploadResponse(url=url)


@router.post(
    "/document", response_model=UploadResponse, status_code=status.HTTP_201_CREATED
)
async def upload_document(
    file: UploadFile,
    current_user: CurrentUser = Depends(get_current_user),
    storage: IObjectStorage = Depends(get_storage),
) -> UploadResponse:
    """Sube una ficha técnica (imagen o PDF). Solo ADMIN."""
    if current_user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Se requiere rol ADMIN"
        )
    if file.content_type not in ALLOWED_DOC_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Tipo de archivo no permitido: {file.content_type}",
        )
    content = await file.read()
    if len(content) > MAX_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="El archivo supera el límite de 10 MB",
        )
    url = await storage.save(
        filename=file.filename or "document",
        content=content,
        content_type=file.content_type,
    )
    return UploadResponse(url=url)
