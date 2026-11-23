import re
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from app.schemas.horario_mecanico import PATRON_HORA

# Los opcionales se guardan como NULL cuando llegan vacíos.
CAMPOS_TEXTO_OPCIONALES = (
    "razon_social",
    "direccion",
    "telefono",
    "sitio_web",
    "mensaje_portal",
    "pie_ticket",
)

# Estos campos son NOT NULL en la base: no admiten null explícito.
CAMPOS_OBLIGATORIOS = ("nombre", "hora_apertura", "hora_cierre", "dias_garantia")


def _vacio_a_none(value):
    if isinstance(value, str):
        value = value.strip()
        return value or None
    return value


class TallerUpdate(BaseModel):
    """Actualización parcial de los datos del taller (solo superadmin)."""

    nombre: Optional[str] = Field(default=None, min_length=2, max_length=120)
    razon_social: Optional[str] = Field(default=None, max_length=120)
    cuit: Optional[str] = None
    direccion: Optional[str] = Field(default=None, max_length=200)
    telefono: Optional[str] = Field(default=None, max_length=30)
    email: Optional[EmailStr] = Field(default=None, max_length=120)
    sitio_web: Optional[str] = Field(default=None, max_length=200)
    hora_apertura: Optional[str] = Field(default=None, pattern=PATRON_HORA)
    hora_cierre: Optional[str] = Field(default=None, pattern=PATRON_HORA)
    mensaje_portal: Optional[str] = Field(default=None, max_length=500)
    pie_ticket: Optional[str] = Field(default=None, max_length=300)
    dias_garantia: Optional[int] = Field(default=None, ge=0, le=3650)

    @field_validator(*CAMPOS_TEXTO_OPCIONALES, "email", mode="before")
    @classmethod
    def normalizar_opcionales(cls, value):
        return _vacio_a_none(value)

    @field_validator("cuit", mode="before")
    @classmethod
    def normalizar_cuit(cls, value):
        value = _vacio_a_none(value)
        if value is None or not isinstance(value, str):
            return value
        # Se aceptan guiones y espacios; el CUIT queda como XX-XXXXXXXX-X.
        digitos = re.sub(r"[\s-]", "", value)
        if not re.fullmatch(r"\d{11}", digitos):
            raise ValueError("El CUIT tiene que tener 11 dígitos")
        return f"{digitos[:2]}-{digitos[2:10]}-{digitos[10]}"

    @model_validator(mode="after")
    def validar_obligatorios_y_horario(self):
        for campo in CAMPOS_OBLIGATORIOS:
            if campo in self.model_fields_set and getattr(self, campo) is None:
                raise ValueError(f"{campo} no puede ser null")
        if self.hora_apertura and self.hora_cierre and self.hora_apertura >= self.hora_cierre:
            raise ValueError("La hora de apertura tiene que ser antes que la de cierre")
        return self


class TallerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    nombre: str
    razon_social: Optional[str] = None
    cuit: Optional[str] = None
    direccion: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[EmailStr] = None
    sitio_web: Optional[str] = None
    hora_apertura: str
    hora_cierre: str
    mensaje_portal: Optional[str] = None
    pie_ticket: Optional[str] = None
    dias_garantia: int
    actualizado_en: Optional[datetime] = None
