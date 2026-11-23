"""Esquemas de la API pública de la landing y de las solicitudes (docs/Landing.md, L5)."""
from datetime import datetime
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

EstadoSolicitud = Literal["nueva", "contactada", "convertida", "descartada"]


class PlanPublico(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    codigo: str
    nombre: str
    precio_mensual: Decimal
    # NULL = sin límite de personal.
    max_personal: Optional[int] = None


class ContactoCreate(BaseModel):
    """Formulario de demo. ``sitio_web`` es el campo trampa: si viene con algo,
    se responde 201 y no se guarda nada."""

    model_config = ConfigDict(str_strip_whitespace=True)

    nombre: str = Field(min_length=2, max_length=100)
    taller: str = Field(min_length=2, max_length=120)
    email: EmailStr
    telefono: Optional[str] = Field(default=None, min_length=6, max_length=30)
    ciudad: Optional[str] = Field(default=None, max_length=80)
    mensaje: Optional[str] = Field(default=None, max_length=1000)
    sitio_web: Optional[str] = Field(default=None, max_length=500)

    @field_validator("telefono", "ciudad", "mensaje", "sitio_web", mode="before")
    @classmethod
    def vacio_es_none(cls, value):
        # El formulario manda "" en los campos opcionales que quedan vacíos.
        if isinstance(value, str) and not value.strip():
            return None
        return value


class ContactoRespuesta(BaseModel):
    ok: bool = True


class SolicitudResponse(BaseModel):
    """Solicitud vista por el superadmin (sin la IP: solo sirve para el límite)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str
    taller: str
    email: str
    telefono: Optional[str] = None
    ciudad: Optional[str] = None
    mensaje: Optional[str] = None
    estado: EstadoSolicitud
    nota: Optional[str] = None
    creado_en: datetime


class SolicitudUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    estado: EstadoSolicitud
    nota: Optional[str] = Field(default=None, max_length=1000)
