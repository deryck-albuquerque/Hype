from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from models import Priority, RequestStatus, UserRole


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


class UserProfileUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=100)
    email: EmailStr | None = None

    @field_validator("name")
    @classmethod
    def trim_name(cls, value: str | None) -> str | None:
        if value is None:
            return None

        value = value.strip()

        if len(value) < 2:
            raise ValueError("O nome deve ter pelo menos 2 caracteres.")

        return value

    @model_validator(mode="after")
    def require_at_least_one_field(self):
        if self.name is None and self.email is None:
            raise ValueError("Informe um nome ou e-mail para atualizar.")

        return self


class PasswordChangeInput(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


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
    developer_name: str
    qa_name: str
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
    old_display_value: str | None = None
    new_display_value: str | None = None