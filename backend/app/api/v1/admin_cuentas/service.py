import secrets
import string

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.api.v1.users import repository
from app.core.security import hash_password
from app.models.usuario import Usuario
from app.schemas.admin_cuentas import PasswordTemporalResponse, SesionesResponse

_LONGITUD_PASSWORD = 12


def _password_temporal() -> str:
    """12 caracteres con al menos una letra y un número (contrato B1)."""
    caracteres = [
        secrets.choice(string.ascii_letters),
        secrets.choice(string.digits),
        *(
            secrets.choice(string.ascii_letters + string.digits)
            for _ in range(_LONGITUD_PASSWORD - 2)
        ),
    ]
    secrets.SystemRandom().shuffle(caracteres)
    return "".join(caracteres)


def _usuario_o_404(db: Session, user_id: int) -> Usuario:
    user = repository.get_by_id(db, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado",
        )
    return user


def restablecer_password(db: Session, user_id: int) -> PasswordTemporalResponse:
    """Nueva contraseña temporal y token_version +1: cierra las sesiones abiertas."""
    user = _usuario_o_404(db, user_id)
    temporal = _password_temporal()
    repository.update(
        db,
        user,
        {
            "password_hash": hash_password(temporal),
            "token_version": user.token_version + 1,
        },
    )
    return PasswordTemporalResponse(password_temporal=temporal)


def cerrar_sesiones(db: Session, user_id: int) -> SesionesResponse:
    """Solo sube token_version: los JWT emitidos antes quedan inválidos."""
    user = _usuario_o_404(db, user_id)
    repository.update(db, user, {"token_version": user.token_version + 1})
    return SesionesResponse(detail=f"Se cerraron las sesiones de {user.email}")
