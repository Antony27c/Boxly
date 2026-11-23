"""Schemas de suscripciones, planes y pagos manuales (docs/Suscripciones.md, S1)."""
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class PlanResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    codigo: str
    nombre: str
    precio_mensual: Decimal
    # NULL = sin límite de personal.
    max_personal: Optional[int] = None
    activo: bool


class SuscripcionResponse(BaseModel):
    plan: PlanResponse
    # NULL = sin vencimiento (queda al día).
    vence_en: Optional[date] = None
    estado: str
    # Días hasta el vencimiento; negativo si ya venció.
    dias_para_vencer: int
    cobro_automatico: bool
    personal_activo: int
    max_personal: Optional[int] = None
    proximo_monto: Decimal


class PagoSuscripcionResponse(BaseModel):
    """Pago de la suscripción del taller a Boxly (sin taller_id ni mp_payment_id)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    monto: Decimal
    periodo_desde: date
    periodo_hasta: date
    medio: str
    estado: str
    referencia: Optional[str] = None
    registrado_por: Optional[str] = None
    creado_en: datetime


class SuscripcionDetalleResponse(SuscripcionResponse):
    """Vista de plataforma: la suscripción del taller más sus pagos."""

    pagos: list[PagoSuscripcionResponse] = []


class CambioPlanRequest(BaseModel):
    plan: str = Field(min_length=1, max_length=20)


class PlanUpdate(BaseModel):
    """Edición parcial de un plan (superadmin). ``max_personal: null`` explícito
    lo deja sin límite; si no viene, conserva el valor actual."""

    nombre: Optional[str] = Field(default=None, min_length=1, max_length=60)
    precio_mensual: Optional[Decimal] = Field(default=None, gt=0)
    max_personal: Optional[int] = Field(default=None, ge=0)
    activo: Optional[bool] = None


class PagoManualCreate(BaseModel):
    """Pago manual registrado por el superadmin. ``fecha`` es la fecha del pago:
    el período arranca desde max(vencimiento + 1, fecha o hoy)."""

    monto: Decimal = Field(gt=0)
    meses: int = Field(default=1, ge=1, le=12)
    referencia: Optional[str] = Field(default=None, max_length=200)
    fecha: Optional[date] = None


class VencimientoUpdate(BaseModel):
    """Ajuste manual del vencimiento (cortesía o corrección)."""

    vence_en: date
