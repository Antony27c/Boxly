from pydantic import BaseModel, ConfigDict, Field

from typing import Optional
from datetime import datetime
from decimal import Decimal

ESTADOS_ORDEN =(
    "pendiente",
    "ingresado",
    "en_diagnostico",
    "esperando_repuesto",
    "listo",
    "entregado",
    "cancelado",
)

class OrdenBase(BaseModel):
    descripcion_ingreso: str = Field(min_length=5)
 
class OrdenCreate(OrdenBase):
    vehiculo_id:int
    mecanico_id: Optional[int]= None
    costo_estimado: Optional[Decimal] = Field(default=None, ge=0)
    fecha_estimada_entrega: Optional[datetime]= None

class OrdenUpdate(BaseModel):
    estado: Optional[str]=None
    mecanico_id: Optional[int]=None
    descripcion_ingreso: Optional[str]=None
    comentario_cambio: Optional[str]= None
    costo_estimado: Optional[Decimal]= Field(default= None, ge=0)
    costo_final: Optional[Decimal]= Field(default= None, ge=0)
    fecha_estimada_entrega: Optional[datetime]= None
    fecha_entrega: Optional[datetime]= None
    diagnostico: Optional[str]=None

class OrdenResponse(OrdenBase):
    model_config=ConfigDict(from_attributes=True)

    id:int
    estado:str
    codigo:str
    cliente_id:int
    vehiculo_id:int
    creado_por_id:int
    mecanico_id:Optional[int]= None
    diagnostico: Optional[str] = None
    costo_estimado: Optional[Decimal] = None
    costo_final: Optional[Decimal]= None
    fecha_ingreso: datetime
    fecha_estimada_entrega: Optional[datetime]= None
    fecha_entrega: Optional[datetime]= None

