"""Errores de API con un código estable para el frontend (tarea Q4).

Antes el frontend reconocía los bloqueos por suscripción y el límite de
personal comparando el texto del ``detail`` con una regex: si alguien
reescribía un mensaje, el aviso dejaba de funcionar sin que nadie se enterara.
Ahora esos errores llevan además un ``codigo`` estable y el frontend puede
leer ``datos.codigo`` del cuerpo JSON.

Formato de la respuesta de error:

    {"detail": "<el texto de siempre>", "codigo": "<codigo_estable>"}

Se implementa con una subclase de ``HTTPException`` y un exception handler
propio, más específico que el genérico de ``app.core.exceptions`` (que sigue
respondiendo igual para el resto de los errores: ``{"detail", "code"}``).
"""
from fastapi import HTTPException
from fastapi.responses import JSONResponse
from starlette.requests import Request

# --- Códigos estables (los consume el frontend, ver docs de Q4) ---------------
SUSCRIPCION_SOLO_LECTURA = "suscripcion_solo_lectura"
SUSCRIPCION_SUSPENDIDA = "suscripcion_suspendida"
LIMITE_PERSONAL = "limite_personal"
PLAN_PERSONAL_EXCEDIDO = "plan_personal_excedido"
TALLER_SUSPENDIDO = "taller_suspendido"
SOPORTE_SIN_ACCESO = "soporte_sin_acceso"
SOPORTE_SOLO_LECTURA = "soporte_solo_lectura"


class ErrorConCodigo(HTTPException):
    """``HTTPException`` que además lleva un ``codigo`` estable en el JSON."""

    def __init__(self, status_code: int, detail: str, codigo: str) -> None:
        super().__init__(status_code=status_code, detail=detail)
        self.codigo = codigo


async def _handler_error_con_codigo(
    _request: Request, exc: ErrorConCodigo
) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "codigo": exc.codigo},
    )


def registrar_manejador_errores(app) -> None:
    """Registra el handler de ``ErrorConCodigo``. Lo llama ``main.py``."""
    app.add_exception_handler(ErrorConCodigo, _handler_error_con_codigo)
