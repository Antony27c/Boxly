from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class TurnoBase(BaseModel):
    cliente_id: int
    vehiculo_id: int
    registrado_por_id: int
    fecha_hora: datetime
    estado: str = "pendiente"
    motivo: Optional[str] = None
    notas: Optional[str] = None


class TurnoCreate(TurnoBase):
    pass


class TurnoUpdate(BaseModel):
    cliente_id: Optional[int] = None
    vehiculo_id: Optional[int] = None
    registrado_por_id: Optional[int] = None
    fecha_hora: Optional[datetime] = None
    estado: Optional[str] = None
    motivo: Optional[str] = None
    notas: Optional[str] = None


class TurnoOut(TurnoBase):
    id: int

    class Config:
        from_attributes = True