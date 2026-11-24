from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status

from app.api.v1.repuestos import service
from app.core.dependencies import DbSession, PersonalUser, require_roles
from app.models.usuario import RolUsuario, Usuario
from app.schemas.paginacion import PaginaParams
from app.schemas.repuesto import IngresoStockRequest, RepuestoCreate, RepuestoResponse, RepuestoUpdate
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
    usuario: PersonalUser,
    pagina: PaginaParams,
    response: Response,
    solo_activos: bool = Query(default=False),
    q: str | None = Query(default=None),
) -> list[RepuestoResponse]:
    items, total = service.list_repuestos(
        db, solo_activos=solo_activos, q=q, pagina=pagina, usuario=usuario
    )
    response.headers["X-Total-Count"] = str(total)
    return items


@router.get(
    "/stock-bajo",
    response_model=list[RepuestoResponse],
    summary="Repuestos con stock menor o igual al mínimo",
)
def listar_stock_bajo(db: DbSession, usuario: PersonalUser) -> list[RepuestoResponse]:
    return service.list_stock_bajo(db, usuario)


@router.get(
    "/avisos",
    response_model=list[service.AvisoStockResponse],
    summary="Avisos internos del taller (stock mínimo)",
)
def listar_avisos(
    db: DbSession,
    _: MostradorUser,
    solo_no_leidas: bool = Query(default=False),
) -> list[service.AvisoStockResponse]:
    return service.list_avisos(db, solo_no_leidas=solo_no_leidas)


@router.post(
    "/avisos/{aviso_id}/leer",
    response_model=MessageResponse,
    summary="Marcar un aviso interno como leído",
)
def marcar_aviso_leido(
    aviso_id: int,
    db: DbSession,
    usuario: MostradorUser,
) -> MessageResponse:
    service.marcar_aviso_leido(db, aviso_id, usuario)
    return MessageResponse(detail="Aviso marcado como leído")


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
    usuario: PersonalUser,
) -> RepuestoResponse:
    return service.get_repuesto(db, repuesto_id, usuario)


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
    "/{repuesto_id}/ingresos",
    response_model=RepuestoResponse,
    summary="Ingresar stock de un repuesto",
)
def ingresar_stock(
    repuesto_id: int,
    datos: IngresoStockRequest,
    db: DbSession,
    _: MostradorUser,
) -> RepuestoResponse:
    return service.ingresar_stock(db, repuesto_id, datos)
