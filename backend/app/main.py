from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.exceptions import register_exception_handlers

# Importar modelos para que Base.metadata los registre (Usuario).
# Cliente / Vehículo / etc. los agregará Pablo en BE-03.
import app.models  # noqa: F401


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description=(
            "API de Boxly — Sistema de Gestión de Taller Mecánico. "
            "Autenticación JWT, roles, clientes, vehículos, turnos, órdenes y repuestos."
        ),
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_exception_handlers(app)
    app.include_router(api_router)

    @app.get("/", tags=["Health"])
    def health():
        return {
            "mensaje": "Bienvenido a la API de Boxly",
            "version": settings.app_version,
            "docs": "/docs",
        }

    return app


app = create_app()
