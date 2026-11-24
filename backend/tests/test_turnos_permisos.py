from datetime import datetime

import pytest
from fastapi.testclient import TestClient

from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.main import app
from app.models import Cliente, Turno, Usuario
from app.models.usuario import RolUsuario


@pytest.fixture
def datos():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        admin = Usuario(
            nombre="Admin", apellido="Uno", email="admin@x.com",
            password_hash=hash_password("x"), rol=RolUsuario.administrador,
        )
        recepcion = Usuario(
            nombre="Recep", apellido="Cion", email="recep@x.com",
            password_hash=hash_password("x"), rol=RolUsuario.recepcion,
        )
        mecanico1 = Usuario(
            nombre="Mec", apellido="Uno", email="mec1@x.com",
            password_hash=hash_password("x"), rol=RolUsuario.mecanico,
        )
        mecanico2 = Usuario(
            nombre="Mec", apellido="Dos", email="mec2@x.com",
            password_hash=hash_password("x"), rol=RolUsuario.mecanico,
        )
        cliente = Cliente(nombre="Juan", apellido="Perez", dni="1", email="j@x.com")
        db.add_all([admin, recepcion, mecanico1, mecanico2, cliente])
        db.commit()

        turnos = [
            Turno(cliente_id=cliente.id, registrado_por_id=admin.id,
                  mecanico_id=mecanico1.id, estado="pendiente",
                  fecha_hora=datetime(2030, 1, 7, 8, 0)),
            Turno(cliente_id=cliente.id, registrado_por_id=admin.id,
                  mecanico_id=mecanico2.id, estado="pendiente",
                  fecha_hora=datetime(2030, 1, 7, 10, 0)),
            Turno(cliente_id=cliente.id, registrado_por_id=admin.id,
                  mecanico_id=None, estado="pendiente",
                  fecha_hora=datetime(2030, 1, 7, 12, 0)),
        ]
        db.add_all(turnos)
        db.commit()

        def header(usuario_id):
            return {"Authorization": "Bearer " + create_access_token(usuario_id)}

        return {
            "h_admin": header(admin.id),
            "h_recep": header(recepcion.id),
            "h_mec1": header(mecanico1.id),
            "h_mec2": header(mecanico2.id),
            "cliente": cliente.id,
            "mec1": mecanico1.id,
            "turno_mec1": turnos[0].id,
            "turno_mec2": turnos[1].id,
            "turno_libre": turnos[2].id,
            "todos": {t.id for t in turnos},
        }


@pytest.fixture
def api():
    with TestClient(app) as cliente:
        yield cliente


def test_mecanico_lista_solo_sus_turnos(api, datos):
    r = api.get("/api/v1/turnos", headers=datos["h_mec1"])
    assert r.status_code == 200
    assert {t["id"] for t in r.json()} == {datos["turno_mec1"]}


def test_mecanico_obtiene_solo_sus_turnos(api, datos):
    propio = api.get(f"/api/v1/turnos/{datos['turno_mec1']}", headers=datos["h_mec1"])
    assert propio.status_code == 200
    assert propio.json()["mecanico_id"] == datos["mec1"]

    for turno_id in (datos["turno_mec2"], datos["turno_libre"], 9999):
        r = api.get(f"/api/v1/turnos/{turno_id}", headers=datos["h_mec1"])
        assert r.status_code == 404


def test_admin_y_recepcion_ven_todos_los_turnos(api, datos):
    for header in (datos["h_admin"], datos["h_recep"]):
        r = api.get("/api/v1/turnos", headers=header)
        assert r.status_code == 200
        assert {t["id"] for t in r.json()} == datos["todos"]
        for turno_id in datos["todos"]:
            assert api.get(f"/api/v1/turnos/{turno_id}", headers=header).status_code == 200


def test_mecanico_no_crea_edita_ni_borra_turnos(api, datos):
    payload = {"cliente_id": datos["cliente"], "fecha_hora": "2030-01-08T08:00:00"}
    assert api.post("/api/v1/turnos", headers=datos["h_mec1"], json=payload).status_code == 403
    assert api.put(
        f"/api/v1/turnos/{datos['turno_mec1']}", headers=datos["h_mec1"], json={"notas": "x"}
    ).status_code == 403
    assert api.delete(f"/api/v1/turnos/{datos['turno_mec1']}", headers=datos["h_mec1"]).status_code == 403


def test_mecanico_cambia_estado_solo_de_sus_turnos(api, datos):
    propio = api.put(
        f"/api/v1/turnos/{datos['turno_mec1']}/estado",
        headers=datos["h_mec1"],
        json={"estado": "confirmado"},
    )
    assert propio.status_code == 200
    assert propio.json()["estado"] == "confirmado"

    for turno_id in (datos["turno_mec2"], datos["turno_libre"], 9999):
        r = api.put(
            f"/api/v1/turnos/{turno_id}/estado",
            headers=datos["h_mec1"],
            json={"estado": "confirmado"},
        )
        assert r.status_code == 404

    # El turno ajeno no se tocó.
    r = api.get(f"/api/v1/turnos/{datos['turno_mec2']}", headers=datos["h_admin"])
    assert r.json()["estado"] == "pendiente"
