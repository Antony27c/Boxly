from collections.abc import Iterator
from contextlib import contextmanager

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.api.v1.suscripcion.service import personal_activo
from app.api.v1.users import repository
from app.core.config import get_settings
from app.core.errores import LIMITE_PERSONAL, ErrorConCodigo
from app.core.security import (
    create_access_token,
    decode_invitation_token,
    hash_password,
    verify_password,
)
from app.core.suscripcion import reservar_cupo
from app.db.session import CLAVE_TALLER
from app.models import Plan, Taller
from app.models.cliente import Cliente
from app.models.usuario import ROLES_PERSONAL, RolUsuario, Usuario
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

# El superadmin es de la plataforma: nadie del taller puede crearlo ni asignarlo
# (docs/Plataforma.md, P1).
_MSG_SIN_SUPERADMIN = "No se puede crear ni asignar el rol superadmin"


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


def _exigir_sin_superadmin(rol: RolUsuario | None) -> None:
    if rol == RolUsuario.superadmin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=_MSG_SIN_SUPERADMIN,
        )


def _exigir_cupo_personal(db: Session, taller_id: int | None) -> None:
    """Límite de personal del plan del taller (docs/Suscripciones.md, S1):
    crear o reactivar personal por encima de ``max_personal`` → 409.
    Las cuentas de cliente no cuentan y ``max_personal`` null no limita."""
    if taller_id is None:
        return
    taller = db.get(Taller, taller_id)
    plan = db.get(Plan, taller.plan_codigo) if taller is not None else None
    if plan is None or plan.max_personal is None:
        return
    if personal_activo(db, taller_id) >= plan.max_personal:
        raise ErrorConCodigo(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Tu plan permite hasta {plan.max_personal} usuarios del personal. "
                "Pasá a un plan mayor para sumar más."
            ),
            codigo=LIMITE_PERSONAL,
        )


@contextmanager
def _cupo_reservado(db: Session, taller_id: int | None) -> Iterator[None]:
    """Reserva el cupo de personal del taller hasta el commit (ver
    ``reservar_cupo``). Hay que envolver el conteo Y el commit
    (repository.create/update commitean)."""
    if taller_id is not None:
        reservar_cupo(db, taller_id)
    yield


def _validar_no_ultimo_admin(db: Session, user: Usuario, payload: dict) -> None:
    """No se puede dejar el taller sin administrador activo: ni desactivándolo
    ni cambiándole el rol (docs/Plataforma.md, P1). El filtro de taller ya
    limita el conteo a los administradores del taller del actor."""
    if user.rol != RolUsuario.administrador or not user.activo:
        return
    pierde_admin = payload.get("activo") is False or (
        payload.get("rol") is not None and payload["rol"] != RolUsuario.administrador
    )
    if pierde_admin and repository.contar_administradores_activos(db) <= 1:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Tiene que quedar al menos un administrador activo en el taller",
        )


def create_usuario(db: Session, data: UsuarioCreate, actor: Usuario) -> UsuarioResponse:
    _exigir_sin_superadmin(data.rol)
    if repository.email_existe(db, data.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un usuario con ese email",
        )
    cliente_id = _validar_cliente(db, data.rol, data.cliente_id)
    # El hash va afuera del lock: es lo lento del alta.
    password_hash = hash_password(data.password)
    ocupa_cupo = data.rol in ROLES_PERSONAL
    taller_id = db.info.get(CLAVE_TALLER)
    with _cupo_reservado(db, taller_id if ocupa_cupo else None):
        if ocupa_cupo:
            _exigir_cupo_personal(db, taller_id)
        user = repository.create(
            db,
            nombre=data.nombre,
            apellido=data.apellido,
            email=data.email,
            password_hash=password_hash,
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


def update_usuario(
    db: Session, user_id: int, data: UsuarioUpdate, actor: Usuario
) -> UsuarioResponse:
    user = repository.get_by_id(db, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado",
        )

    payload = data.model_dump(exclude_unset=True)

    if payload.get("activo") is False and actor.id == user.id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No podés desactivar tu propio usuario",
        )

    _exigir_sin_superadmin(payload.get("rol"))
    _validar_no_ultimo_admin(db, user, payload)

    # Reactivar personal (o pasar a un rol del personal estando activo) ocupa
    # un lugar del plan: si ya contaba, no gasta cupo nuevo.
    rol_nuevo = payload.get("rol") or user.rol
    activo_nuevo = payload.get("activo", user.activo)
    ya_contaba = user.rol in ROLES_PERSONAL and user.activo
    ocupa_cupo = rol_nuevo in ROLES_PERSONAL and activo_nuevo and not ya_contaba

    if "email" in payload:
        email = payload["email"].lower().strip()
        if repository.email_existe(db, email, excluir_id=user.id):
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

    # El cupo se controla al final, con el lock tomado hasta el commit.
    with _cupo_reservado(db, user.taller_id if ocupa_cupo else None):
        if ocupa_cupo:
            _exigir_cupo_personal(db, user.taller_id)
        updated = repository.update(db, user, payload)
    return _to_response(updated)


def delete_usuario(db: Session, user_id: int, actor: Usuario) -> UsuarioResponse:
    user = repository.get_by_id(db, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado",
        )
    if actor.id == user.id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No podés desactivar tu propio usuario",
        )
    _validar_no_ultimo_admin(db, user, {"activo": False})
    return _to_response(repository.soft_delete(db, user))

def list_mecanicos(db: Session) -> list[MecanicoResponse]:
    users= repository.list_usuarios(db, solo_activos=True, rol=RolUsuario.mecanico)
    return [MecanicoResponse.model_validate(u) for u in users]