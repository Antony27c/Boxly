"""Integridad de pagos: reuso del pendiente, monto vigente, reembolsos,
lock de fila y payment_id único de Mercado Pago."""
from decimal import Decimal
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.api.v1.pagos import mercadopago, service
from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models import Cliente, Orden, Pago, Usuario, Vehiculo
from app.models.usuario import RolUsuario
from app.main import app


@pytest.fixture
def datos():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        admin = Usuario(nombre="A", apellido="B", email="admin@x.com",
                        password_hash=hash_password("x"), rol=RolUsuario.administrador)
        cliente = Cliente(nombre="Juan", apellido="Perez", dni="12345678", email="juan@x.com")
        db.add_all([admin, cliente])
        db.flush()
        vehiculo = Vehiculo(cliente_id=cliente.id, patente="AB123CD",
                            marca="Ford", modelo="Focus")
        db.add(vehiculo)
        db.flush()
        cuenta = Usuario(nombre="Juan", apellido="Perez", email="cuenta@x.com",
                         password_hash=hash_password("x"), rol=RolUsuario.cliente,
                         cliente_id=cliente.id)
        orden = Orden(cliente_id=cliente.id, vehiculo_id=vehiculo.id,
                      creado_por_id=admin.id, codigo="ORD-INT-1", estado="listo",
                      descripcion_ingreso="Cambio de frenos", costo_final=Decimal("1500.00"))
        db.add_all([cuenta, orden])
        db.flush()
        pago = Pago(orden_id=orden.id, monto=Decimal("1500.00"), estado="pendiente")
        db.add(pago)
        db.commit()
        return {
            "admin": {"Authorization": "Bearer " + create_access_token(admin.id)},
            "cliente": {"Authorization": "Bearer " + create_access_token(cuenta.id)},
            "orden": orden.id,
            "pago": pago.id,
        }


@pytest.fixture
def api():
    with TestClient(app) as cliente:
        yield cliente


def _settings(monkeypatch, **cambios):
    fake = SimpleNamespace(
        debug=True,
        environment="dev",
        mp_access_token=None,
        mp_webhook_secret=None,
        frontend_url="http://front.test",
        backend_public_url=None,
    )
    for clave, valor in cambios.items():
        setattr(fake, clave, valor)
    monkeypatch.setattr(service, "get_settings", lambda: fake)
    return fake


def _pago_mp(payment_id, estado_mp="approved", monto="1500.00", referencia=None):
    return {
        "id": payment_id,
        "status": estado_mp,
        "transaction_amount": monto,
        "external_reference": referencia,
    }


def _webhook(api, payment_id):
    return api.post("/api/v1/pagos/webhook",
                    json={"type": "payment", "data": {"id": str(payment_id)}})


def _confirmar(api, datos, payment_id):
    return api.post(f"/api/v1/pagos/{datos['pago']}/confirmar",
                    headers=datos["cliente"], json={"payment_id": str(payment_id)})


def test_crear_pago_reusa_el_pendiente_vigente(api, datos, monkeypatch):
    _settings(monkeypatch)
    r1 = api.post(f"/api/v1/pagos/ordenes/{datos['orden']}", headers=datos["cliente"])
    r2 = api.post(f"/api/v1/pagos/ordenes/{datos['orden']}", headers=datos["cliente"])
    assert r1.status_code == 201 and r2.status_code == 201
    assert r1.json()["pago_id"] == datos["pago"] == r2.json()["pago_id"]
    with SessionLocal() as db:
        pendientes = [p for p in db.query(Pago).filter_by(orden_id=datos["orden"])
                      if p.estado == "pendiente"]
        assert len(pendientes) == 1


def test_crear_pago_con_monto_distinto_anula_el_viejo(api, datos, monkeypatch):
    _settings(monkeypatch)
    with SessionLocal() as db:
        db.get(Orden, datos["orden"]).costo_final = Decimal("2000.00")
        db.commit()
    r = api.post(f"/api/v1/pagos/ordenes/{datos['orden']}", headers=datos["cliente"])
    assert r.status_code == 201 and r.json()["pago_id"] != datos["pago"]
    with SessionLocal() as db:
        viejo = db.get(Pago, datos["pago"])
        nuevo = db.get(Pago, r.json()["pago_id"])
        assert viejo.estado == "rechazado"
        assert nuevo.estado == "pendiente" and nuevo.monto == Decimal("2000.00")


def test_reuso_con_token_recupera_la_preferencia(api, datos, monkeypatch):
    _settings(monkeypatch, mp_access_token="token")
    creadas, consultadas = [], []
    monkeypatch.setattr(
        mercadopago, "crear_preferencia",
        lambda *a, **k: creadas.append(1) or {"id": "pref-1", "init_point": "https://mp/pago"},
    )
    monkeypatch.setattr(
        mercadopago, "obtener_preferencia",
        lambda *a, **k: consultadas.append(1) or {"id": "pref-1", "init_point": "https://mp/pago"},
    )
    for _ in range(2):
        r = api.post(f"/api/v1/pagos/ordenes/{datos['orden']}", headers=datos["cliente"])
        assert r.status_code == 201 and r.json()["url_pago"] == "https://mp/pago"
    assert len(creadas) == 1 and len(consultadas) == 1


