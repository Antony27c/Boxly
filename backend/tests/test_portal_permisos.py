import pytest
from fastapi.testclient import TestClient

from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models import Cliente, Usuario, Vehiculo
from app.models.usuario import RolUsuario
from app.main import app


@pytest.fixture
def datos():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        cliente = Cliente(nombre="Ana", apellido="Perez", dni="10", email="ana@x.com")
        otro = Cliente(nombre="Beto", apellido="Gomez", dni="20", email="beto@x.com")
        db.add_all([cliente, otro])
        db.flush()
        vehiculo = Vehiculo(
            cliente_id=cliente.id, patente="AA111BB", marca="Ford", modelo="Fiesta"
        )
        vehiculo_ajeno = Vehiculo(
            cliente_id=otro.id, patente="CC222DD", marca="Fiat", modelo="Uno"
        )
        usuario = Usuario(
            nombre="Ana", apellido="Perez", email="ana.portal@x.com",
            password_hash=hash_password("x"), rol=RolUsuario.cliente,
            cliente_id=cliente.id,
        )
        sin_vinculo = Usuario(
            nombre="Sin", apellido="Vinculo", email="sin@x.com",
            password_hash=hash_password("x"), rol=RolUsuario.cliente,
            cliente_id=None,
        )
        db.add_all([cliente, otro, vehiculo, vehiculo_ajeno, usuario, sin_vinculo])
        db.commit()

        def header(usuario_id):
            return {"Authorization": "Bearer " + create_access_token(usuario_id)}

        return {
            "h_cliente": header(usuario.id),
            "h_sin_vinculo": header(sin_vinculo.id),
        }


@pytest.fixture
def api():
    with TestClient(app) as cliente:
        yield cliente


def test_cliente_sin_cliente_id_recibe_403_en_todo_el_portal(api, datos):
    endpoints = [
        "/api/v1/mis-vehiculos",
        "/api/v1/mis-ordenes",
        "/api/v1/mis-ordenes/1",
    ]
    for endpoint in endpoints:
        r = api.get(endpoint, headers=datos["h_sin_vinculo"])
        assert r.status_code == 403
        assert r.json()["detail"] == "Tu usuario no está vinculado a un cliente"


def test_cliente_sin_vinculo_no_ve_vehiculos(api, datos):
    # Aunque existan vehículos en el taller, la cuenta sin cliente_id no recibe ninguno.
    r = api.get("/api/v1/mis-vehiculos", headers=datos["h_sin_vinculo"])
    assert r.status_code == 403
    assert "AA111BB" not in r.text and "CC222DD" not in r.text


def test_cliente_vinculado_ve_solo_sus_vehiculos(api, datos):
    r = api.get("/api/v1/mis-vehiculos", headers=datos["h_cliente"])
    assert r.status_code == 200
    patentes = {v["patente"] for v in r.json()}
    assert patentes == {"AA111BB"}

    r = api.get("/api/v1/mis-ordenes", headers=datos["h_cliente"])
    assert r.status_code == 200
    assert r.json() == []
