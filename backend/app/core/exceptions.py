import logging

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(
        _request: Request, exc: StarletteHTTPException
    ) -> JSONResponse:
        detail = exc.detail
        if not isinstance(detail, str):
            detail = str(detail)
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": detail, "code": exc.status_code},
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        _request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        errors = []
        for err in exc.errors():
            loc = " -> ".join(str(part) for part in err.get("loc", ()))
            errors.append({"campo": loc, "mensaje": err.get("msg")})
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "detail": "Error de validación",
                "code": 422,
                "errores": errors,
            },
        )

    @app.exception_handler(IntegrityError)
    async def integrity_error_handler(
        request: Request, _exc: IntegrityError
    ) -> JSONResponse:
        # La sesión de la request la cierra get_db al propagarse la excepción
        # (Session.close() revierte la transacción pendiente). Si algún
        # endpoint dejara su propia sesión en request.state.db, se revierte acá.
        session = getattr(request.state, "db", None)
        if session is not None:
            session.rollback()
        # No se devuelve el error de SQLAlchemy: puede incluir la consulta SQL
        # y los valores que la originaron.
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={
                "detail": (
                    "El registro entra en conflicto con datos existentes "
                    "(duplicado o referencia inválida)"
                ),
                "code": status.HTTP_409_CONFLICT,
            },
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(
        request: Request, _exc: Exception
    ) -> JSONResponse:
        logger.exception(
            "Error no controlado en %s %s", request.method, request.url.path
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "detail": "Error interno del servidor",
                "code": 500,
            },
        )
