from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from app.api.v1.turnos import service
from app.core.dependencies import CurrentUser, DbSession, require_roles
from app.models.usuario import RolUsuario, Usuario
from app.schemas.usuario import MessageResponse
from app.schemas.turno import (
    TurnoCreate,
    TurnoEstadoUpdate,
    TurnoResponse,
    TurnoUpdate,
)

router = APIRouter(prefix="/turnos", tags=["Turnos"])

MostradorUser = Annotated[
    Usuario,
    Depends(require_roles(RolUsuario.administrador, RolUsuario.recepcion)),
]


@router.get(
    "",
    response_model=list[TurnoResponse],
    summary="Listar turnos",
)
def listar_turnos(
    db: DbSession,
    _: CurrentUser,
    estado: str | None = Query(default=None),
    cliente_id: int | None = Query(default=None),
) -> list[TurnoResponse]:
    return service.list_turnos(db, estado=estado, cliente_id=cliente_id)


@router.post(
    "",
    response_model=TurnoResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Agendar turno",
)
def crear_turno(
    data: TurnoCreate,
    db: DbSession,
    usuario: MostradorUser,
) -> TurnoResponse:
    return service.create_turno(db, data, registrado_por=usuario)


@router.get(
    "/{turno_id}",
    response_model=TurnoResponse,
    summary="Obtener turno por id",
)
def obtener_turno(
    turno_id: int,
    db: DbSession,
    _: CurrentUser,
) -> TurnoResponse:
    return service.get_turno(db, turno_id)


@router.put(
    "/{turno_id}",
    response_model=TurnoResponse,
    summary="Actualizar turno",
)
def actualizar_turno(
    turno_id: int,
    data: TurnoUpdate,
    db: DbSession,
    _: MostradorUser,
) -> TurnoResponse:
    return service.update_turno(db, turno_id, data)


@router.put(
    "/{turno_id}/estado",
    response_model=TurnoResponse,
    summary="Cambiar estado del turno",
)
def cambiar_estado_turno(
    turno_id: int,
    data: TurnoEstadoUpdate,
    db: DbSession,
    _: MostradorUser,
) -> TurnoResponse:
    return service.cambiar_estado(db, turno_id, data)


@router.delete(
    "/{turno_id}",
    response_model=MessageResponse,
    summary="Eliminar turno",
)
def eliminar_turno(
    turno_id: int,
    db: DbSession,
    _: MostradorUser,
) -> MessageResponse:
    service.delete_turno(db, turno_id)
    return MessageResponse(detail="Turno eliminado")
