from fastapi import APIRouter

from app.api.v1.users import service
from app.core.dependencies import CurrentUser, DbSession
from app.models.usuario import Usuario
from app.schemas.usuario import LoginRequest, TokenResponse, UsuarioResponse

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
