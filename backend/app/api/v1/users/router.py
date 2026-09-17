from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from app.api.v1.users import service
from app.core.dependencies import DbSession, require_roles
from app.models.usuario import RolUsuario, Usuario
from app.schemas.usuario import (
    MessageResponse,
    UsuarioCreate,
    UsuarioResponse,
    UsuarioUpdate,
)

router = APIRouter(prefix="/users", tags=["Usuarios"])

AdminUser = Annotated[
    Usuario,
    Depends(require_roles(RolUsuario.administrador)),
]


@router.get(
    "",
    response_model=list[UsuarioResponse],
    summary="Listar usuarios",
)
def listar_usuarios(
    db: DbSession,
    _: AdminUser,
    solo_activos: bool | None = Query(default=None),
    rol: RolUsuario | None = Query(default=None),
) -> list[UsuarioResponse]:
    return service.list_usuarios(db, solo_activos=solo_activos, rol=rol)


@router.post(
    "",
    response_model=UsuarioResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Crear usuario",
)
def crear_usuario(
    data: UsuarioCreate,
    db: DbSession,
    _: AdminUser,
) -> UsuarioResponse:
    return service.create_usuario(db, data)


@router.get(
    "/{user_id}",
    response_model=UsuarioResponse,
    summary="Obtener usuario por id",
)
def obtener_usuario(
    user_id: int,
    db: DbSession,
    _: AdminUser,
) -> UsuarioResponse:
    return service.get_usuario(db, user_id)


@router.put(
    "/{user_id}",
    response_model=UsuarioResponse,
    summary="Actualizar usuario",
)
def actualizar_usuario(
    user_id: int,
    data: UsuarioUpdate,
    db: DbSession,
    _: AdminUser,
) -> UsuarioResponse:
    return service.update_usuario(db, user_id, data)


@router.delete(
    "/{user_id}",
    response_model=MessageResponse,
    summary="Desactivar usuario (soft delete)",
)
def eliminar_usuario(
    user_id: int,
    db: DbSession,
    _: AdminUser,
) -> MessageResponse:
    user = service.delete_usuario(db, user_id)
    return MessageResponse(detail=f"Usuario {user.email} desactivado")
