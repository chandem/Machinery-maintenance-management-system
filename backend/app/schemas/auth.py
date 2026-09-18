from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=1, max_length=150)
    password: str = Field(min_length=8, max_length=128)
    role: str = Field(default="technician", pattern="^(admin|manager|technician|viewer)$")


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: EmailStr
    full_name: str
    role: str
    is_active: bool
    created_at: datetime


class UserUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    full_name: Optional[str] = Field(default=None, min_length=1, max_length=150)
    role: Optional[str] = Field(default=None, pattern="^(admin|manager|technician|viewer)$")
    is_active: Optional[bool] = None


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    sub: str
    role: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
