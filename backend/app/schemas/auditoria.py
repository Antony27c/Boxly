from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class AuditoriaResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    creado_en: datetime
    usuario_id: Optional[int] = None
    taller_id: Optional[int] = None
    usuario_email: Optional[str] = None
    rol: Optional[str] = None
    metodo: str
    ruta: str
    entidad: Optional[str] = None
    entidad_id: Optional[int] = None
    estado_http: int
    ip: Optional[str] = None
    detalle: Optional[str] = None


class FiltrosAuditoria(BaseModel):
    """Filtros compartidos por el listado y la exportación CSV.

    ``taller_id`` solo lo usa la vista de plataforma; el administrador del
    taller ya queda acotado por el filtro automático de la sesión.
    """

    usuario_id: Optional[int] = None
    taller_id: Optional[int] = None
    metodo: Optional[str] = None
    entidad: Optional[str] = None
    desde: Optional[date] = None
    hasta: Optional[date] = None
    solo_errores: bool = False
