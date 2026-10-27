from pydantic import BaseModel, ConfigDict, Field
 
 
class HorarioMecanicoCreate(BaseModel):
    dia_semana: int = Field(..., ge=0, le=6, description="0=lunes, 6=domingo")
    hora_desde: str = Field(..., pattern=r"^\d{2}:\d{2}$", description="HH:MM")
    hora_hasta: str = Field(..., pattern=r"^\d{2}:\d{2}$", description="HH:MM")
 
 
class HorarioMecanicoUpdate(BaseModel):
    dia_semana: int = Field(None, ge=0, le=6)
    hora_desde: str = Field(None, pattern=r"^\d{2}:\d{2}$")
    hora_hasta: str = Field(None, pattern=r"^\d{2}:\d{2}$")
 
 
class HorarioMecanicoResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
 
    id: int
    mecanico_id: int
    dia_semana: int
    hora_desde: str
    hora_hasta: str