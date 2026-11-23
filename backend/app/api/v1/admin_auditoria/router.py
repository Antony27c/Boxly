from datetime import date
from typing import Annotated, Optional

from fastapi import APIRouter, Query, Response
from fastapi.responses import PlainTextResponse

from app.api.v1.admin_auditoria import service
from app.core.dependencies import DbSession, SuperAdminUser
from app.schemas.auditoria import AuditoriaResponse, FiltrosAuditoria
from app.schemas.paginacion import PaginaParams

# Tarea B2: GET /admin/auditoria y /admin/auditoria/exportar (contrato en docs/SuperAdmin.md).
router = APIRouter(prefix="/admin/auditoria", tags=["Superadmin: auditoría"])

UsuarioIdParam = Annotated[Optional[int], Query()]
MetodoParam = Annotated[Optional[str], Query()]
EntidadParam = Annotated[Optional[str], Query()]
DesdeParam = Annotated[Optional[date], Query()]
HastaParam = Annotated[Optional[date], Query()]
SoloErroresParam = Annotated[bool, Query()]


def _filtros(
    usuario_id: int | None,
    metodo: str | None,
    entidad: str | None,
    desde: date | None,
    hasta: date | None,
    solo_errores: bool,
) -> FiltrosAuditoria:
    return FiltrosAuditoria(
        usuario_id=usuario_id,
        metodo=metodo,
        entidad=entidad,
        desde=desde,
        hasta=hasta,
        solo_errores=solo_errores,
    )


@router.get(
    "",
    response_model=list[AuditoriaResponse],
    summary="Listar auditoría",
)
def listar_auditoria(
    db: DbSession,
    _: SuperAdminUser,
    pagina: PaginaParams,
    response: Response,
    usuario_id: UsuarioIdParam = None,
    metodo: MetodoParam = None,
    entidad: EntidadParam = None,
    desde: DesdeParam = None,
    hasta: HastaParam = None,
    solo_errores: SoloErroresParam = False,
) -> list[AuditoriaResponse]:
    items, total = service.list_auditoria(
        db,
        _filtros(usuario_id, metodo, entidad, desde, hasta, solo_errores),
        pagina,
    )
    response.headers["X-Total-Count"] = str(total)
    return items


@router.get(
    "/exportar",
    response_class=PlainTextResponse,
    summary="Exportar auditoría a CSV",
)
def exportar_auditoria(
    db: DbSession,
    _: SuperAdminUser,
    usuario_id: UsuarioIdParam = None,
    metodo: MetodoParam = None,
    entidad: EntidadParam = None,
    desde: DesdeParam = None,
    hasta: HastaParam = None,
    solo_errores: SoloErroresParam = False,
) -> PlainTextResponse:
    contenido, filename = service.exportar_csv(
        db,
        _filtros(usuario_id, metodo, entidad, desde, hasta, solo_errores),
    )
    return PlainTextResponse(
        contenido,
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )
