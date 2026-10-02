import asyncio
import os

from pwdlib import PasswordHash
from sqlalchemy import select
from database import SessionLocal, engine
from models import User, UserRole


password_hasher = PasswordHash.recommended()


async def create_initial_po() -> None:
    name = os.getenv("INITIAL_PO_NAME")
    email = os.getenv("INITIAL_PO_EMAIL")
    password = os.getenv("INITIAL_PO_PASSWORD")

    if not name or not email or not password:
        raise RuntimeError(
            "Configure INITIAL_PO_NAME, INITIAL_PO_EMAIL e "
            "INITIAL_PO_PASSWORD no arquivo backend/.env."
        )

    async with SessionLocal() as session:
        result = await session.execute(select(User).where(User.email == email))
        existing_user = result.scalar_one_or_none()

        if existing_user:
            if existing_user.role != UserRole.PO:
                raise RuntimeError(
                    f"Já existe um usuário com o email {email}, "
                    "mas ele não tem o papel de PO."
                )

            print(f"A conta PO {email} já existe.")
            return

        user = User(
            name=name,
            email=email,
            password_hash=password_hasher.hash(password),
            role=UserRole.PO
        )

        session.add(user)
        await session.commit()

    print(f"Conta PO criada com sucesso: {email}")


async def main() -> None:
    try:
        await create_initial_po()
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())