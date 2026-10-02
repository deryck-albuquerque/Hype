from fastapi import APIRouter, Depends, HTTPException, status
from pwdlib import PasswordHash
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_current_user
from database import get_db
from models import User, UserRole
from schemas import UserCreate, UserPublic

from typing import Literal


router = APIRouter(prefix="/users", tags=["users"])
password_hasher = PasswordHash.recommended()


@router.post("", response_model=UserPublic, status_code=status.HTTP_201_CREATED)
async def create_user(data: UserCreate, db: AsyncSession = Depends(get_db),
                      current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in {UserRole.PO, UserRole.TECH_LEAD}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Somente PO ou Tech Lead podem criar usuários."
        )

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
    await db.commit()
    await db.refresh(user)

    return user

@router.get("", response_model=list[UserPublic])
async def list_assignable_users(role: Literal["developer", "qa"], db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)) -> list[User]:
    if current_user.role not in {UserRole.PO, UserRole.TECH_LEAD}:
        raise HTTPException(
            status_code=403,
            detail="Somente PO ou Tech Lead podem consultar os usuários atribuíveis."
        )

    result = await db.execute(
        select(User)
        .where(User.role == UserRole(role))
        .order_by(User.name)
    )

    return list(result.scalars().all())