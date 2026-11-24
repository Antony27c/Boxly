"""Schemas de suscripciones, planes, pagos manuales, adicionales y tipo de acceso
(docs/Suscripciones.md, S1, y docs/Oferta.md, C2)."""
from datetime import date, datetime
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.core.funciones import FUNCIONES
from app.schemas.sin_dinero import SinDineroMixin

TipoAcceso = Literal["pago", "demo", "piloto"]
# Adicionales confirmados (docs/Oferta.md): por ahora solo ARCA.
CodigoAdicional = Literal["arca"]


class PlanResponse(SinDineroMixin, BaseModel):
    """Plan de Boxly. El mecánico ve el plan y sus funciones, no el precio."""

    model_config = ConfigDict(from_attributes=True)
    _CAMPOS_DINERO = {"precio_mensual": None}

    codigo: str
    nombre: str
    # Opcional solo en la respuesta: va en null cuando se oculta el dinero.
    precio_mensual: Optional[Decimal] = None
    # NULL = sin límite de personal.
    max_personal: Optional[int] = None
    funciones: list[str] = []
    activo: bool


class AdicionalResponse(BaseModel):
    """Adicional del taller encima de su plan (hoy solo ``arca``)."""

    model_config = ConfigDict(from_attributes=True)

    codigo: str
    # NULL = sin límite de ese lado.
    desde: Optional[date] = None
    hasta: Optional[date] = None


class SuscripcionResponse(SinDineroMixin, BaseModel):
    """El mecánico recibe estado, plan, fechas y funciones (para los avisos de
    solo lectura), sin el precio del plan ni el próximo monto."""

    _CAMPOS_DINERO = {"plan.precio_mensual": None, "proximo_monto": None}

    plan: PlanResponse
    # NULL = sin vencimiento (queda al día).
    vence_en: Optional[date] = None
    estado: str
    # Días hasta el vencimiento; negativo si ya venció.
    dias_para_vencer: int
    cobro_automatico: bool
    personal_activo: int
    max_personal: Optional[int] = None
    # Opcional solo en la respuesta: va en null cuando se oculta el dinero.
    proximo_monto: Optional[Decimal] = None
    # docs/Oferta.md (C2): cómo accede el taller, adicionales vigentes y las
    # funciones que tiene por su plan más sus adicionales.
    tipo_acceso: TipoAcceso = "pago"
    adicionales: list[AdicionalResponse] = []
    funciones_efectivas: list[str] = []
    # Calculadas con app/core/suscripcion.py para que el frontend no repita la
    # regla de los días: último día con todo normal (null si no hay gracia,
    # como en la demo) y último día antes de la suspensión.
    fin_gracia: Optional[date] = None
    fin_acceso: Optional[date] = None


class PagoSuscripcionResponse(SinDineroMixin, BaseModel):
    """Pago de la suscripción del taller a Boxly (sin taller_id ni mp_payment_id).
    El mecánico no recibe el monto."""

    model_config = ConfigDict(from_attributes=True)
    _CAMPOS_DINERO = {"monto": None}

    id: int
    # Opcional solo en la respuesta: va en null cuando se oculta el dinero.
    monto: Optional[Decimal] = None
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
    # Códigos de app/core/funciones.py; se guardan sin repetidos.
    funciones: Optional[list[str]] = None

    @field_validator("funciones")
    @classmethod
    def _funciones_validas(cls, valor: Optional[list[str]]) -> Optional[list[str]]:
        if valor is None:
            return None
        invalidas = [f for f in valor if f not in FUNCIONES]
        if invalidas:
            raise ValueError(f"Función desconocida: {', '.join(invalidas)}")
        return list(dict.fromkeys(valor))


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


def _validar_rango(desde: Optional[date], hasta: Optional[date]) -> None:
    if desde is not None and hasta is not None and hasta < desde:
        raise ValueError("La fecha de fin no puede ser anterior a la de inicio")


class AdicionalCreate(BaseModel):
    """Activación de un adicional por el superadmin (docs/Oferta.md, C2)."""

    codigo: CodigoAdicional
    desde: Optional[date] = None
    hasta: Optional[date] = None

    @model_validator(mode="after")
    def _rango(self) -> "AdicionalCreate":
        _validar_rango(self.desde, self.hasta)
        return self


# Qué datos pide cada tipo de acceso (docs/Oferta.md, API de C2). Demo no pide
# nada: el plan y el vencimiento los fija el sistema.
CAMPOS_POR_ACCESO: dict[str, tuple[str, ...]] = {
    "demo": (),
    "piloto": ("plan", "vence_en", "motivo"),
    "pago": ("plan",),
}


class AccesoTaller(BaseModel):
    """Tipo de acceso del taller, en el alta o al convertirlo."""

    tipo: TipoAcceso = "demo"
    plan: Optional[str] = Field(default=None, min_length=1, max_length=20)
    vence_en: Optional[date] = None
    motivo: Optional[str] = Field(default=None, max_length=300)

    @field_validator("motivo")
    @classmethod
    def _motivo_sin_espacios(cls, valor: Optional[str]) -> Optional[str]:
        return (valor or "").strip() or None

    @model_validator(mode="after")
    def _campos_requeridos(self) -> "AccesoTaller":
        faltan = [c for c in CAMPOS_POR_ACCESO[self.tipo] if getattr(self, c) is None]
        if faltan:
            raise ValueError(f"El acceso {self.tipo} pide: {', '.join(faltan)}")
        return self


# --- Cobro automático con Mercado Pago (docs/Suscripciones.md, S2) -------------


class CobroAutomaticoResponse(BaseModel):
    """URL de Mercado Pago para autorizar el débito automático."""

    init_point: Optional[str] = None


class SimularCobroRequest(BaseModel):
    """Simulador de dev: ``aprobado``/``approved`` o ``rechazado``/``rejected``."""

    estado: Optional[str] = None


class SimularCobroResponse(BaseModel):
    # NULL cuando el cobro simulado ya estaba registrado (duplicado).
    id: Optional[int] = None
    estado: str
    duplicado: bool
    monto: str
    periodo_desde: Optional[str] = None
    periodo_hasta: Optional[str] = None
