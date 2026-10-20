from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field,  field_validator

class DetalleOrdenCreate(BaseModel):
    repuesto_id:Optional[int] = Field(default= None, gt=0)
    descripcion:Optional[str] = Field(default= None, max_length=200)
    cantidad: int = Field (default=1, ge=1)
    precio_unitario: Optional[Decimal] = Field (default= None, ge =0, max_digits=12, decimal_places=2
    )
    @field_validator("descripcion", mode="before")
    @classmethod
    def normalizar_descripcion(cls, value):
        if isinstance(value, str):
            value = value.strip()
            return value or None
        return value

class DetalleOrdenResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    orden_id :int
    repuesto_id: Optional[int]= None
    repuesto_nombre: Optional[str]= None
    descripcion: str
    cantidad: int
    precio_unitario: Decimal
    subtotal: Decimal = Decimal("0")