import io
import logging
import os
import warnings
from functools import lru_cache
from typing import Literal
from uuid import uuid4

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.concurrency import run_in_threadpool
from PIL import Image, ImageOps, UnidentifiedImageError
from pwdlib import PasswordHash
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_current_user
from database import get_db
from models import RequestHistory, RequestItem, User, UserRole
from schemas import AvatarResponse, UserCreate, UserProfileUpdate, UserPublic


router = APIRouter(prefix="/users", tags=["users"])
password_hasher = PasswordHash.recommended()
logger = logging.getLogger(__name__)

MAX_AVATAR_SIZE = 2 * 1024 * 1024
MAX_AVATAR_WIDTH_OR_HEIGHT = 4096
MAX_AVATAR_PIXELS = 16_000_000
AVATAR_URL_EXPIRATION_SECONDS = 900

IMAGE_FORMATS = {
    "JPEG": ("jpg", "image/jpeg"),
    "PNG": ("png", "image/png"),
    "WEBP": ("webp", "image/webp")
}


def ensure_manager(current_user: User) -> None:
    if current_user.role not in {UserRole.PO, UserRole.TECH_LEAD}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Somente PO ou Tech Lead podem gerenciar usuários."
        )


def get_avatar_bucket() -> str:
    bucket = os.getenv("S3_AVATAR_BUCKET", "").strip()

    if not bucket:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="O armazenamento de fotos não está configurado."
        )

    return bucket


@lru_cache
def get_s3_client():
    region = os.getenv("AWS_REGION", "us-east-1")
    return boto3.client("s3", region_name=region)


def process_avatar_image(contents: bytes) -> tuple[bytes, str, str]:
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)

            with Image.open(io.BytesIO(contents)) as image:
                image_format = image.format
                width, height = image.size
                image.verify()

            if image_format not in IMAGE_FORMATS:
                raise ValueError(
                    "Use uma imagem JPEG, PNG ou WebP."
                )

            if (
                width > MAX_AVATAR_WIDTH_OR_HEIGHT
                or height > MAX_AVATAR_WIDTH_OR_HEIGHT
                or width * height > MAX_AVATAR_PIXELS
            ):
                raise ValueError(
                    "A imagem é grande demais. Reduza suas dimensões."
                )

            with Image.open(io.BytesIO(contents)) as image:
                image = ImageOps.exif_transpose(image)
                image.load()

                if image_format == "JPEG" and image.mode not in {"RGB", "L"}:
                    image = image.convert("RGB")

                output = io.BytesIO()
                save_options = {"optimize": True}

                if image_format in {"JPEG", "WEBP"}:
                    save_options["quality"] = 90

                image.save(output, format=image_format, **save_options)

    except ValueError:
        raise
    except (
        Image.DecompressionBombError,
        Image.DecompressionBombWarning,
        UnidentifiedImageError,
        OSError
    ) as error:
        raise ValueError("O arquivo enviado não é uma imagem válida.") from error

    extension, content_type = IMAGE_FORMATS[image_format]
    processed_contents = output.getvalue()

    if len(processed_contents) > MAX_AVATAR_SIZE:
        raise ValueError(
            "A imagem deve ter no máximo 2 MB após o processamento."
        )

    return processed_contents, extension, content_type


def upload_avatar_to_s3(bucket: str, key: str, contents: bytes, content_type: str) -> None:
    get_s3_client().upload_fileobj(
        io.BytesIO(contents),
        bucket,
        key,
        ExtraArgs={
            "ContentType": content_type,
            "ServerSideEncryption": "AES256",
            "CacheControl": "private, max-age=0, no-cache"
        },
    )


def delete_avatar_from_s3(bucket: str, key: str) -> None:
    get_s3_client().delete_object(Bucket=bucket, Key=key)


def create_avatar_url(bucket: str, key: str) -> str:
    return get_s3_client().generate_presigned_url(
        "get_object",
        Params={"Bucket": bucket, "Key": key},
        ExpiresIn=AVATAR_URL_EXPIRATION_SECONDS
    )


async def delete_s3_object_if_possible(bucket: str, key: str) -> None:
    try:
        await run_in_threadpool(delete_avatar_from_s3, bucket, key)
    except (BotoCoreError, ClientError):
        logger.exception("Não foi possível remover o objeto S3 %s", key)


@router.post("", response_model=UserPublic, status_code=status.HTTP_201_CREATED)
async def create_user(data: UserCreate, db: AsyncSession = Depends(get_db),
                      current_user: User = Depends(get_current_user)) -> User:
    ensure_manager(current_user)

    result = await db.execute(select(User).where(User.email == data.email))

    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Já existe um usuário com esse email."
        )

    user = User(
        name=data.name,
        email=data.email,
        password_hash=password_hasher.hash(data.password),
        role=UserRole(data.role)
    )

    db.add(user)

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Já existe um usuário com esse email."
        )

    await db.refresh(user)
    return user


@router.patch("/me", response_model=UserPublic)
async def update_my_profile(data: UserProfileUpdate, db: AsyncSession = Depends(get_db),
                            current_user: User = Depends(get_current_user)) -> User:
    updates = data.model_dump(exclude_unset=True, exclude_none=True)

    if "email" in updates and updates["email"] != current_user.email:
        result = await db.execute(
            select(User).where(
                User.email == updates["email"],
                User.id != current_user.id
            )
        )

        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Já existe um usuário com esse email."
            )

    for field, value in updates.items():
        setattr(current_user, field, value)

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Já existe um usuário com esse email."
        )

    await db.refresh(current_user)
    return current_user


