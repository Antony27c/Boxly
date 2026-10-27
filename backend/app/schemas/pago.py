from datetime import datetime
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict


class PagoResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    orden_id: int
    monto: Decimal
    estado: str
    preference_id: Optional[str] = None
    payment_id: Optional[str] = None
    creado_en: datetime
    fecha_pago: Optional[datetime] = None


class PreferenciaPagoResponse(BaseModel):
    pago_id: int
    orden_id: int
    monto: Decimal
    estado: str
    preference_id: Optional[str] = None
    url_pago: str


class ConfirmarPagoRequest(BaseModel):
    payment_id: str


class SimularPagoRequest(BaseModel):
    estado: Literal["aprobado", "rechazado"]
