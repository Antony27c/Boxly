from typing import Annotated

from fastapi import APIRouter, Depends, status

from app.api.v1.clientes import service
from app.core.dependencies import CurrentUser, DbSession, require_roles
from app.models.usuario import RolUsuario, Usuario
from app.schemas.cliente import ClienteCreate, ClienteResponse, ClienteUpdate
from app.schemas.usuario import MessageResponse

router = APIRouter(prefix="/clientes", tags=["Clientes"])

Mostrador = Annotated[
    Usuario,
    Depends(require_roles(RolUsuario.administrador, RolUsuario.recepcion)),
]


@router.get("", response_model=list[ClienteResponse], summary="Listar clientes")
def listar_clientes(db: DbSession, _: CurrentUser):
    return service.listar(db)


@router.get("/{cliente_id}", response_model=ClienteResponse, summary="Obtener cliente")
def obtener_cliente(cliente_id: int, db: DbSession, _: CurrentUser):
    return service.obtener(db, cliente_id)


@router.post(
    "",
    response_model=ClienteResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Crear cliente",
)
def crear_cliente(data: ClienteCreate, db: DbSession, _: Mostrador):
    return service.crear(db, data)


@router.put("/{cliente_id}", response_model=ClienteResponse, summary="Actualizar cliente")
def actualizar_cliente(cliente_id: int, data: ClienteUpdate, db: DbSession, _: Mostrador):
    return service.actualizar(db, cliente_id, data)


@router.delete("/{cliente_id}", response_model=MessageResponse, summary="Eliminar cliente")
def eliminar_cliente(cliente_id: int, db: DbSession, _: Mostrador):
    service.eliminar(db, cliente_id)
    return MessageResponse(detail="Cliente eliminado")
