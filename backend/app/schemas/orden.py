from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime
from decimal import Decimal
class OrdenBase(BaseModel):
    descripcion_ingreso: str

class OrdenCreate(OrdenBase):
    cliente_id:int
    vehiculo_id:int
    creado_por_id:int
    codigo:str

class OrdenUpdate(BaseModel):
    estado: Optional[str]=None
    mecanico_id: Optional[int]=None
    descripcion_ingreso: Optional[str]=None
    comentario_cambio: Optional[str]= None
    usuario_id_accion: Optional[int]=None
    diagnostico: Optional[str]=None

class OrdenResponse(OrdenBase):
    id:int
    estado:str
    codigo:str
    cliente_id:int
    vehiculo_id:int
    creado_por_id:int
    fecha_ingreso: datetime
    mecanico_id:Optional[int]= None

    model_config = ConfigDict(from_attributes=True)