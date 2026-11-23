from typing import Annotated

from fastapi import APIRouter, Query, Response

from app.api.v1.plataforma_solicitudes import service
from app.core.dependencies import DbSession, SuperAdminUser
from app.schemas.paginacion import PaginaParams
from app.schemas.publico import EstadoSolicitud, SolicitudResponse, SolicitudUpdate

# Solicitudes de demo de la landing (docs/Landing.md, L5). Solo superadmin: son
# prospectos de Boxly, no datos de ningún taller.
router = APIRouter(prefix="/plataforma", tags=["Plataforma: solicitudes"])


@router.get(
    "/solicitudes",
    response_model=list[SolicitudResponse],
    summary="Listar solicitudes de contacto",
)
def listar_solicitudes(
    db: DbSession,
    _: SuperAdminUser,
    pagina: PaginaParams,
    response: Response,
    estado: Annotated[EstadoSolicitud | None, Query()] = None,
) -> list[SolicitudResponse]:
    items, total = service.listar(db, estado=estado, pagina=pagina)
    response.headers["X-Total-Count"] = str(total)
    return items


@router.patch(
    "/solicitudes/{solicitud_id}",
    response_model=SolicitudResponse,
    summary="Cambiar el estado (y la nota) de una solicitud",
)
def actualizar_solicitud(
    solicitud_id: int,
    data: SolicitudUpdate,
    db: DbSession,
    _: SuperAdminUser,
) -> SolicitudResponse:
    return service.actualizar(db, solicitud_id, data)
