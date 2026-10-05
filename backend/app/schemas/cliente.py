from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


def _vacio_a_none(value):
    if isinstance(value, str):
        value = value.strip()
        return value or None
    return value


class ClienteBase(BaseModel):
    nombre: str = Field(min_length=2, max_length=80)
    apellido: str = Field(min_length=1, max_length=80)
    dni: str = Field(pattern=r"^\d{7,11}$")
    telefono: Optional[str] = Field(default=None, max_length=30)
    email: Optional[EmailStr] = None
    direccion: Optional[str] = Field(default=None, max_length=200)

    @field_validator("nombre", "apellido", "dni", mode="before")
    @classmethod
    def recortar(cls, value):
        return value.strip() if isinstance(value, str) else value

    @field_validator("telefono", "email", "direccion", mode="before")
    @classmethod
    def opcionales(cls, value):
        return _vacio_a_none(value)


class ClienteCreate(ClienteBase):
    pass


class ClienteUpdate(ClienteBase):
    pass


class ClienteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str
    apellido: str
    dni: str
    telefono: Optional[str] = None
    email: Optional[str] = None
    direccion: Optional[str] = None
    creado_en: datetime
