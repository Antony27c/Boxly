from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

# HH:MM de 00:00 a 23:59 (con el formato fijo, comparar los textos sirve para ordenar)
PATRON_HORA = r"^([01]\d|2[0-3]):[0-5]\d$"


class HorarioMecanicoCreate(BaseModel):
    dia_semana: int = Field(..., ge=0, le=6, description="0=lunes, 6=domingo")
    hora_desde: str = Field(..., pattern=PATRON_HORA, description="HH:MM")
    hora_hasta: str = Field(..., pattern=PATRON_HORA, description="HH:MM")


class HorarioMecanicoUpdate(BaseModel):
    dia_semana: Optional[int] = Field(None, ge=0, le=6)
    hora_desde: Optional[str] = Field(None, pattern=PATRON_HORA)
    hora_hasta: Optional[str] = Field(None, pattern=PATRON_HORA)


class HorarioMecanicoResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    mecanico_id: int
    dia_semana: int
    hora_desde: str
    hora_hasta: str
