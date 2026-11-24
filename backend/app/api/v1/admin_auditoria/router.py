from datetime import date
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query, Response
from fastapi.responses import PlainTextResponse

from app.api.v1.admin_auditoria import service
from app.core.dependencies import DbSession, SuperAdminUser, require_roles
from app.models import Usuario
from app.models.usuario import RolUsuario
from app.schemas.auditoria import AuditoriaResponse, FiltrosAuditoria
from app.schemas.paginacion import PaginaParams

# Auditoría por taller y de plataforma (contrato en docs/Plataforma.md, P3).
# Los routers ya están montados bajo /api/v1: las rutas son absolutas.
#   /taller/auditoria*      → administrador: solo las filas de su taller
#                             (el filtro automático de la sesión ya lo acota).
#   /plataforma/auditoria*  → superadmin: toda la plataforma, con filtro
#                             opcional ?taller_id=.
router = APIRouter(prefix="", tags=["Auditoría"])

AdminTallerUser = Annotated[
    Usuario, Depends(require_roles(RolUsuario.administrador))
]

UsuarioIdParam = Annotated[Optional[int], Query()]
TallerIdParam = Annotated[Optional[int], Query()]
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
    taller_id: int | None = None,
) -> FiltrosAuditoria:
    return FiltrosAuditoria(
        usuario_id=usuario_id,
        taller_id=taller_id,
        metodo=metodo,
        entidad=entidad,
        desde=desde,
        hasta=hasta,
        solo_errores=solo_errores,
    )


# --- Auditoría del taller (administrador) ------------------------------------


@router.get(
    "/taller/auditoria",
    response_model=list[AuditoriaResponse],
    summary="Auditoría del taller",
)
def listar_auditoria_taller(
    db: DbSession,
    _: AdminTallerUser,
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
    "/taller/auditoria/exportar",
    response_class=PlainTextResponse,
    summary="Exportar la auditoría del taller a CSV",
)
def exportar_auditoria_taller(
    db: DbSession,
    _: AdminTallerUser,
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


# --- Auditoría de la plataforma (superadmin) ---------------------------------


@router.get(
    "/plataforma/auditoria",
    response_model=list[AuditoriaResponse],
    summary="Auditoría de la plataforma",
)
def listar_auditoria_plataforma(
    db: DbSession,
    _: SuperAdminUser,
    pagina: PaginaParams,
    response: Response,
    taller_id: TallerIdParam = None,
    usuario_id: UsuarioIdParam = None,
    metodo: MetodoParam = None,
    entidad: EntidadParam = None,
    desde: DesdeParam = None,
    hasta: HastaParam = None,
    solo_errores: SoloErroresParam = False,
) -> list[AuditoriaResponse]:
    items, total = service.list_auditoria(
        db,
        _filtros(usuario_id, metodo, entidad, desde, hasta, solo_errores, taller_id),
        pagina,
    )
    response.headers["X-Total-Count"] = str(total)
    return items


@router.get(
    "/plataforma/auditoria/exportar",
    response_class=PlainTextResponse,
    summary="Exportar la auditoría de la plataforma a CSV",
)
def exportar_auditoria_plataforma(
    db: DbSession,
    _: SuperAdminUser,
    taller_id: TallerIdParam = None,
    usuario_id: UsuarioIdParam = None,
    metodo: MetodoParam = None,
    entidad: EntidadParam = None,
    desde: DesdeParam = None,
    hasta: HastaParam = None,
    solo_errores: SoloErroresParam = False,
) -> PlainTextResponse:
    contenido, filename = service.exportar_csv(
        db,
        _filtros(usuario_id, metodo, entidad, desde, hasta, solo_errores, taller_id),
    )
    return PlainTextResponse(
        contenido,
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )
