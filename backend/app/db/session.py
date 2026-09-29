"""Sesión SQLAlchemy.

BE-02 (Pablo): ajustar engine, pool y URL de PostgreSQL según el entorno real.
Esta capa mínima permite que el módulo de autenticación (Antonio) funcione
cuando la base esté disponible.
"""

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings

settings = get_settings()

_connect_args: dict = {}
_engine_kwargs: dict = {"pool_pre_ping": True}
if settings.database_url.startswith("sqlite"):
    # Necesario para FastAPI + SQLite en el mismo hilo de request.
    _connect_args = {"check_same_thread": False}
    _engine_kwargs = {}

engine = create_engine(
    settings.database_url,
    connect_args=_connect_args,
    **_engine_kwargs,
)

SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
    class_=Session,
)


def get_session() -> Generator[Session, None, None]:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
