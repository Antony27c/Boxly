from fastapi import APIRouter, Query

from app.api.v1.portal import service
from app.core.dependencies import ClienteUser, DbSession
from app.schemas.portal import MiOrdenDetalle, MiOrdenResumen, MiVehiculoResponse

router = APIRouter(tags=["Portal del cliente"])


@router.get(
    "/mis-vehiculos",
    response_model=list[MiVehiculoResponse],
    summary="Vehículos del cliente logueado",
)
def mis_vehiculos(db: DbSession, usuario: ClienteUser) -> list[MiVehiculoResponse]:
    return service.list_mis_vehiculos(db, usuario)


@router.get(
    "/mis-ordenes",
    response_model=list[MiOrdenResumen],
    summary="Órdenes del cliente logueado",
)
def mis_ordenes(
    db: DbSession,
    usuario: ClienteUser,
    vehiculo_id: int | None = Query(default=None),
) -> list[MiOrdenResumen]:
    return service.list_mis_ordenes(db, usuario, vehiculo_id=vehiculo_id)


@router.get(
    "/mis-ordenes/{orden_id}",
    response_model=MiOrdenDetalle,
    summary="Seguimiento de una orden del cliente logueado",
)
def mi_orden(orden_id: int, db: DbSession, usuario: ClienteUser) -> MiOrdenDetalle:
    return service.get_mi_orden(db, usuario, orden_id)
