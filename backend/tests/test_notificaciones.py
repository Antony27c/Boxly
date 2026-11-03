from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

from app.core.email import ResultadoEnvio
from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models import Cliente, Notificacion, Orden, Usuario, Vehiculo
from app.models.usuario import RolUsuario
from main import app


@pytest.fixture
def datos():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        usuarios = {
            rol: Usuario(nombre=rol.value, apellido="Test", email=f"{rol.value}@x.com",
                         password_hash=hash_password("x"), rol=rol)
            for rol in (RolUsuario.administrador, RolUsuario.recepcion)
        }
        cliente = Cliente(nombre="Juan", apellido="Perez", dni="1", email="juan@x.com")
        sin_mail = Cliente(nombre="Ana", apellido="Sin", dni="2", email=None)
        db.add_all([*usuarios.values(), cliente, sin_mail])
        db.flush()
        v1 = Vehiculo(cliente_id=cliente.id, patente="AAA111", marca="VW", modelo="Gol")
        v2 = Vehiculo(cliente_id=sin_mail.id, patente="BBB222", marca="VW", modelo="Polo")
        db.add_all([v1, v2])
        db.flush()
        ordenes = [
            Orden(cliente_id=c.id, vehiculo_id=v.id, creado_por_id=usuarios[RolUsuario.administrador].id,
                  codigo=cod, estado="pendiente", descripcion_ingreso="Cambio de aceite")
            for c, v, cod in ((cliente, v1, "OT-1"), (sin_mail, v2, "OT-2"))
        ]
        db.add_all(ordenes)
        db.commit()
        return {
            "admin": {"Authorization": "Bearer " + create_access_token(usuarios[RolUsuario.administrador].id)},
            "recepcion": {"Authorization": "Bearer " + create_access_token(usuarios[RolUsuario.recepcion].id)},
            "orden": ordenes[0].id,
            "orden_sin_mail": ordenes[1].id,
        }


@pytest.fixture
def envio(monkeypatch):
    mock = AsyncMock(return_value=ResultadoEnvio("enviado", "Asunto de prueba"))
    monkeypatch.setattr("app.api.v1.ordenes.service.enviar_notificacion_cambio_estado", mock)
    return mock


@pytest.fixture
def api():
    with TestClient(app) as cliente:
        yield cliente


def _cambiar(api, datos, estado="ingresado"):
    return api.patch(
        f"/api/v1/ordenes/{datos['orden']}", headers=datos["admin"],
        json={"estado": estado, "comentario_cambio": "Entró al taller"},
    )


def test_cambio_de_estado_deja_comprobante(api, datos, envio):
    assert _cambiar(api, datos).status_code == 200
    lista = api.get(f"/api/v1/ordenes/{datos['orden']}/notificaciones", headers=datos["recepcion"]).json()
    assert len(lista) == 1
    assert lista[0]["resultado"] == "enviado" and lista[0]["destinatario"] == "juan@x.com"
    assert lista[0]["estado_orden"] == "ingresado" and lista[0]["manual"] is False
    envio.assert_awaited_once()


def test_fallo_de_smtp_queda_registrado_y_no_rompe(api, datos, envio):
    envio.return_value = ResultadoEnvio("fallido", "Asunto", "SMTPAuthenticationError: clave mala")
    assert _cambiar(api, datos).status_code == 200
    lista = api.get(f"/api/v1/ordenes/{datos['orden']}/notificaciones", headers=datos["admin"]).json()
    assert lista[0]["resultado"] == "fallido" and "clave mala" in lista[0]["error"]


def test_admin_reenvia_con_un_boton(api, datos, envio):
    _cambiar(api, datos)
    r = api.post(f"/api/v1/ordenes/{datos['orden']}/notificaciones", headers=datos["admin"])
    assert r.status_code == 201
    assert r.json()["manual"] is True and r.json()["enviado_por_nombre"] == "Test, administrador"
    assert len(api.get(f"/api/v1/ordenes/{datos['orden']}/notificaciones", headers=datos["admin"]).json()) == 2


def test_solo_el_admin_puede_reenviar(api, datos, envio):
    r = api.post(f"/api/v1/ordenes/{datos['orden']}/notificaciones", headers=datos["recepcion"])
    assert r.status_code == 403
    envio.assert_not_awaited()


def test_cliente_sin_email(api, datos, envio):
    r = api.post(f"/api/v1/ordenes/{datos['orden_sin_mail']}/notificaciones", headers=datos["admin"])
    assert r.status_code == 400
    envio.assert_not_awaited()


def test_eliminar_orden_borra_sus_comprobantes(api, datos, envio):
    api.post(f"/api/v1/ordenes/{datos['orden']}/notificaciones", headers=datos["admin"])
    assert api.delete(f"/api/v1/ordenes/{datos['orden']}", headers=datos["admin"]).status_code == 200
    with SessionLocal() as db:
        assert db.query(Notificacion).count() == 0


@pytest.fixture
def orden_lista(datos):
    with SessionLocal() as db:
        db.get(Orden, datos["orden"]).estado = "listo"
        db.commit()
    return datos


@pytest.fixture
def envio_cobro(monkeypatch):
    mock = AsyncMock(return_value=ResultadoEnvio("enviado", "Cobro emitido - orden OT-1"))
    monkeypatch.setattr("app.api.v1.ordenes.service.enviar_notificacion_cobro", mock)
    return mock


def _avisos(api, datos):
    return api.get(f"/api/v1/ordenes/{datos['orden']}/notificaciones", headers=datos["admin"]).json()


def test_emitir_cobro_avisa_al_cliente(api, orden_lista, envio_cobro):
    r = api.post(f"/api/v1/ordenes/{orden_lista['orden']}/cobro", headers=orden_lista["admin"], json={"monto": 15000})
    assert r.status_code == 200
    avisos = _avisos(api, orden_lista)
    assert [a["tipo"] for a in avisos] == ["cobro"] and avisos[0]["resultado"] == "enviado"
    assert envio_cobro.await_args.args[-1] == "$ 15,000.00"


def test_aprobar_cobro_avisa_al_cliente(api, orden_lista, envio_cobro):
    r = api.post(f"/api/v1/ordenes/{orden_lista['orden']}/cobro/aprobar", headers=orden_lista["recepcion"], json={"monto": 9000})
    assert r.status_code == 200
    assert [a["tipo"] for a in _avisos(api, orden_lista)] == ["cobro"]


def test_cobro_sin_email_no_avisa(api, datos, envio_cobro):
    with SessionLocal() as db:
        db.get(Orden, datos["orden_sin_mail"]).estado = "listo"
        db.commit()
    r = api.post(f"/api/v1/ordenes/{datos['orden_sin_mail']}/cobro", headers=datos["admin"], json={"monto": 100})
    assert r.status_code == 200
    envio_cobro.assert_not_awaited()
