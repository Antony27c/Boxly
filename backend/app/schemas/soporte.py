"""Schemas del acceso de soporte (contrato P2 en docs/Plataforma.md)."""
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


class AccesoSoporteCreate(BaseModel):
    """Lo que el administrador del taller otorga al superadmin."""

    horas: Literal[1, 4, 24, 72]
    motivo: Optional[str] = Field(default=None, max_length=300)


class OtorganteSoporte(BaseModel):
    """Quién del taller otorgó el acceso (nombre completo y email)."""

    nombre: str
    email: str


class AccesoSoporteResponse(BaseModel):
    id: int
    taller_id: int
    otorgado_por: Optional[OtorganteSoporte] = None
    motivo: Optional[str] = None
    desde: datetime
    hasta: datetime
    revocado_en: Optional[datetime] = None
    vigente: bool


class AccesoSoporteVigentePlataforma(BaseModel):
    """Vista del superadmin: accesos vigentes de todos los talleres."""

    taller_id: int
    taller_nombre: str
    hasta: datetime
    motivo: Optional[str] = None
