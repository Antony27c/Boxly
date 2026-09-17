from collections.abc import Callable, Generator
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.session import SessionLocal
from app.models.usuario import RolUsuario, Usuario

bearer_scheme = HTTPBearer(auto_error=True)


def get_db() -> Generator[Session, None, None]:
    """Dependencia de sesión DB. Pablo puede ajustar el engine en app.db.session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


DbSession = Annotated[Session, Depends(get_db)]


def get_current_user(
    db: DbSession,
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer_scheme)],
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
    except (ValueError, TypeError):
        raise credentials_exception from None

    user = db.get(Usuario, uid)
    if user is None or not user.activo:
        raise credentials_exception
    return user


CurrentUser = Annotated[Usuario, Depends(get_current_user)]


def require_roles(*roles: RolUsuario) -> Callable[..., Usuario]:
    allowed = set(roles)

    def _checker(current_user: CurrentUser) -> Usuario:
        if current_user.rol not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tenés permisos para esta acción",
            )
        return current_user

    return _checker
