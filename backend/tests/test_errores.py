import logging

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.dependencies import DbSession
from app.core.exceptions import register_exception_handlers
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models import Cliente


@pytest.fixture
def datos():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        db.add(Cliente(nombre="Existente", apellido="Cliente", dni="00000000", email=None))
        db.commit()


def _app_de_prueba() -> FastAPI:
    """App mínima con los mismos handlers que registra create_app en la API real."""
    test_app = FastAPI()
    register_exception_handlers(test_app)

    @test_app.post("/api/v1/__prueba/conflicto")
    def _conflicto(db: DbSession):
        db.add(Cliente(nombre="Duplicado", apellido="Dni", dni="00000000", email=None))
        db.commit()
        return {"ok": True}

    @test_app.get("/api/v1/__prueba/falla")
    def _falla():
        raise RuntimeError("falla de prueba para el handler genérico")

    return test_app


@pytest.fixture
def api():
    with TestClient(_app_de_prueba(), raise_server_exceptions=False) as cliente:
        yield cliente


def test_integrity_error_devuelve_409_sin_sql(api, datos):
    r = api.post("/api/v1/__prueba/conflicto")
    assert r.status_code == 409
    assert r.json()["detail"] == (
        "El registro entra en conflicto con datos existentes "
        "(duplicado o referencia inválida)"
    )
    assert "INSERT" not in r.text and "UNIQUE" not in r.text.upper()


def test_excepcion_no_controlada_devuelve_500_y_queda_logueada(api, caplog):
    with caplog.at_level(logging.ERROR):
        r = api.get("/api/v1/__prueba/falla")
    assert r.status_code == 500
    assert r.json()["detail"] == "Error interno del servidor"
    assert "falla de prueba" not in r.text
    assert any(
        rec.exc_info and "falla de prueba" in str(rec.exc_info[1])
        for rec in caplog.records
    )
