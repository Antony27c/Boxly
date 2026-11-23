from typing import Literal

from fastapi import APIRouter, Query, Response, status

from app.api.v1.plataforma_talleres import service
from app.core.dependencies import DbSession, SuperAdminUser
from app.schemas.paginacion import PaginaParams
from app.schemas.plataforma import (
    PasswordTemporalResponse,
    SesionesResponse,
    TallerAltaResponse,
    TallerCreate,
    TallerDetalle,
    TallerRenombrar,
    TallerResumen,
)

# Talleres y personal de la plataforma (contrato en docs/Plataforma.md, P1).
# Solo superadmin: la sesión queda en contexto plataforma (taller_id=None).
router = APIRouter(prefix="/plataforma", tags=["Plataforma: talleres"])


@router.get(
    "/talleres",
    response_model=list[TallerResumen],
    summary="Listar talleres",
)
def listar_talleres(
    db: DbSession,
    _: SuperAdminUser,
    pagina: PaginaParams,
    response: Response,
    estado: Literal["activo", "suspendido"] | None = Query(default=None),
    q: str | None = Query(default=None),
) -> list[TallerResumen]:
    items, total = service.listar_talleres(db, estado=estado, q=q, pagina=pagina)
    response.headers["X-Total-Count"] = str(total)
    return items


@router.post(
    "/talleres",
    response_model=TallerAltaResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Crear taller con su primer administrador",
)
def crear_taller(
    data: TallerCreate,
    db: DbSession,
    _: SuperAdminUser,
) -> TallerAltaResponse:
    return service.crear_taller(db, data)


@router.get(
    "/talleres/{taller_id}",
    response_model=TallerDetalle,
    summary="Detalle del taller con su personal y accesos de soporte",
)
def detalle_taller(
    taller_id: int,
    db: DbSession,
    _: SuperAdminUser,
) -> TallerDetalle:
    return service.detalle(db, taller_id)


@router.put(
    "/talleres/{taller_id}",
    response_model=TallerResumen,
    summary="Renombrar taller",
)
def renombrar_taller(
    taller_id: int,
    data: TallerRenombrar,
    db: DbSession,
    _: SuperAdminUser,
) -> TallerResumen:
    return service.renombrar(db, taller_id, data)


@router.post(
    "/talleres/{taller_id}/suspender",
    response_model=TallerResumen,
    summary="Suspender taller",
)
def suspender_taller(
    taller_id: int,
    db: DbSession,
    _: SuperAdminUser,
) -> TallerResumen:
    return service.suspender(db, taller_id)


@router.post(
    "/talleres/{taller_id}/reactivar",
    response_model=TallerResumen,
    summary="Reactivar taller",
)
def reactivar_taller(
    taller_id: int,
    db: DbSession,
    _: SuperAdminUser,
) -> TallerResumen:
    return service.reactivar(db, taller_id)


@router.post(
    "/usuarios/{user_id}/restablecer-password",
    response_model=PasswordTemporalResponse,
    summary="Restablecer la contraseña del personal de un taller",
)
def restablecer_password(
    user_id: int,
    db: DbSession,
    _: SuperAdminUser,
) -> PasswordTemporalResponse:
    return service.restablecer_password(db, user_id)


@router.post(
    "/usuarios/{user_id}/cerrar-sesiones",
    response_model=SesionesResponse,
    summary="Cerrar las sesiones del personal de un taller",
)
def cerrar_sesiones(
    user_id: int,
    db: DbSession,
    _: SuperAdminUser,
) -> SesionesResponse:
    return service.cerrar_sesiones(db, user_id)
