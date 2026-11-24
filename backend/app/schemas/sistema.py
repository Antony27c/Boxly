"""Schemas del estado de la plataforma y del respaldo por taller (P3)."""

from pydantic import BaseModel


class SistemaDbResponse(BaseModel):
    motor: str
    ok: bool
    revision: str | None = None


class SistemaConteosResponse(BaseModel):
    usuarios: int
    clientes: int
    vehiculos: int
    ordenes: int
    ordenes_abiertas: int
    repuestos: int
    turnos: int
    pagos: int


class SistemaUsuariosPorRolResponse(BaseModel):
    superadmin: int
    administrador: int
    recepcion: int
    mecanico: int
    cliente: int


class SistemaUploadsResponse(BaseModel):
    archivos: int
    bytes: int


class SistemaIntegracionesResponse(BaseModel):
    email: bool
    mercadopago: bool
    rate_limit: bool


class SistemaTalleresResponse(BaseModel):
    """Talleres de la plataforma agrupados por estado."""

    activo: int
    suspendido: int


class SistemaResponse(BaseModel):
    version: str
    entorno: str
    db: SistemaDbResponse
    conteos: SistemaConteosResponse
    usuarios_por_rol: SistemaUsuariosPorRolResponse
    talleres: SistemaTalleresResponse
    uploads: SistemaUploadsResponse
    integraciones: SistemaIntegracionesResponse
