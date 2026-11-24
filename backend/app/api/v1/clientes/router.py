from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Response, status

from app.api.v1.clientes import service
from app.core.dependencies import DbSession, PersonalUser, filtro_mecanico, require_roles
from app.models.usuario import RolUsuario, Usuario
from app.schemas.cliente import ClienteCreate, ClienteResponse, ClienteUpdate
from app.schemas.usuario import MessageResponse

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
    usuario: PersonalUser,
    response: Response,
    q: str | None = Query(default=None),
    limit: int | None = Query(default=None, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> list[ClienteResponse]:
    clientes, total = service.list_clientes(
        db,
        q=q,
        mecanico_id=filtro_mecanico(usuario),
        limit=limit,
        offset=offset,
    )
    response.headers["X-Total-Count"] = str(total)
    return clientes


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
    background_tasks: BackgroundTasks,
) -> ClienteResponse:
    cliente = service.create_cliente(db, data)
    if cliente.email and not cliente.tiene_cuenta:
        background_tasks.add_task(service.invitar_en_segundo_plano, cliente.id)
    return cliente


@router.post(
    "/{cliente_id}/invitacion",
    response_model=MessageResponse,
    summary="Invitar al cliente al portal",
)
def invitar_cliente(
    cliente_id: int,
    db: DbSession,
    _: MostradorUser,
) -> MessageResponse:
    """Manda (o reenvía) el correo para que el cliente confirme sus datos y cree su contraseña."""
    return service.invitar_al_portal(db, cliente_id)


@router.get(
    "/{cliente_id}",
    response_model=ClienteResponse,
    summary="Obtener cliente por id",
)
def obtener_cliente(
    cliente_id: int,
    db: DbSession,
    usuario: PersonalUser,
) -> ClienteResponse:
    return service.get_cliente(db, cliente_id, mecanico_id=filtro_mecanico(usuario))


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
