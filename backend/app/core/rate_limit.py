"""Rate limiting de la API con slowapi.

Activo por defecto; se desactiva con la variable de entorno RATE_LIMIT_ENABLED=false.

El limiter nace deshabilitado y lo enciende configurar_rate_limit() (que invoca
create_app en main.py): así la app real limita por defecto y los tests que no lo
activan explícitamente no comparten los contadores.
"""

import os

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address


def _rate_limit_habilitado() -> bool:
    return os.getenv("RATE_LIMIT_ENABLED", "true").strip().lower() != "false"


# Nace apagado: lo activa configurar_rate_limit() según la variable de entorno.
limiter = Limiter(key_func=get_remote_address, enabled=False)


async def _handler_429(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        content={"detail": "Demasiados intentos. Probá de nuevo en un minuto."},
    )


def configurar_rate_limit(app: FastAPI) -> None:
    """Registra el limiter en la app y el handler de 429.

    Los límites por ruta se declaran con @limiter.limit(...) en los routers.
    """
    limiter.enabled = _rate_limit_habilitado()
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _handler_429)
