from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from app.api.v1.clientes import service
from app.core.dependencies import CurrentUser, DbSession, require_roles
from app.models.usuario import RolUsuario, Usuario
from app.schemas.usuario import MessageResponse
from app.schemas.cliente import ClienteCreate, ClienteResponse, ClienteUpdate

router = APIRouter(prefix="/clientes", tags=["Clientes"])

MostradorUser = Annotated[
    Usuario,
    Depends(require_roles(RolUsuario.administrador, RolUsuario.recepcion)),
]


@router.get(
    "",
    response_model=list[ClienteResponse],
    summary="Listar clientes",
)
def listar_clientes(
    db: DbSession,
    _: CurrentUser,
    q: str | None = Query(default=None),
) -> list[ClienteResponse]:
    return service.list_clientes(db, q=q)


@router.post(
    "",
    response_model=ClienteResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Crear cliente",
)
def crear_cliente(
    data: ClienteCreate,
    db: DbSession,
    _: MostradorUser,
) -> ClienteResponse:
    return service.create_cliente(db, data)


@router.get(
    "/{cliente_id}",
    response_model=ClienteResponse,
    summary="Obtener cliente por id",
)
def obtener_cliente(
    cliente_id: int,
    db: DbSession,
    _: CurrentUser,
) -> ClienteResponse:
    return service.get_cliente(db, cliente_id)


@router.put(
    "/{cliente_id}",
    response_model=ClienteResponse,
    summary="Actualizar cliente",
)
def actualizar_cliente(
    cliente_id: int,
    data: ClienteUpdate,
    db: DbSession,
    _: MostradorUser,
) -> ClienteResponse:
    return service.update_cliente(db, cliente_id, data)


@router.delete(
    "/{cliente_id}",
    response_model=MessageResponse,
    summary="Eliminar cliente",
)
def eliminar_cliente(
    cliente_id: int,
    db: DbSession,
    _: MostradorUser,
) -> MessageResponse:
    service.delete_cliente(db, cliente_id)
    return MessageResponse(detail="Cliente eliminado")
