from datetime import datetime
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict

from app.schemas.detalle_orden import DetalleOrdenResponse
from app.schemas.orden import HistorialResponse
from app.schemas.pago import PagoResponse
from app.schemas.vehiculo import VehiculoResponse


class OrdenActivaResumen(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    codigo: str
    estado: str
    fecha_ingreso: datetime


class MiVehiculoResponse(VehiculoResponse):
    orden_activa: Optional[OrdenActivaResumen] = None
    ordenes_total: int = 0


class MiOrdenResumen(BaseModel):
    id: int
    codigo: str
    estado: str
    vehiculo_id: int
    vehiculo_patente: str
    vehiculo_marca: str
    vehiculo_modelo: str
    fecha_ingreso: datetime
    fecha_estimada_entrega: Optional[datetime] = None
    costo_final: Optional[Decimal] = None
    pagada: bool = False


class VehiculoResumen(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    patente: str
    marca: str
    modelo: str
    anio: Optional[int] = None


class EtapaResponse(BaseModel):
    codigo: str
    nombre: str
    descripcion: str


class PasoResponse(BaseModel):
    codigo: str
    nombre: str
    estado: Literal["completado", "actual", "pendiente", "omitido"]


class ImagenOrdenPortal(BaseModel):
    id: int
    orden_id: int
    etapa: Optional[str] = None
    url: str
    usuario_id: Optional[int] = None
    usuario_nombre: Optional[str] = None
    fecha: datetime


class MiOrdenDetalle(BaseModel):
    id: int
    codigo: str
    estado: str
    descripcion_ingreso: str
    diagnostico: Optional[str] = None
    mecanico_nombre: Optional[str] = None
    costo_estimado: Optional[Decimal] = None
    costo_final: Optional[Decimal] = None
    fecha_ingreso: datetime
    fecha_estimada_entrega: Optional[datetime] = None
    fecha_entrega: Optional[datetime] = None
    vehiculo: VehiculoResumen
    etapa_actual: EtapaResponse
    pasos: list[PasoResponse]
    historial: list[HistorialResponse]
    imagenes: list[ImagenOrdenPortal] = []
    detalles: list[DetalleOrdenResponse]
    pagada: bool = False
    puede_pagar: bool = False
    pago: Optional[PagoResponse] = None
