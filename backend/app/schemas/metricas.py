from datetime import date
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel


class MecanicoMetricasResponse(BaseModel):
    mecanico_id: int
    nombre: str
    ordenes_cerradas: int
    ordenes_en_curso: int
    tiempo_promedio_horas: Optional[float] = None
    facturado: Decimal


class BalanceMensualResponse(BaseModel):
    mes: str
    ingresos: Decimal
    egresos: Decimal
    balance: Decimal


class FinanzasResponse(BaseModel):
    desde: date
    hasta: date
    ingresos: Decimal
    cobrado_online: Decimal
    egresos_repuestos: Decimal
    balance: Decimal
    mensual: list[BalanceMensualResponse]


class MecanicoDestacadoResponse(BaseModel):
    mecanico_id: int
    nombre: str
    ordenes_cerradas: int
    tiempo_promedio_horas: Optional[float] = None
    facturado: Decimal


class MejorMecanicoResponse(BaseModel):
    trimestre: str
    desde: date
    hasta: date
    criterio: str
    mecanico: Optional[MecanicoDestacadoResponse] = None
