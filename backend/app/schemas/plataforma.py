from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field

from app.models.usuario import RolUsuario


class TallerAdminCreate(BaseModel):
    """Primer administrador del taller nuevo (contrato P1)."""

    nombre: str = Field(min_length=2, max_length=80)
    apellido: str = Field(min_length=2, max_length=80)
    email: EmailStr


class TallerCreate(BaseModel):
    nombre: str = Field(min_length=2, max_length=120)
    admin: TallerAdminCreate


class TallerRenombrar(BaseModel):
    nombre: str = Field(min_length=2, max_length=120)


class PersonalTaller(BaseModel):
    """Miembro del personal de un taller (nunca cuentas de cliente)."""

    id: int
    nombre: str
    apellido: str
    email: str
    rol: RolUsuario
    activo: bool
    ultimo_ingreso: Optional[datetime] = None


class TallerResumen(BaseModel):
    """Conteos agregados del taller: ningún dato personal de clientes."""

    id: int
    nombre: str
    estado: str
    creado_en: datetime
    suspendido_en: Optional[datetime] = None
    personal: int
    clientes: int
    ordenes_mes: int
    ultimo_uso: Optional[datetime] = None
    soporte_vigente_hasta: Optional[datetime] = None
    terminos_aceptados_en: Optional[datetime] = None
    # Suscripción del taller (docs/Suscripciones.md).
    plan_codigo: str = "basico"
    suscripcion_estado: str = "al_dia"
    suscripcion_vence_en: Optional[date] = None


class OtorganteSoporte(BaseModel):
    nombre: str
    email: str


class AccesoSoporteResponse(BaseModel):
    id: int
    taller_id: int
    otorgado_por: Optional[OtorganteSoporte] = None
    motivo: Optional[str] = None
    desde: datetime
    hasta: datetime
    revocado_en: Optional[datetime] = None
    vigente: bool


class TallerDetalle(TallerResumen):
    """Resumen + personal del taller + últimos accesos de soporte."""

    # En el detalle `personal` es la lista de miembros (en el resumen es el conteo).
    personal: list[PersonalTaller]
    accesos_soporte: list[AccesoSoporteResponse]


class TallerAltaResponse(BaseModel):
    taller: TallerResumen
    admin_email: str
    password_temporal: str


class PasswordTemporalResponse(BaseModel):
    """La contraseña temporal se muestra una sola vez: hay que guardarla."""

    password_temporal: str


class SesionesResponse(BaseModel):
    detail: str
