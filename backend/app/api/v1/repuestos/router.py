from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from app.api.v1.repuestos import service
from app.core.dependencies import CurrentUser, DbSession, require_roles
from app.models.usuario import RolUsuario, Usuario
from app.schemas.repuesto import RepuestoCreate, RepuestoResponse, RepuestoUpdate, EntradaStockRequest
from app.schemas.usuario import MessageResponse


router = APIRouter(prefix="/repuestos", tags=["Repuestos"])

MostradorUser = Annotated[
    Usuario,
    Depends(require_roles(RolUsuario.administrador, RolUsuario.recepcion)),
]


@router.get(
    "",
    response_model=list[RepuestoResponse],
    summary="Listar repuestos",
)
def listar_repuestos(
    db: DbSession,
    _: CurrentUser,
    solo_activos: bool = Query(default=False),
) -> list[RepuestoResponse]:
    return service.list_repuestos(db, solo_activos=solo_activos)


@router.get(
    "/stock-bajo",
    response_model=list[RepuestoResponse],
    summary="Repuestos con stock menor o igual al mínimo",
)
def listar_stock_bajo(db: DbSession, _: CurrentUser) -> list[RepuestoResponse]:
    return service.list_stock_bajo(db)


@router.post(
    "",
    response_model=RepuestoResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Crear repuesto",
)
def crear_repuesto(
    data: RepuestoCreate,
    db: DbSession,
    _: MostradorUser,
) -> RepuestoResponse:
    return service.create_repuesto(db, data)


@router.get(
    "/{repuesto_id}",
    response_model=RepuestoResponse,
    summary="Obtener repuesto por id",
)
def obtener_repuesto(
    repuesto_id: int,
    db: DbSession,
    _: CurrentUser,
) -> RepuestoResponse:
    return service.get_repuesto(db, repuesto_id)


@router.put(
    "/{repuesto_id}",
    response_model=RepuestoResponse,
    summary="Actualizar repuesto",
)
def actualizar_repuesto(
    repuesto_id: int,
    data: RepuestoUpdate,
    db: DbSession,
    _: MostradorUser,
) -> RepuestoResponse:
    return service.update_repuesto(db, repuesto_id, data)


@router.delete(
    "/{repuesto_id}",
    response_model=MessageResponse,
    summary="Eliminar repuesto",
)
def eliminar_repuesto(
    repuesto_id: int,
    db: DbSession,
    _: MostradorUser,
) -> MessageResponse:
    service.delete_repuesto(db, repuesto_id)
    return MessageResponse(detail="Repuesto eliminado")

@router.post(
    "/{repuesto_id}/entrada-stock",
    response_model=RepuestoResponse ,
)
def entrada_stock(
    repuesto_id: int,
    datos: EntradaStockRequest,
    db: DbSession,
    _: AdminUser,
):
    return repuesto_service.entrada_stock(db, repuesto_id, datos)