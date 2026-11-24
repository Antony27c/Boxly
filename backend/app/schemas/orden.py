from datetime import datetime
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.pago import PagoResponse

ESTADOS_ORDEN = {
    "pendiente": ("Pendiente", "La orden está abierta pero el vehículo todavía no entró al taller."),
    "ingresado": ("Ingresado", "El vehículo ya está en el taller y espera que lo revise un mecánico."),
    "en_diagnostico": (
        "En diagnóstico",
        "El mecánico está revisando el vehículo para encontrar la falla y armar el presupuesto.",
    ),
    "esperando_repuestos": (
        "Esperando repuestos", "El trabajo está frenado hasta que lleguen los repuestos pedidos."
    ),
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


class PagoLocalRequest(BaseModel):
    """Pago presencial de una orden con cobro emitido (docs/Oferta.md, W2)."""

    medio: Literal["efectivo", "tarjeta", "transferencia", "otro"]
    monto: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    referencia: Optional[str] = Field(default=None, max_length=100)


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
    lineas_a_cotizar: int = 0
    # Medio y fecha del pago aprobado (online o en el local); null si no está pagada.
    pago_medio: Optional[str] = None
    pago_fecha: Optional[datetime] = None
    # Los pagos de la orden (con montos) solo se exponen cuando el service marcó
    # `_pagos_visibles` (administración y recepción): el mecánico y otras
    # serializaciones (p. ej. el historial del vehículo) reciben la lista vacía.
    pagos: list[PagoResponse] = Field(default=[], validation_alias="_pagos_response")
    tiene_pago_duplicado: bool = False

    @model_validator(mode="before")
    @classmethod
    def _contar_a_cotizar(cls, data):
        """Cuenta las líneas sin precio; `detalles` viene eager-loaded."""
        detalles = getattr(data, "detalles", None)
        if detalles is not None:
            data.lineas_a_cotizar = sum(
                1 for d in detalles if getattr(d, "precio_unitario", 0) is None
            )
        return data

    @model_validator(mode="before")
    @classmethod
    def _datos_del_pago(cls, data):
        """Medio y fecha del pago aprobado; `pagos` viene eager-loaded.

        Los pagos solo se exponen si el service marcó `_pagos_visibles`
        (administración y recepción): para el mecánico —y para serializados
        que no la marcan, como el historial del vehículo— la lista va vacía.
        Se pasa por `_pagos_response` para no tocar la colección del ORM.
        """
        pagos = getattr(data, "pagos", None)
        if pagos is None:
            return data
        aprobado = next((p for p in pagos if p.estado == "aprobado"), None)
        data.pago_medio = aprobado.medio if aprobado else None
        data.pago_fecha = aprobado.fecha_pago if aprobado else None
        if getattr(data, "_pagos_visibles", False):
            data._pagos_response = list(pagos)
            data.tiene_pago_duplicado = any(p.estado == "duplicado" for p in pagos)
        else:
            data._pagos_response = []
            data.tiene_pago_duplicado = False
        return data

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


class NotificacionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    orden_id: int
    tipo: str
    estado_orden: str
    destinatario: str
    asunto: str
    resultado: str
    error: Optional[str] = None
    manual: bool = False
    enviado_por_nombre: Optional[str] = None
    creado_en: datetime
