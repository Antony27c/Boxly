from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.api.v1.users import repository
from app.core.config import get_settings
from app.core.security import (
    create_access_token,
    decode_invitation_token,
    hash_password,
    verify_password,
)
from app.models.cliente import Cliente
from app.models.usuario import RolUsuario, Usuario
from app.schemas.paginacion import ParametrosPagina
from app.schemas.usuario import (
    ActivacionInfo,
    ActivacionRequest,
    LoginRequest,
    MecanicoResponse,
    TokenResponse,
    UsuarioCreate,
    UsuarioResponse,
    UsuarioUpdate,
)

# Hash bcrypt de una contraseña cualquiera: cuando el email no existe se verifica
# contra este para que la respuesta tarde lo mismo y no se pueda enumerar usuarios.
_HASH_DUMMY = "$2b$12$D5nmqropdACIU8iLQjEjGewyaEd1qk.04sX1PfmTKXgcR0AwcpDzC"


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


def crear_cuenta_con_dni(db: Session, cliente: Cliente) -> Usuario | None:
    """SOLO DEMO: cuenta del cliente con su DNI/CUIT como contraseña (ver cliente_password_dni)."""
    if not cliente.email:
        return None
    if repository.get_by_cliente_id(db, cliente.id) or repository.get_by_email(db, cliente.email):
        return None
    return repository.create(
        db,
        nombre=cliente.nombre,
        apellido=cliente.apellido,
        email=cliente.email,
        password_hash=hash_password(cliente.dni.strip()),
        rol=RolUsuario.cliente,
        cliente_id=cliente.id,
    )


def authenticate(db: Session, data: LoginRequest) -> TokenResponse:
    user = repository.get_by_email(db, data.email)
    if user is None and get_settings().cliente_password_dni:
        # Cliente que todavía no tiene cuenta: la primera vez entra con su correo y su DNI.
        cliente = repository.get_cliente_by_email(db, data.email)
        if cliente is not None and data.password == cliente.dni.strip():
            user = crear_cuenta_con_dni(db, cliente)
    # verify_password corre siempre (contra el hash real o el dummy): si el email
    # no existe la demora es la misma y no se puede saber qué correos están dados
    # de alta. El error es idéntico en ambos casos.
    hash_a_verificar = user.password_hash if user is not None else _HASH_DUMMY
    password_ok = verify_password(data.password, hash_a_verificar)
    if user is None or not password_ok:
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
        token_version=user.token_version,
    )
    return TokenResponse(access_token=token, usuario=_to_response(user))


def _cliente_de_invitacion(db: Session, token: str) -> Cliente:
    enlace_invalido = HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="El enlace venció o no es válido. Pedile al taller que te envíe otra invitación.",
    )
    try:
        payload = decode_invitation_token(token)
        cliente = db.get(Cliente, int(payload["sub"]))
    except (ValueError, KeyError):
        raise enlace_invalido from None
    # El correo del enlace tiene que seguir siendo el del cliente (si el taller lo cambió, vale el nuevo).
    if cliente is None or not cliente.email or cliente.email.lower() != payload.get("email"):
        raise enlace_invalido
    if repository.get_by_cliente_id(db, cliente.id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Esta cuenta ya fue activada. Iniciá sesión con tu correo y contraseña.",
        )
    if repository.get_by_email(db, cliente.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ese correo ya está en uso por otra cuenta. Contactá al taller.",
        )
    return cliente


def info_activacion(db: Session, token: str) -> ActivacionInfo:
    cliente = _cliente_de_invitacion(db, token)
    return ActivacionInfo(
        nombre=cliente.nombre,
        apellido=cliente.apellido,
        email=cliente.email,
        dni=f"{'•' * max(len(cliente.dni) - 3, 0)}{cliente.dni[-3:]}",
    )


def activar_cuenta(db: Session, data: ActivacionRequest) -> TokenResponse:
    """El cliente confirma sus datos, elige su contraseña y queda con la sesión iniciada."""
    if not data.confirmo_datos:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Tenés que confirmar que tus datos son correctos.",
        )
    cliente = _cliente_de_invitacion(db, data.token)
    user = repository.create(
        db,
        nombre=cliente.nombre,
        apellido=cliente.apellido,
        email=cliente.email,
        password_hash=hash_password(data.password),
        rol=RolUsuario.cliente,
        cliente_id=cliente.id,
    )
    token = create_access_token(
        subject=user.id,
        extra_claims={"rol": user.rol.value, "email": user.email},
        token_version=user.token_version,
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
    pagina: ParametrosPagina | None = None,
) -> tuple[list[UsuarioResponse], int]:
    users = repository.list_usuarios(
        db, solo_activos=solo_activos, rol=rol, pagina=pagina
    )
    total = repository.contar_usuarios(db, solo_activos=solo_activos, rol=rol)
    return [_to_response(u) for u in users], total


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
        # Invalida los tokens emitidos antes del cambio de contraseña.
        payload["token_version"] = user.token_version + 1

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