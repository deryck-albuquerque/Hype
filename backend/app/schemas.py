from datetime import datetime
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from models import Priority, RequestStatus, UserRole
from typing import Literal

class UserPublic(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: UserRole

    model_config = ConfigDict(from_attributes=True)

class UserCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=5, max_length=128)
    role: Literal["tech_lead", "developer", "qa"]


class LoginInput(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


class RequestCreate(BaseModel):
    title: str = Field(min_length=3, max_length=160)
    description: str = Field(min_length=1)
    priority: Priority = Priority.MEDIUM
    developer_id: int
    qa_id: int


class RequestPublic(BaseModel):
    id: int
    title: str
    description: str
    priority: Priority
    status: RequestStatus
    created_by_id: int
    developer_id: int
    qa_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class RequestStatusUpdate(BaseModel):
    status: RequestStatus
    comment: str | None = Field(default=None, max_length=2000)

class RequestHistoryPublic(BaseModel):
    id: int
    actor_id: int
    actor_name: str
    action: str
    field_name: str | None
    old_value: str | None
    new_value: str | None
    comment: str | None
    created_at: datetime