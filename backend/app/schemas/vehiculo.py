from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


def _vacio_a_none(value):
    if isinstance(value, str):
        value = value.strip()
        return value or None
    return value


class VehiculoBase(BaseModel):
    """DER §3.3 — Vehículo de un cliente."""

    cliente_id: int = Field(gt=0)
    patente: str = Field(min_length=6, max_length=15)
    marca: str = Field(min_length=2, max_length=60)
    modelo: str = Field(min_length=1, max_length=60)
    anio: Optional[int] = Field(default=None, ge=1900, le=2100)
    color: Optional[str] = Field(default=None, max_length=40)
    vin: Optional[str] = Field(default=None, max_length=50)
    observaciones: Optional[str] = None

    @field_validator("patente")
    @classmethod
    def normalizar_patente(cls, value: str) -> str:
        return value.upper().replace(" ", "").strip()

    @field_validator("color", "vin", "observaciones", mode="before")
    @classmethod
    def normalizar_opcionales(cls, value):
        return _vacio_a_none(value)


class VehiculoCreate(VehiculoBase):
    pass


class VehiculoUpdate(BaseModel):
    cliente_id: Optional[int] = Field(default=None, gt=0)
    patente: Optional[str] = Field(default=None, min_length=6, max_length=15)
    marca: Optional[str] = Field(default=None, min_length=2, max_length=60)
    modelo: Optional[str] = Field(default=None, min_length=1, max_length=60)
    anio: Optional[int] = Field(default=None, ge=1900, le=2100)
    color: Optional[str] = Field(default=None, max_length=40)
    vin: Optional[str] = Field(default=None, max_length=50)
    observaciones: Optional[str] = None

    @field_validator("patente")
    @classmethod
    def normalizar_patente(cls, value: str | None) -> str | None:
        if value is None:
            return value
        return value.upper().replace(" ", "").strip()

    @field_validator("color", "vin", "observaciones", mode="before")
    @classmethod
    def normalizar_opcionales(cls, value):
        return _vacio_a_none(value)


class VehiculoResponse(VehiculoBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
