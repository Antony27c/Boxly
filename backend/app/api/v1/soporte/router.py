"""Acceso de soporte (tarea P2, contrato en docs/Plataforma.md).

Lado taller: el administrador otorga, consulta el historial y revoca accesos
temporales de solo lectura para el superadmin. Lado plataforma:
GET /plataforma/soporte lista los accesos vigentes de todos los talleres.
"""
from typing import Annotated

from fastapi import APIRouter, Depends, Response, status

from app.api.v1.soporte import service
from app.core.dependencies import DbSession, SuperAdminUser, require_roles
from app.models.usuario import RolUsuario, Usuario
from app.schemas.auditoria import AuditoriaResponse
from app.schemas.paginacion import PaginaParams
from app.schemas.soporte import (
    AccesoSoporteCreate,
    AccesoSoporteResponse,
    AccesoSoporteVigentePlataforma,
)

# Sin prefijo: las rutas del taller cuelgan de /soporte y la del superadmin de
# /plataforma (así entra todo con el include_router(prefix="/api/v1") actual).
router = APIRouter(tags=["Soporte"])

AdminTaller = Annotated[
    Usuario,
    Depends(require_roles(RolUsuario.administrador)),
]


@router.get(
    "/soporte/accesos",
    response_model=list[AccesoSoporteResponse],
    summary="Accesos de soporte del taller",
)
def listar_accesos(db: DbSession, _: AdminTaller) -> list[AccesoSoporteResponse]:
    return service.listar_accesos(db)


@router.post(
    "/soporte/accesos",
    response_model=AccesoSoporteResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Otorgar acceso de soporte",
)
def otorgar_acceso(
    datos: AccesoSoporteCreate, db: DbSession, usuario: AdminTaller
) -> AccesoSoporteResponse:
    return service.otorgar(db, usuario, datos)


@router.post(
    "/soporte/accesos/{acceso_id}/revocar",
    response_model=AccesoSoporteResponse,
    summary="Revocar un acceso de soporte",
)
def revocar_acceso(
    acceso_id: int, db: DbSession, usuario: AdminTaller
) -> AccesoSoporteResponse:
    return service.revocar(db, usuario, acceso_id)


@router.get(
    "/soporte/actividad",
    response_model=list[AuditoriaResponse],
    summary="Actividad del superadmin en modo soporte",
)
def actividad_soporte(
    db: DbSession,
    _: AdminTaller,
    pagina: PaginaParams,
    response: Response,
) -> list[AuditoriaResponse]:
    items, total = service.actividad(db, pagina)
    response.headers["X-Total-Count"] = str(total)
    return items


@router.get(
    "/plataforma/soporte",
    response_model=list[AccesoSoporteVigentePlataforma],
    summary="Accesos de soporte vigentes (plataforma)",
)
def accesos_vigentes(
    db: DbSession, _: SuperAdminUser
) -> list[AccesoSoporteVigentePlataforma]:
    return service.vigentes_plataforma(db)
