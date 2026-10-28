from pydantic import BaseModel, ConfigDict, Field

from typing import Optional
from datetime import datetime
from decimal import Decimal

ESTADOS_ORDEN = {
    "pendiente": ("Pendiente", "La orden está abierta pero el vehículo todavía no entró al taller."),
    "ingresado": ("Ingresado", "El vehículo ya está en el taller y espera que lo revise un mecánico."),
    "en_diagnostico": ("En diagnóstico", "El mecánico está revisando el vehículo para encontrar la falla y armar el presupuesto."),
    "esperando_repuestos": ("Esperando repuestos", "El trabajo está frenado hasta que lleguen los repuestos pedidos."),
    "listo": ("Listo", "El trabajo terminó y el vehículo está listo para que lo retiren."),
    "entregado": ("Entregado", "El cliente retiró el vehículo. La orden queda cerrada."),
    "cancelado": ("Cancelado", "La orden se canceló y no se va a hacer el trabajo."),
}


class EstadoOrdenResponse(BaseModel):
    codigo: str
    nombre: str
    descripcion: str
    siguientes: list[str]


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

class CobroRequest(BaseModel):
    monto: Optional[Decimal] = Field(default=None, gt=0)


class OrdenResponse(OrdenBase):
    model_config=ConfigDict(from_attributes=True)

    id:int
    estado:str
    codigo:str
    cliente_id:int
    cliente_nombre: Optional[str] = None
    vehiculo_id:int
    vehiculo_patente: Optional[str] = None
    vehiculo_marca: Optional[str] = None
    vehiculo_modelo: Optional[str] = None
    creado_por_id:int
    mecanico_id:Optional[int]= None
    mecanico_nombre: Optional[str] = None
    diagnostico: Optional[str] = None
    costo_estimado: Optional[Decimal] = None
    costo_final: Optional[Decimal]= None
    pagada: bool = False
    cobro_estado: Optional[str] = None
    monto_propuesto: Optional[Decimal] = None
    cobro_propuesto_por_nombre: Optional[str] = None
    cobro_aprobado_por_nombre: Optional[str] = None
    cobro_aprobado_en: Optional[datetime] = None
    fecha_ingreso: datetime
    fecha_estimada_entrega: Optional[datetime]= None
    fecha_entrega: Optional[datetime]= None

class HistorialResponse(BaseModel):
    model_config= ConfigDict(from_attributes=True)

    id: int
    orden_id:int 
    usuario_id:int
    usuario_nombre: Optional[str]= None
    estado_anterior: Optional[str] = None
    estado_nuevo: str
    comentario: Optional[str] = None
    fecha: datetime
