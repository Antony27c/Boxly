"""Tests de configuración segura y modo producción (F1-A)."""

import logging

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.core.config import DEV_JWT_SECRET, Settings, get_settings
from app.main import create_app

SECRET_VALIDO = "x" * 48


@pytest.fixture(autouse=True)
def _sin_env_local(monkeypatch):
    """Aísla los tests del backend/.env local y de variables del entorno del desarrollador."""
    monkeypatch.setitem(Settings.model_config, "env_file", None)
    for clave in ("DEBUG", "ENVIRONMENT", "JWT_SECRET_KEY"):
        monkeypatch.delenv(clave, raising=False)
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_prod_sin_secret_no_arranca():
    with pytest.raises(ValidationError, match="JWT_SECRET_KEY"):
        Settings(environment="prod", jwt_secret_key="")


@pytest.mark.parametrize(
    "placeholder",
    [
        "cambiar-en-produccion-boxly-sprint1",
        "cambiar-por-un-secreto-largo-y-aleatorio",
    ],
)
def test_prod_con_placeholder_no_arranca(placeholder):
    # Los placeholders miden >=32 caracteres: fallan por ser conocidos, no por largo.
    assert len(placeholder) >= 32
    with pytest.raises(ValidationError, match="placeholder"):
        Settings(environment="prod", jwt_secret_key=placeholder)


def test_prod_con_secret_corto_no_arranca():
    with pytest.raises(ValidationError, match="32"):
        Settings(environment="prod", jwt_secret_key="corta")


def test_prod_con_debug_activo_no_arranca():
    with pytest.raises(ValidationError, match="DEBUG"):
        Settings(environment="prod", jwt_secret_key=SECRET_VALIDO, debug=True)


def test_prod_con_secret_valido_arranca():
    s = Settings(environment="prod", jwt_secret_key=SECRET_VALIDO)
    assert s.es_produccion
    assert s.jwt_secret_key == SECRET_VALIDO


def test_dev_sin_secret_usa_default_inseguro_con_warning(monkeypatch, caplog):
    monkeypatch.delenv("JWT_SECRET_KEY", raising=False)
    monkeypatch.delenv("ENVIRONMENT", raising=False)
    with caplog.at_level(logging.WARNING):
        s = Settings()
    assert not s.es_produccion
    assert s.jwt_secret_key == DEV_JWT_SECRET
    assert "DESARROLLO" in caplog.text


def test_docs_deshabilitados_en_prod(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "prod")
    monkeypatch.setenv("JWT_SECRET_KEY", SECRET_VALIDO)
    monkeypatch.setenv("DEBUG", "false")
    get_settings.cache_clear()
    try:
        app = create_app()
        with TestClient(app) as client:
            assert client.get("/docs").status_code == 404
            assert client.get("/redoc").status_code == 404
            assert client.get("/openapi.json").status_code == 404
            # La API sigue funcionando: el health check responde.
            assert client.get("/").status_code == 200
    finally:
        get_settings.cache_clear()


def test_docs_habilitados_en_dev():
    get_settings.cache_clear()
    try:
        app = create_app()
        with TestClient(app) as client:
            assert client.get("/docs").status_code == 200
            assert client.get("/openapi.json").status_code == 200
    finally:
        get_settings.cache_clear()