@router.get("/me/avatar", response_model=AvatarResponse)
async def get_my_avatar(current_user: User = Depends(get_current_user)) -> AvatarResponse:
    if current_user.avatar_key is None:
        return AvatarResponse(avatar_url=None)

    bucket = get_avatar_bucket()

    try:
        avatar_url = await run_in_threadpool(
            create_avatar_url,
            bucket,
            current_user.avatar_key
        )
    except (BotoCoreError, ClientError):
        logger.exception("Não foi possível gerar o link temporário da foto.")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Não foi possível carregar sua foto de perfil."
        )

    return AvatarResponse(avatar_url=avatar_url)


@router.post("/me/avatar", response_model=AvatarResponse)
async def upload_my_avatar(file: UploadFile = File(...), db: AsyncSession = Depends(get_db),
                           current_user: User = Depends(get_current_user)) -> AvatarResponse:
    contents = await file.read(MAX_AVATAR_SIZE + 1)
    await file.close()

    if not contents:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Selecione uma imagem para enviar."
        )

    if len(contents) > MAX_AVATAR_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="A imagem deve ter no máximo 2 MB."
        )

    try:
        processed_contents, extension, content_type = process_avatar_image(
            contents
        )
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error)
        )

    bucket = get_avatar_bucket()
    new_key = f"avatars/{current_user.id}/{uuid4().hex}.{extension}"
    old_key = current_user.avatar_key

    try:
        await run_in_threadpool(
            upload_avatar_to_s3,
            bucket,
            new_key,
            processed_contents,
            content_type
        )
        avatar_url = await run_in_threadpool(
            create_avatar_url,
            bucket,
            new_key
        )
    except (BotoCoreError, ClientError):
        logger.exception("Não foi possível enviar a foto para o S3.")
        await delete_s3_object_if_possible(bucket, new_key)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Não foi possível salvar sua foto de perfil."
        )

    current_user.avatar_key = new_key

    try:
        await db.commit()
    except Exception:
        await db.rollback()
        await delete_s3_object_if_possible(bucket, new_key)
        logger.exception("Não foi possível salvar a chave da foto no banco.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="A foto foi enviada, mas não foi possível atualizar seu perfil."
        )

    if old_key:
        await delete_s3_object_if_possible(bucket, old_key)

    return AvatarResponse(avatar_url=avatar_url)


@router.delete("/me/avatar", status_code=status.HTTP_204_NO_CONTENT)
async def delete_my_avatar(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)) -> None:
    old_key = current_user.avatar_key

    if old_key is None:
        return

    current_user.avatar_key = None

    try:
        await db.commit()
    except Exception:
        await db.rollback()
        logger.exception("Não foi possível remover a foto do perfil no banco.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Não foi possível remover sua foto de perfil."
        )

    bucket = os.getenv("S3_AVATAR_BUCKET", "").strip()

    if bucket:
        await delete_s3_object_if_possible(bucket, old_key)


@router.get("", response_model=list[UserPublic])
async def list_users(role: Literal["po", "tech_lead", "developer", "qa"] | None = None,
                     db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)) -> list[User]:
    ensure_manager(current_user)

    query = select(User)

    if role is not None:
        query = query.where(User.role == UserRole(role))

    result = await db.execute(query.order_by(User.name, User.id))
    return list(result.scalars().all())


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(user_id: int, db: AsyncSession = Depends(get_db),
                      current_user: User = Depends(get_current_user)) -> None:
    ensure_manager(current_user)

    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Você não pode excluir sua própria conta."
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user_to_delete = result.scalar_one_or_none()

    if user_to_delete is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuário não encontrado."
        )

    if user_to_delete.role == UserRole.PO:
        po_count_result = await db.execute(
            select(func.count())
            .select_from(User)
            .where(
                User.role == UserRole.PO,
                User.id != user_to_delete.id
            )
        )

        if po_count_result.scalar_one() == 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Não é possível excluir o último usuário com perfil PO.",
            )

    request_reference = await db.execute(
        select(RequestItem.id)
        .where(
            or_(
                RequestItem.created_by_id == user_id,
                RequestItem.developer_id == user_id,
                RequestItem.qa_id == user_id,
            )
        )
        .limit(1)
    )

    history_reference = await db.execute(
        select(RequestHistory.id)
        .where(RequestHistory.actor_id == user_id)
        .limit(1)
    )

    if request_reference.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Este usuário está vinculado a uma ou mais solicitações. "
                "Reatribua ou remova essas solicitações antes de excluí-lo."
            ),
        )

    if history_reference.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Este usuário aparece no histórico de solicitações e não pode "
                "ser excluído sem comprometer o registro de auditoria."
            ),
        )

    avatar_key = user_to_delete.avatar_key

    await db.delete(user_to_delete)

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Não foi possível excluir este usuário porque existem "
                "registros vinculados a ele."
            ),
        )

    bucket = os.getenv("S3_AVATAR_BUCKET", "").strip()

    if bucket and avatar_key:
        await delete_s3_object_if_possible(bucket, avatar_key)