from collections.abc import Callable, Generator
from datetime import datetime, timezone
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.core.suscripcion import AL_DIA, GRACIA, SUSPENDIDA, estado_suscripcion, ruta_libre
from app.db.session import SIN_FILTRO_TALLER, SessionLocal, fijar_taller
from app.models.taller import AccesoSoporte, Taller
from app.models.usuario import ROLES_PERSONAL, RolUsuario, Usuario

bearer_scheme = HTTPBearer(auto_error=True)

# Métodos permitidos en modo soporte: el superadmin solo LEE el taller.
_METODOS_SOPORTE = {"GET", "HEAD", "OPTIONS"}


def get_db() -> Generator[Session, None, None]:
    """Dependencia de sesión DB. Pablo puede ajustar el engine en app.db.session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


DbSession = Annotated[Session, Depends(get_db)]


def _a_utc(fecha: datetime) -> datetime:
    """Naive (SQLite) se asume UTC; aware se convierte a UTC."""
    if fecha.tzinfo is None:
        return fecha.replace(tzinfo=timezone.utc)
    return fecha.astimezone(timezone.utc)


def _acceso_vigente(db: Session, taller_id: int) -> bool:
    """¿El taller tiene un AccesoSoporte vigente para el superadmin?

    Se consulta sin filtro de taller porque la sesión todavía no tiene contexto
    (y aunque lo tuviera, el acceso a validar es justamente el que habilita el
    cambio de contexto).
    """
    ahora = datetime.now(timezone.utc)
    stmt = select(AccesoSoporte).where(
        AccesoSoporte.taller_id == taller_id,
        AccesoSoporte.revocado_en.is_(None),
    ).execution_options(**{SIN_FILTRO_TALLER: True})
    for acceso in db.scalars(stmt).all():
        if _a_utc(acceso.desde) <= ahora < _a_utc(acceso.hasta):
            return True
    return False


def _taller_soporte(request: Request, db: Session, user: Usuario) -> int | None:
    """Valida el modo soporte y devuelve el taller_id autorizado.

    Solo aplica al superadmin con header ``X-Taller-Soporte: <id>``; para
    cualquier otro usuario el header se ignora por completo (no cambia de
    taller ni dispara enmascarado). Sin acceso vigente o método de escritura:
    403 del contrato (docs/Plataforma.md, P2).
    """
    if user.rol != RolUsuario.superadmin:
        return None
    header = request.headers.get("x-taller-soporte")
    if not header:
        return None
    try:
        taller_id = int(header.strip())
    except ValueError:
        taller_id = -1
    if not _acceso_vigente(db, taller_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="El taller no te dio acceso de soporte",
        )
    if request.method not in _METODOS_SOPORTE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="El modo soporte es de solo lectura",
        )
    return taller_id


def get_current_user(
    db: DbSession,
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer_scheme)],
    request: Request,
) -> Usuario:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudo validar las credenciales",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(credentials.credentials)
        user_id = payload.get("sub")
        if user_id is None:
            raise credentials_exception
        uid = int(user_id)
        # Token sin "tv" se trata como versión 0.
        token_version = payload.get("tv") or 0
    except (ValueError, TypeError):
        raise credentials_exception from None

    user = db.get(Usuario, uid)
    if user is None or not user.activo or user.token_version != token_version:
        raise credentials_exception
    if user.taller_id is not None:
        taller = db.get(Taller, user.taller_id)
        if taller is None or not taller.activo:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="El taller está suspendido. Comunicate con Boxly.",
            )
        _verificar_suscripcion(request, user, taller)
    # Modo soporte: el superadmin opera DENTRO del taller que le dio acceso
    # (solo lectura). Marca la request para auditoría y enmascarado.
    taller_soporte = _taller_soporte(request, db, user)
    if taller_soporte is not None:
        fijar_taller(db, taller_soporte)
        request.state.soporte = True
        return user
    # Desde acá cada consulta de la request queda limitada al taller del usuario
    # (None = plataforma: el superadmin no ve datos de ningún taller).
    fijar_taller(db, user.taller_id)
    return user


_METODOS_LECTURA = {"GET", "HEAD", "OPTIONS"}


def _verificar_suscripcion(request: Request, user: Usuario, taller: Taller) -> None:
    """Corta según el estado de pago de la suscripción (docs/Suscripciones.md
    y docs/Oferta.md).

    solo_lectura: nadie del taller escribe. suspendida: solo el administrador, y
    solo para pagar. Las rutas de suscripción, login y términos quedan libres.
    """
    # Login, /auth/me y logout andan siempre: si no, el frontend desloguea al
    # personal del taller suspendido en cada recarga.
    if request.url.path.startswith("/api/v1/auth"):
        return
    estado = estado_suscripcion(
        taller.suscripcion_vence_en, tipo_acceso=taller.tipo_acceso
    )
    if estado in (AL_DIA, GRACIA) or ruta_libre(request.url.path):
        if estado == SUSPENDIDA and user.rol != RolUsuario.administrador:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="La suscripción del taller está vencida",
            )
        return
    if estado == SUSPENDIDA:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="La suscripción del taller está vencida",
        )
    if request.method not in _METODOS_LECTURA:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="El taller está en solo lectura por falta de pago de la suscripción",
        )


CurrentUser = Annotated[Usuario, Depends(get_current_user)]


def require_roles(*roles: RolUsuario) -> Callable[..., Usuario]:
    allowed = set(roles)

    def _checker(current_user: CurrentUser, request: Request) -> Usuario:
        # El superadmin NO pasa los controles del taller: opera la plataforma y no
        # ve datos de clientes salvo con acceso de soporte (docs/Plataforma.md).
        # En modo soporte la request "es" un administrador del taller.
        efectivo = (
            RolUsuario.administrador
            if getattr(request.state, "soporte", False)
            else current_user.rol
        )
        if efectivo not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tenés permisos para esta acción",
            )
        return current_user

    return _checker


PersonalUser = Annotated[Usuario, Depends(require_roles(*ROLES_PERSONAL))]
SuperAdminUser = Annotated[Usuario, Depends(require_roles(RolUsuario.superadmin))]
ClienteUser = Annotated[Usuario, Depends(require_roles(RolUsuario.cliente))]


def filtro_mecanico(usuario: Usuario) -> int | None:
    return usuario.id if usuario.rol == RolUsuario.mecanico else None
