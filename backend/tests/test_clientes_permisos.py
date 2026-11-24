import logging
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

from app.core.email import ResultadoEnvio
from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.main import app
from app.models import Cliente, Orden, Usuario, Vehiculo
from app.models.usuario import RolUsuario


@pytest.fixture
def datos():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        admin = Usuario(nombre="Admin", apellido="Taller", email="admin@x.com",
                        password_hash=hash_password("x"), rol=RolUsuario.administrador)
        recepcion = Usuario(nombre="Recep", apellido="Taller", email="recep@x.com",
                            password_hash=hash_password("x"), rol=RolUsuario.recepcion)
        mecanico = Usuario(nombre="Mec", apellido="Uno", email="mec1@x.com",
                           password_hash=hash_password("x"), rol=RolUsuario.mecanico)
        otro_mecanico = Usuario(nombre="Mec", apellido="Dos", email="mec2@x.com",
                                password_hash=hash_password("x"), rol=RolUsuario.mecanico)
        propio = Cliente(nombre="Ana", apellido="Propia", dni="10000001")
        de_otro = Cliente(nombre="Beto", apellido="Ajeno", dni="10000002")
        sin_asignar = Cliente(nombre="Caro", apellido="Libre", dni="10000003")
        vacio = Cliente(nombre="Dani", apellido="Vacio", dni="10000004", email="dani@x.com")
        db.add_all([admin, recepcion, mecanico, otro_mecanico,
                    propio, de_otro, sin_asignar, vacio])
        db.flush()
        vehiculos = [
            Vehiculo(cliente_id=c.id, patente=p, marca="VW", modelo="Gol")
            for c, p in ((propio, "AAA001"), (de_otro, "BBB002"), (sin_asignar, "CCC003"))
        ]
        db.add_all(vehiculos)
        db.flush()
        db.add_all([
            Orden(cliente_id=propio.id, vehiculo_id=vehiculos[0].id,
                  creado_por_id=admin.id, mecanico_id=mecanico.id,
                  codigo="OT-1001", estado="pendiente", descripcion_ingreso="Cambio de aceite"),
            Orden(cliente_id=de_otro.id, vehiculo_id=vehiculos[1].id,
                  creado_por_id=admin.id, mecanico_id=otro_mecanico.id,
                  codigo="OT-1002", estado="pendiente", descripcion_ingreso="Frenos"),
            Orden(cliente_id=sin_asignar.id, vehiculo_id=vehiculos[2].id,
                  creado_por_id=admin.id, mecanico_id=None,
                  codigo="OT-1003", estado="pendiente", descripcion_ingreso="Revision"),
        ])
        ids = {
            "propio": propio.id, "de_otro": de_otro.id,
            "sin_asignar": sin_asignar.id, "vacio": vacio.id,
        }
        db.commit()
        return {
            "admin": {"Authorization": "Bearer " + create_access_token(admin.id)},
            "recepcion": {"Authorization": "Bearer " + create_access_token(recepcion.id)},
            "mecanico": {"Authorization": "Bearer " + create_access_token(mecanico.id)},
            **ids,
        }


@pytest.fixture
def envio(monkeypatch):
    mock = AsyncMock(return_value=ResultadoEnvio("enviado", "Activá tu cuenta de Boxly"))
    monkeypatch.setattr("app.api.v1.clientes.service.enviar_invitacion_portal", mock)
    return mock


@pytest.fixture
def api():
    with TestClient(app) as cliente:
        yield cliente


def _lista(api, headers, **params):
    return api.get("/api/v1/clientes", headers=headers, params=params)


def test_mecanico_solo_lista_clientes_de_sus_ordenes(api, datos):
    r = _lista(api, datos["mecanico"])
    assert r.status_code == 200
    assert {c["id"] for c in r.json()} == {datos["propio"]}


def test_mecanico_abre_su_cliente_y_el_ajeno_da_404(api, datos):
    propio = api.get(f"/api/v1/clientes/{datos['propio']}", headers=datos["mecanico"])
    assert propio.status_code == 200 and propio.json()["dni"] == "10000001"
    for clave in ("de_otro", "sin_asignar", "vacio"):
        r = api.get(f"/api/v1/clientes/{datos[clave]}", headers=datos["mecanico"])
        assert r.status_code == 404, clave


def test_la_busqueda_del_mecanico_tampoco_ve_clientes_ajenos(api, datos):
    assert _lista(api, datos["mecanico"], q="Beto").json() == []
    assert [c["id"] for c in _lista(api, datos["mecanico"], q="Ana").json()] == [datos["propio"]]


@pytest.mark.parametrize("rol", ["admin", "recepcion"])
def test_admin_y_recepcion_siguen_viendolos_todos(api, datos, rol):
    r = _lista(api, datos[rol])
    assert r.status_code == 200
    assert {c["id"] for c in r.json()} == {
        datos["propio"], datos["de_otro"], datos["sin_asignar"], datos["vacio"],
    }
    assert api.get(f"/api/v1/clientes/{datos['de_otro']}", headers=datos[rol]).status_code == 200


def test_mecanico_no_puede_crear_editar_borrar_ni_invitar(api, datos):
    h = datos["mecanico"]
    assert api.post("/api/v1/clientes", headers=h, json={
        "nombre": "Nuevo", "apellido": "Cliente", "dni": "55555555",
    }).status_code == 403
    assert api.put(f"/api/v1/clientes/{datos['propio']}", headers=h,
                   json={"nombre": "Otro Nombre"}).status_code == 403
    assert api.delete(f"/api/v1/clientes/{datos['propio']}", headers=h).status_code == 403
    assert api.post(f"/api/v1/clientes/{datos['vacio']}/invitacion", headers=h).status_code == 403


def test_error_smtp_no_se_filtra_en_el_detail(api, datos, envio, caplog):
    envio.return_value = ResultadoEnvio("fallido", "Asunto", "SMTPAuthenticationError: clave mala")
    with caplog.at_level(logging.ERROR):
        r = api.post(f"/api/v1/clientes/{datos['vacio']}/invitacion", headers=datos["admin"])
    assert r.status_code == 502
    detalle = r.json()["detail"]
    assert "clave mala" not in detalle and "SMTP" not in detalle
    assert detalle == "No se pudo enviar el correo de invitación. Revisá la configuración de email."
    assert "clave mala" in caplog.text


def test_invitacion_exitosa_sigue_funcionando(api, datos, envio):
    r = api.post(f"/api/v1/clientes/{datos['vacio']}/invitacion", headers=datos["admin"])
    assert r.status_code == 200 and r.json()["detail"] == "Invitación enviada."
    envio.assert_awaited_once()
