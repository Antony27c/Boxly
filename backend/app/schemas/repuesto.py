from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


def _vacio_a_none(value):
    if isinstance(value, str):
        value = value.strip()
        return value or None
    return value


class RepuestoBase(BaseModel):
    codigo: str = Field(min_length=2, max_length=40)
    nombre: str = Field(min_length=2, max_length=120)
    descripcion: Optional[str] = None
    stock: int = Field(default=0, ge=0)
    stock_minimo: int = Field(default=0, ge=0)
    precio: Decimal = Field(ge=0, max_digits=12, decimal_places=2)

    @field_validator("codigo")
    @classmethod
    def normalizar_codigo(cls, value: str) -> str:
        return value.upper().replace(" ", "").strip()

    @field_validator("descripcion", mode="before")
    @classmethod
    def normalizar_descripcion(cls, value):
        return _vacio_a_none(value)


class RepuestoCreate(RepuestoBase):
    pass


class RepuestoUpdate(BaseModel):
    codigo: Optional[str] = Field(default=None, min_length=2, max_length=40)
    nombre: Optional[str] = Field(default=None, min_length=2, max_length=120)
    descripcion: Optional[str] = None
    stock: Optional[int] = Field(default=None, ge=0)
    stock_minimo: Optional[int] = Field(default=None, ge=0)
    precio: Optional[Decimal] = Field(default=None, ge=0, max_digits=12, decimal_places=2)
    activo: Optional[bool] = None

    @field_validator("codigo")
    @classmethod
    def normalizar_codigo(cls, value: str | None) -> str | None:
        if value is None:
            return value
        return value.upper().replace(" ", "").strip()

    @field_validator("descripcion", mode="before")
    @classmethod
    def normalizar_descripcion(cls, value):
        return _vacio_a_none(value)


class RepuestoResponse(RepuestoBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    activo: bool
    stock_bajo: bool = False


class IngresoStockRequest(BaseModel):
    cantidad: int = Field(ge=1, description="Cantidad a agregar al stock")
    nota: Optional[str] = Field(default=None, max_length=200)
