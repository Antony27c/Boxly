from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models.usuario import RolUsuario


class UsuarioBase(BaseModel):
    nombre: str = Field(min_length=2, max_length=80)
    apellido: str = Field(min_length=2, max_length=80)
    email: EmailStr
    rol: RolUsuario = RolUsuario.recepcion


class UsuarioCreate(UsuarioBase):
    password: str = Field(min_length=8, max_length=72)

    @field_validator("password")
    @classmethod
    def password_strength(cls, value: str) -> str:
        if value.isdigit() or value.isalpha():
            raise ValueError("La contraseña debe combinar letras y números")
        return value


class UsuarioUpdate(BaseModel):
    nombre: Optional[str] = Field(default=None, min_length=2, max_length=80)
    apellido: Optional[str] = Field(default=None, min_length=2, max_length=80)
    email: Optional[EmailStr] = None
    rol: Optional[RolUsuario] = None
    activo: Optional[bool] = None
    password: Optional[str] = Field(default=None, min_length=8, max_length=72)

    @field_validator("password")
    @classmethod
    def password_strength(cls, value: str | None) -> str | None:
        if value is None:
            return value
        if value.isdigit() or value.isalpha():
            raise ValueError("La contraseña debe combinar letras y números")
        return value


class UsuarioResponse(UsuarioBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    activo: bool
    creado_en: datetime
    actualizado_en: datetime | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=72)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    usuario: UsuarioResponse


class MessageResponse(BaseModel):
    detail: str
