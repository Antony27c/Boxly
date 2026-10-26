from pydantic import BaseModel, ConfigDict, Field
from decimal import Decimal

class MecanicoMetricasResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    mecanico_id: int
    mecanico_nombre: str
    ordenes_cerradas: int
    tiempo_promedio_dias: Decimal = Field(default=Decimal("0"))
    monto_facturado: Decimal = Field(default=Decimal("0"))

class BalanceMensualResponse(BaseModel):
    mes: str
    ingreso: Decimal
    gastos_repuesto: Decimal
    balance: Decimal

class MejorMecanicoResponse(BaseModel):
    mecanico_id: int
    mecanico_nombre: str
    trimestre: str
    monto_facturado: Decimal
    