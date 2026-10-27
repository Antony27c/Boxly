from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.api.v1.users import repository
from app.core.security import create_access_token, hash_password, verify_password
from app.models.cliente import Cliente
from app.models.usuario import RolUsuario, Usuario
from app.schemas.usuario import (
    LoginRequest,
    MecanicoResponse,
    TokenResponse,
    UsuarioCreate,
    UsuarioResponse,
    UsuarioUpdate,
)


def _to_response(user: Usuario) -> UsuarioResponse:
    return UsuarioResponse.model_validate(user)


def _validar_cliente(
    db: Session,
    rol: RolUsuario,
    cliente_id: int | None,
    user_id: int | None = None,
) -> int | None:
    if rol != RolUsuario.cliente:
        if cliente_id is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Solo los usuarios con rol cliente se vinculan a un cliente",
            )
        return None
    if cliente_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Un usuario con rol cliente necesita el cliente_id",
        )
    if db.get(Cliente, cliente_id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cliente no encontrado",
        )
    existente = repository.get_by_cliente_id(db, cliente_id)
    if existente and existente.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ese cliente ya tiene un usuario de acceso",
        )
    return cliente_id


def authenticate(db: Session, data: LoginRequest) -> TokenResponse:
    user = repository.get_by_email(db, data.email)
    if user is None or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.activo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario deshabilitado",
        )
    token = create_access_token(
        subject=user.id,
        extra_claims={"rol": user.rol.value, "email": user.email},
    )
    return TokenResponse(access_token=token, usuario=_to_response(user))


def create_usuario(db: Session, data: UsuarioCreate) -> UsuarioResponse:
    if repository.get_by_email(db, data.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un usuario con ese email",
        )
    cliente_id = _validar_cliente(db, data.rol, data.cliente_id)
    user = repository.create(
        db,
        nombre=data.nombre,
        apellido=data.apellido,
        email=data.email,
        password_hash=hash_password(data.password),
        rol=data.rol,
        cliente_id=cliente_id,
    )
    return _to_response(user)


def list_usuarios(
    db: Session,
    *,
    solo_activos: bool | None = None,
    rol: RolUsuario | None = None,
) -> list[UsuarioResponse]:
    users = repository.list_usuarios(db, solo_activos=solo_activos, rol=rol)
    return [_to_response(u) for u in users]


def get_usuario(db: Session, user_id: int) -> UsuarioResponse:
    user = repository.get_by_id(db, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado",
        )
    return _to_response(user)


def update_usuario(db: Session, user_id: int, data: UsuarioUpdate) -> UsuarioResponse:
    user = repository.get_by_id(db, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado",
        )

    payload = data.model_dump(exclude_unset=True)
    if "email" in payload:
        email = payload["email"].lower().strip()
        existing = repository.get_by_email(db, email)
        if existing and existing.id != user.id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ya existe un usuario con ese email",
            )
        payload["email"] = email

    if "rol" in payload or "cliente_id" in payload:
        rol = payload.get("rol") or user.rol
        actual = user.cliente_id if rol == RolUsuario.cliente else None
        payload["cliente_id"] = _validar_cliente(
            db, rol, payload.get("cliente_id", actual), user.id
        )

    if "password" in payload:
        payload["password_hash"] = hash_password(payload.pop("password"))

    if "nombre" in payload and isinstance(payload["nombre"], str):
        payload["nombre"] = payload["nombre"].strip()
    if "apellido" in payload and isinstance(payload["apellido"], str):
        payload["apellido"] = payload["apellido"].strip()

    updated = repository.update(db, user, payload)
    return _to_response(updated)


def delete_usuario(db: Session, user_id: int) -> UsuarioResponse:
    user = repository.get_by_id(db, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado",
        )
    return _to_response(repository.soft_delete(db, user))

def list_mecanicos(db: Session) -> list[MecanicoResponse]:
    users= repository.list_usuarios(db, solo_activos=True, rol=RolUsuario.mecanico)
    return [MecanicoResponse.model_validate(u) for u in users]