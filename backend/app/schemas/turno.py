from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


# DER §3.7: pendiente | confirmado | cancelado | asistio
EstadoTurno = Literal["pendiente", "confirmado", "cancelado", "asistio"]
ESTADOS_TURNO = ("pendiente", "confirmado", "cancelado", "asistio")


def _vacio_a_none(value):
    if isinstance(value, str):
        value = value.strip()
        return value or None
    return value


class TurnoBase(BaseModel):
    """DER §3.7 — Turno agendado por un cliente."""

    cliente_id: int = Field(gt=0)
    vehiculo_id: Optional[int] = Field(default=None, gt=0)
    fecha_hora: datetime
    motivo: Optional[str] = Field(default=None, max_length=200)
    notas: Optional[str] = None

    @field_validator("motivo", "notas", mode="before")
    @classmethod
    def normalizar_opcionales(cls, value):
        return _vacio_a_none(value)


class TurnoCreate(TurnoBase):
    pass


class TurnoUpdate(BaseModel):
    cliente_id: Optional[int] = Field(default=None, gt=0)
    vehiculo_id: Optional[int] = Field(default=None, gt=0)
    fecha_hora: Optional[datetime] = None
    estado: Optional[EstadoTurno] = None
    motivo: Optional[str] = Field(default=None, max_length=200)
    notas: Optional[str] = None

    @field_validator("motivo", "notas", mode="before")
    @classmethod
    def normalizar_opcionales(cls, value):
        return _vacio_a_none(value)


class TurnoEstadoUpdate(BaseModel):
    estado: EstadoTurno


class TurnoResponse(TurnoBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    estado: str
    registrado_por_id: int
