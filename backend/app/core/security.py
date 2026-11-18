from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
import jwt
from jwt.exceptions import PyJWTError

from app.core.config import get_settings

# bcrypt solo usa los primeros 72 bytes de la contraseña (la librería
# anterior truncaba igual): se recorta acá para que hash y verify se
# comporten de forma pareja.
_MAX_PASSWORD_BYTES = 72


def _a_bytes(texto: str) -> bytes:
    return texto.encode("utf-8")[:_MAX_PASSWORD_BYTES]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(_a_bytes(password), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(
            _a_bytes(plain_password), password_hash.encode("utf-8")
        )
    except (TypeError, ValueError):
        return False


def create_access_token(
    subject: str | int,
    extra_claims: dict[str, Any] | None = None,
    expires_minutes: int | None = None,
    token_version: int = 0,
) -> str:
    settings = get_settings()
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=expires_minutes or settings.access_token_expire_minutes
    )
    payload: dict[str, Any] = {"sub": str(subject), "exp": expire}
    if extra_claims:
        payload.update(extra_claims)
    # "tv" = token_version del usuario: dependencies.py lo compara con la DB y
    # un token viejo (sin "tv" o con otro valor) da 401 al cambiar la contraseña.
    payload["tv"] = token_version
    return jwt.encode(
        payload,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )


def _decode(token: str) -> dict[str, Any]:
    settings = get_settings()
    try:
        return jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
    except PyJWTError as exc:
        raise ValueError("Token inválido o expirado") from exc


def decode_access_token(token: str) -> dict[str, Any]:
    payload = _decode(token)
    # Los tokens con propósito (invitaciones) no sirven para iniciar sesión: su "sub" es
    # un id de cliente y se confundiría con un id de usuario.
    if "proposito" in payload:
        raise ValueError("Token inválido o expirado")
    return payload


PROPOSITO_ACTIVACION = "activar_cuenta"
INVITACION_HORAS = 72


def create_invitation_token(cliente_id: int, email: str) -> str:
    """Enlace de un solo propósito: permite al cliente activar su cuenta del portal."""
    settings = get_settings()
    payload = {
        "sub": str(cliente_id),
        "email": email.lower(),
        "proposito": PROPOSITO_ACTIVACION,
        "exp": datetime.now(timezone.utc) + timedelta(hours=INVITACION_HORAS),
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_invitation_token(token: str) -> dict[str, Any]:
    payload = _decode(token)
    if payload.get("proposito") != PROPOSITO_ACTIVACION:
        raise ValueError("Token inválido o expirado")
    return payload
