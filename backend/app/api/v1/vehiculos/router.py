from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from app.api.v1.vehiculos import service
from app.core.dependencies import CurrentUser, DbSession, require_roles
from app.models.usuario import RolUsuario, Usuario
from app.schemas.usuario import MessageResponse
from app.schemas.orden import OrdenResponse
from app.schemas.vehiculo import VehiculoCreate, VehiculoResponse, VehiculoUpdate

router = APIRouter(prefix="/vehiculos", tags=["Vehículos"])

MostradorUser = Annotated[
    Usuario,
    Depends(require_roles(RolUsuario.administrador, RolUsuario.recepcion)),
]


@router.get(
    "",
    response_model=list[VehiculoResponse],
    summary="Listar vehículos",
)
def listar_vehiculos(
    db: DbSession,
    _: CurrentUser,
    cliente_id: int | None = Query(default=None),
) -> list[VehiculoResponse]:
    return service.list_vehiculos(db, cliente_id=cliente_id)


@router.post(
    "",
    response_model=VehiculoResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Crear vehículo",
)
def crear_vehiculo(
    data: VehiculoCreate,
    db: DbSession,
    _: MostradorUser,
) -> VehiculoResponse:
    return service.create_vehiculo(db, data)


@router.get(
    "/{vehiculo_id}",
    response_model=VehiculoResponse,
    summary="Obtener vehículo por id",
)
def obtener_vehiculo(
    vehiculo_id: int,
    db: DbSession,
    _: CurrentUser,
) -> VehiculoResponse:
    return service.get_vehiculo(db, vehiculo_id)


@router.get(
    "/{vehiculo_id}/ordenes",
    response_model=list[OrdenResponse],
    summary="Historial de órdenes del vehículo",
)
def historial_vehiculo(
    vehiculo_id: int,
    db: DbSession,
    _: CurrentUser,
) -> list[OrdenResponse]:
    return service.historial_ordenes(db, vehiculo_id)


@router.put(
    "/{vehiculo_id}",
    response_model=VehiculoResponse,
    summary="Actualizar vehículo",
)
def actualizar_vehiculo(
    vehiculo_id: int,
    data: VehiculoUpdate,
    db: DbSession,
    _: MostradorUser,
) -> VehiculoResponse:
    return service.update_vehiculo(db, vehiculo_id, data)


@router.delete(
    "/{vehiculo_id}",
    response_model=MessageResponse,
    summary="Eliminar vehículo",
)
def eliminar_vehiculo(
    vehiculo_id: int,
    db: DbSession,
    _: MostradorUser,
) -> MessageResponse:
    service.delete_vehiculo(db, vehiculo_id)
    return MessageResponse(detail="Vehículo eliminado")
