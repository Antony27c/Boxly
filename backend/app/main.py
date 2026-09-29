from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.exceptions import register_exception_handlers
from app.db.base import Base
from app.db.session import engine

# Importar modelos para que Base.metadata los registre (Usuario).
# Cliente / Vehículo / etc. los agregará Pablo en BE-03.
import app.models  # noqa: F401


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Temporal hasta que Pablo configure Alembic (BD-02).
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as exc:  # noqa: BLE001 — arranque tolerante si la DB aún no está
        print(
            f"[Boxly] Aviso: no se pudo crear/verificar tablas "
            f"(¿PostgreSQL levantado?). Detalle: {exc}"
        )
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description=(
            "API de Boxly — Sistema de Gestión de Taller Mecánico. "
            "Sprint 1: autenticación JWT, roles y CRUD de usuarios."
        ),
        lifespan=lifespan,
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
