from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


def _vacio_a_none(value):
    if isinstance(value, str):
        value = value.strip()
        return value or None
    return value


class ClienteBase(BaseModel):
    """DER §3.2 — Cliente del taller."""

    nombre: str = Field(min_length=2, max_length=80)
    apellido: str = Field(min_length=2, max_length=80)
    dni: str = Field(min_length=6, max_length=20)
    telefono: Optional[str] = Field(default=None, max_length=30)
    email: Optional[EmailStr] = None
    direccion: Optional[str] = Field(default=None, max_length=200)

    @field_validator("telefono", "email", "direccion", mode="before")
    @classmethod
    def normalizar_opcionales(cls, value):
        return _vacio_a_none(value)


class ClienteCreate(ClienteBase):
    pass


class ClienteUpdate(BaseModel):
    nombre: Optional[str] = Field(default=None, min_length=2, max_length=80)
    apellido: Optional[str] = Field(default=None, min_length=2, max_length=80)
    dni: Optional[str] = Field(default=None, min_length=6, max_length=20)
    telefono: Optional[str] = Field(default=None, max_length=30)
    email: Optional[EmailStr] = None
    direccion: Optional[str] = Field(default=None, max_length=200)

    @field_validator("telefono", "email", "direccion", mode="before")
    @classmethod
    def normalizar_opcionales(cls, value):
        return _vacio_a_none(value)


class ClienteResponse(ClienteBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    creado_en: datetime
