from fastapi import APIRouter

from app.api.v1.users import service
from app.core.dependencies import CurrentUser, DbSession
from app.models.usuario import Usuario
from app.schemas.usuario import (
    ActivacionInfo,
    ActivacionRequest,
    LoginRequest,
    TokenResponse,
    UsuarioResponse,
)

router = APIRouter(prefix="/auth", tags=["Autenticación"])


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Iniciar sesión",
)
def login(data: LoginRequest, db: DbSession) -> TokenResponse:
    """Autentica con email y contraseña. Devuelve JWT + datos del usuario."""
    return service.authenticate(db, data)


@router.get(
    "/me",
    response_model=UsuarioResponse,
    summary="Usuario autenticado",
)
def me(current_user: CurrentUser) -> Usuario:
    return current_user


@router.get(
    "/activacion",
    response_model=ActivacionInfo,
    summary="Datos del cliente invitado",
)
def info_activacion(token: str, db: DbSession) -> ActivacionInfo:
    """Con el enlace del correo: devuelve los datos que el cliente tiene que confirmar."""
    return service.info_activacion(db, token)


@router.post(
    "/activacion",
    response_model=TokenResponse,
    status_code=201,
    summary="Activar la cuenta del cliente",
)
def activar_cuenta(data: ActivacionRequest, db: DbSession) -> TokenResponse:
    """El cliente confirma sus datos y crea su contraseña. Devuelve la sesión iniciada."""
    return service.activar_cuenta(db, data)