def test_confirmar_avisa_cuando_el_cobro_coincide(api, datos, monkeypatch):
    _settings(monkeypatch, mp_access_token="token")
    monkeypatch.setattr(
        mercadopago, "obtener_pago",
        lambda *a, **k: _pago_mp("321", referencia=str(datos["pago"])),
    )
    r = _confirmar(api, datos, "321")
    assert r.status_code == 200 and r.json()["estado"] == "aprobado"
    with SessionLocal() as db:
        assert db.get(Pago, datos["pago"]).payment_id == "321"


@pytest.mark.parametrize("cobrado", ["1000.00", "2000.00"])
def test_confirmar_rechaza_cobro_distinto_al_costo_final(api, datos, monkeypatch, cobrado):
    _settings(monkeypatch, mp_access_token="token")
    monkeypatch.setattr(
        mercadopago, "obtener_pago",
        lambda *a, **k: _pago_mp("322", monto=cobrado, referencia=str(datos["pago"])),
    )
    r = _confirmar(api, datos, "322")
    assert r.status_code == 200 and r.json()["estado"] == "rechazado"


def test_webhook_avisa_pago_cuando_el_cobro_coincide(api, datos, monkeypatch):
    _settings(monkeypatch, mp_access_token="token")
    monkeypatch.setattr(
        mercadopago, "obtener_pago",
        lambda *a, **k: _pago_mp("555", referencia=str(datos["pago"])),
    )
    assert _webhook(api, "555").status_code == 200
    with SessionLocal() as db:
        assert db.get(Pago, datos["pago"]).estado == "aprobado"


@pytest.mark.parametrize("estado_mp", ["refunded", "charged_back"])
def test_webhook_reembolso_deja_la_orden_sin_pagar(api, datos, monkeypatch, estado_mp):
    _settings(monkeypatch, mp_access_token="token")
    with SessionLocal() as db:
        pago = db.get(Pago, datos["pago"])
        pago.estado = "aprobado"
        pago.payment_id = "555"
        db.commit()
    monkeypatch.setattr(
        mercadopago, "obtener_pago",
        lambda *a, **k: _pago_mp("555", estado_mp=estado_mp, referencia=str(datos["pago"])),
    )
    assert _webhook(api, "555").status_code == 200
    with SessionLocal() as db:
        assert db.get(Pago, datos["pago"]).estado == "reembolsado"
        assert db.get(Orden, datos["orden"]).pagada is False


def test_pago_aprobado_no_vuelve_atras_con_rechazo(api, datos, monkeypatch):
    _settings(monkeypatch, mp_access_token="token")
    with SessionLocal() as db:
        pago = db.get(Pago, datos["pago"])
        pago.estado = "aprobado"
        pago.payment_id = "777"
        db.commit()
    monkeypatch.setattr(
        mercadopago, "obtener_pago",
        lambda *a, **k: _pago_mp("777", estado_mp="rejected", referencia=str(datos["pago"])),
    )
    assert _webhook(api, "777").status_code == 200
    with SessionLocal() as db:
        assert db.get(Pago, datos["pago"]).estado == "aprobado"


def test_pago_reembolsado_es_terminal(api, datos, monkeypatch):
    _settings(monkeypatch, mp_access_token="token")
    with SessionLocal() as db:
        pago = db.get(Pago, datos["pago"])
        pago.estado = "reembolsado"
        pago.payment_id = "888"
        db.commit()
    monkeypatch.setattr(
        mercadopago, "obtener_pago",
        lambda *a, **k: _pago_mp("888", referencia=str(datos["pago"])),
    )
    assert _webhook(api, "888").status_code == 200
    with SessionLocal() as db:
        assert db.get(Pago, datos["pago"]).estado == "reembolsado"


def _pago_con_payment_id(datos, payment_id):
    with SessionLocal() as db:
        otro = Pago(orden_id=datos["orden"], monto=Decimal("1.00"),
                    estado="rechazado", payment_id=payment_id)
        db.add(otro)
        db.commit()


def test_webhook_ignora_payment_id_ya_asignado_a_otro_pago(api, datos, monkeypatch):
    _settings(monkeypatch, mp_access_token="token")
    _pago_con_payment_id(datos, "999")
    monkeypatch.setattr(
        mercadopago, "obtener_pago",
        lambda *a, **k: _pago_mp("999", referencia=str(datos["pago"])),
    )
    assert _webhook(api, "999").status_code == 200
    with SessionLocal() as db:
        pago = db.get(Pago, datos["pago"])
        assert pago.estado == "pendiente" and pago.payment_id is None


def test_confirmar_ignora_payment_id_ya_asignado_a_otro_pago(api, datos, monkeypatch):
    _settings(monkeypatch, mp_access_token="token")
    _pago_con_payment_id(datos, "999")
    monkeypatch.setattr(
        mercadopago, "obtener_pago",
        lambda *a, **k: _pago_mp("999", referencia=str(datos["pago"])),
    )
    r = _confirmar(api, datos, "999")
    assert r.status_code == 200 and r.json()["estado"] == "pendiente"
    with SessionLocal() as db:
        assert db.get(Pago, datos["pago"]).payment_id is None
