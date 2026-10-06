from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pwdlib import PasswordHash
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_current_user
from database import get_db
from models import RequestHistory, RequestItem, User, UserRole
from schemas import UserCreate, UserProfileUpdate, UserPublic


router = APIRouter(prefix="/users", tags=["users"])
password_hasher = PasswordHash.recommended()


def ensure_manager(current_user: User) -> None:
    if current_user.role not in {UserRole.PO, UserRole.TECH_LEAD}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Somente PO ou Tech Lead podem gerenciar usuários."
        )


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


@router.get("", response_model=list[UserPublic])
async def list_users(role: Literal["po", "tech_lead", "developer", "qa"] | None = None,
                     db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)) -> list[User]:
    ensure_manager(current_user)

    query = select(User)

    # Sem o parametro role a tela de gestão recebe todos os perfis
    # Com role=developer ou role=qa mantem o uso no formulario de solicitações
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
                detail="Não é possível excluir o último usuário com perfil PO."
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

    await db.delete(user_to_delete)

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Não foi possível excluir este usuário porque existem registros vinculados a ele."
            ),
        )