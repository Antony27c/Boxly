from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.core.email import ResultadoEnvio
from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models import Cliente, Usuario
from app.models.usuario import RolUsuario
from main import app


@pytest.fixture
def datos(monkeypatch):
    monkeypatch.setattr(get_settings(), "cliente_password_dni", True)
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        admin = Usuario(nombre="A", apellido="B", email="admin@x.com", password_hash=hash_password("x"),
                        rol=RolUsuario.administrador)
        viejo = Cliente(nombre="Juan", apellido="Perez", dni="12345678", email="Juan@x.com")
        db.add_all([admin, viejo])
        db.commit()
        return {"admin": {"Authorization": "Bearer " + create_access_token(admin.id)}}


@pytest.fixture
def invitaciones(monkeypatch):
    mock = AsyncMock(return_value=ResultadoEnvio("enviado", "Activá tu cuenta de Boxly"))
    monkeypatch.setattr("app.api.v1.clientes.service.enviar_invitacion_portal", mock)
    return mock


@pytest.fixture
def api():
    with TestClient(app) as cliente:
        yield cliente


def _login(api, email, password):
    return api.post("/api/v1/auth/login", json={"email": email, "password": password})


def test_cliente_nuevo_entra_con_su_dni_y_no_se_le_manda_correo(api, datos, invitaciones):
    r = api.post("/api/v1/clientes", headers=datos["admin"],
                 json={"nombre": "Luis", "apellido": "Gomez", "dni": "11223344", "email": "luis@x.com"})
    assert r.status_code == 201 and r.json()["tiene_cuenta"] is True
    sesion = _login(api, "luis@x.com", "11223344")
    assert sesion.status_code == 200 and sesion.json()["usuario"]["rol"] == "cliente"
    invitaciones.assert_not_awaited()


def test_cliente_existente_sin_cuenta_entra_la_primera_vez_con_su_dni(api, datos):
    assert _login(api, "juan@x.com", "12345678").status_code == 200   # el correo no distingue mayúsculas
    clientes = api.get("/api/v1/clientes", headers=datos["admin"]).json()
    assert clientes[0]["tiene_cuenta"] is True
    assert _login(api, "juan@x.com", "12345678").status_code == 200    # y las siguientes veces también


def test_otra_contrasena_no_entra(api, datos):
    assert _login(api, "juan@x.com", "otra-clave1").status_code == 401
    assert _login(api, "juan@x.com", "12345679").status_code == 401
    with SessionLocal() as db:
        assert db.query(Usuario).filter(Usuario.rol == RolUsuario.cliente).count() == 0


def test_con_la_opcion_apagada_el_dni_no_sirve(api, datos, monkeypatch):
    monkeypatch.setattr(get_settings(), "cliente_password_dni", False)
    assert _login(api, "juan@x.com", "12345678").status_code == 401


def test_cliente_sin_correo_no_tiene_cuenta(api, datos):
    r = api.post("/api/v1/clientes", headers=datos["admin"],
                 json={"nombre": "Ana", "apellido": "Sin", "dni": "99887766"})
    assert r.status_code == 201 and r.json()["tiene_cuenta"] is False
