import os

from pathlib import Path
from dotenv import load_dotenv
from collections.abc import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(env_path)

database_url = os.getenv("DATABASE_URL")


class Base(DeclarativeBase):
    pass


engine = create_async_engine(database_url, pool_pre_ping=True)

SessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session