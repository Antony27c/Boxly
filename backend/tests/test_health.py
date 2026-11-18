"""Tests del endpoint GET /health (sin auth y fuera del schema)."""

import logging

import pytest
from fastapi.testclient import TestClient

from app.main import create_app


@pytest.fixture
def api():
    with TestClient(create_app()) as client:
        yield client


def test_health_responde_200_con_db_ok(api):
    r = api.get("/health")
    assert r.status_code == 200
    data = r.json()
    assert data["estado"] == "ok"
    assert data["db"] == "ok"
    assert data["version"]


def test_health_no_aparece_en_el_schema(api):
    paths = api.get("/openapi.json").json()["paths"]
    assert "/health" not in paths


def test_health_responde_503_si_la_db_falla(api, monkeypatch, caplog):
    def _session_local_rota():
        raise RuntimeError("falla de DB simulada")

    monkeypatch.setattr("app.main.SessionLocal", _session_local_rota)
    with caplog.at_level(logging.ERROR):
        r = api.get("/health")
    assert r.status_code == 503
    assert r.json() == {"estado": "degradado", "db": "error"}
    assert any(
        "base de datos" in rec.getMessage() for rec in caplog.records
    )
