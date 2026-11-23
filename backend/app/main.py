import logging

from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

# Importar modelos para que Base.metadata los registre.
import app.models  # noqa: F401
from app.api.v1.router import api_router
from app.core.auditoria import AuditoriaMiddleware
from app.core.enmascarado import EnmascaradoSoporteMiddleware
from app.core.config import UPLOADS_DIR, get_settings
from app.core.exceptions import register_exception_handlers
from app.core.logging_config import configurar_logging
from app.core.rate_limit import configurar_rate_limit
from app.db.session import SessionLocal

logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    configurar_logging()
    settings = get_settings()
    # En producción no se exponen /docs, /redoc ni /openapi.json.
    docs = None if settings.es_produccion else "/docs"
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description=(
            "API de Boxly — Sistema de Gestión de Taller Mecánico. "
            "Autenticación JWT, roles, clientes, vehículos, turnos, órdenes y repuestos."
        ),
        docs_url=docs,
        redoc_url=None if settings.es_produccion else "/redoc",
        openapi_url=None if settings.es_produccion else "/openapi.json",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        # La paginación devuelve el total en este header; hay que exponerlo
        # para que el frontend pueda leerlo desde el navegador. Content-Disposition
        # trae el nombre de los archivos que se descargan (respaldo y auditoría).
        expose_headers=["X-Total-Count", "Content-Disposition"],
    )

    # Registra cada POST/PUT/PATCH/DELETE de /api/v1 en la tabla auditoria.
    app.add_middleware(AuditoriaMiddleware)
    # En modo soporte (header X-Taller-Soporte) enmascara DNI, teléfonos y emails.
    app.add_middleware(EnmascaradoSoporteMiddleware)

    register_exception_handlers(app)
    configurar_rate_limit(app)
    app.include_router(api_router)
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")

    @app.get("/", tags=["Health"])
    def health():
        return {
            "mensaje": "Bienvenido a la API de Boxly",
            "version": settings.app_version,
            "docs": docs,
        }

    @app.get("/health", include_in_schema=False, tags=["Health"])
    def health_check():
        """Health check para monitoreo: 200 si la DB responde, 503 si no."""
        try:
            with SessionLocal() as session:
                session.execute(text("SELECT 1"))
        except Exception:
            logger.exception("Health check: la base de datos no responde")
            return JSONResponse(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                content={"estado": "degradado", "db": "error"},
            )
        return {"estado": "ok", "db": "ok", "version": settings.app_version}

    return app


app = create_app()
