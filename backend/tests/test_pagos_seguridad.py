import hashlib
import hmac
from decimal import Decimal
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.api.v1.pagos import mercadopago, service
from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.main import app
from app.models import Cliente, Orden, Pago, Usuario, Vehiculo
from app.models.usuario import RolUsuario

SECRETO = "secreto-de-prueba"


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
                      creado_por_id=admin.id, codigo="ORD-TEST-1", estado="listo",
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
    """Reemplaza get_settings del service por uno de prueba (sin tocar config.py)."""
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


def _firma_mp(secret, data_id, request_id, ts):
    manifest = f"id:{data_id};request-id:{request_id};ts:{ts};"
    return hmac.new(secret.encode(), manifest.encode(), hashlib.sha256).hexdigest()


def _headers_firma(secret=SECRETO, data_id="123", request_id="req-1", ts="1700000000",
                   v1=None):
    v1 = v1 if v1 is not None else _firma_mp(secret, data_id, request_id, ts)
    return {
        "x-signature": f"ts={ts},v1={v1}",
        "x-request-id": request_id,
    }


def test_simular_en_dev_debug_funciona_para_admin(api, datos, monkeypatch):
    _settings(monkeypatch)
    r = api.post(f"/api/v1/pagos/{datos['pago']}/simular", headers=datos["admin"],
                 json={"estado": "aprobado"})
    assert r.status_code == 200 and r.json()["estado"] == "aprobado"


def test_cliente_no_puede_simular(api, datos, monkeypatch):
    _settings(monkeypatch)
    r = api.post(f"/api/v1/pagos/{datos['pago']}/simular", headers=datos["cliente"],
                 json={"estado": "aprobado"})
    assert r.status_code == 403


@pytest.mark.parametrize("entorno,debug", [("prod", True), ("dev", False), ("prod", False)])
def test_simular_fuera_de_dev_debug_da_404(api, datos, monkeypatch, entorno, debug):
    _settings(monkeypatch, environment=entorno, debug=debug)
    r = api.post(f"/api/v1/pagos/{datos['pago']}/simular", headers=datos["admin"],
                 json={"estado": "aprobado"})
    assert r.status_code == 404


def test_crear_pago_sin_token_en_prod_da_503(api, datos, monkeypatch):
    _settings(monkeypatch, environment="prod", mp_access_token=None)
    r = api.post(f"/api/v1/pagos/ordenes/{datos['orden']}", headers=datos["cliente"])
    assert r.status_code == 503


def test_crear_pago_sin_token_en_dev_debug_funciona(api, datos, monkeypatch):
    _settings(monkeypatch)
    r = api.post(f"/api/v1/pagos/ordenes/{datos['orden']}", headers=datos["cliente"])
    assert r.status_code == 201 and r.json()["url_pago"].endswith(f"?pago_id={r.json()['pago_id']}")


def test_webhook_data_id_raro_se_ignora_sin_llamar_a_mp(api, datos, monkeypatch):
    _settings(monkeypatch, mp_access_token="token")
    llamadas = []
    monkeypatch.setattr(mercadopago, "obtener_pago",
                        lambda *a, **k: llamadas.append(a) or {})
    r = api.post("/api/v1/pagos/webhook",
                 json={"type": "payment", "data": {"id": "../x"}})
    assert r.status_code == 200 and r.json()["detail"] == "ok"
    assert llamadas == []


def test_webhook_firma_invalida_da_401(api, datos, monkeypatch):
    _settings(monkeypatch, mp_webhook_secret=SECRETO, mp_access_token="token")
    r = api.post("/api/v1/pagos/webhook",
                 json={"type": "payment", "data": {"id": "123"}},
                 headers=_headers_firma(v1="0" * 64))
    assert r.status_code == 401


def test_webhook_sin_headers_de_firma_da_401(api, datos, monkeypatch):
    _settings(monkeypatch, mp_webhook_secret=SECRETO)
    r = api.post("/api/v1/pagos/webhook",
                 json={"type": "payment", "data": {"id": "123"}})
    assert r.status_code == 401


def test_webhook_firma_valida_pasa(api, datos, monkeypatch):
    _settings(monkeypatch, mp_webhook_secret=SECRETO)
    r = api.post("/api/v1/pagos/webhook",
                 json={"type": "payment", "data": {"id": "123"}},
                 headers=_headers_firma())
    assert r.status_code == 200 and r.json()["detail"] == "ok"


def test_webhook_error_de_mp_responde_200(api, datos, monkeypatch):
    _settings(monkeypatch, mp_access_token="token")

    def falla(*a, **k):
        raise mercadopago.MercadoPagoError("MP caído")

    monkeypatch.setattr(mercadopago, "obtener_pago", falla)
    r = api.post("/api/v1/pagos/webhook",
                 json={"type": "payment", "data": {"id": "123"}})
    assert r.status_code == 200 and r.json()["detail"] == "ok"


def test_confirmar_pago_error_de_mp_sigue_dando_502(api, datos, monkeypatch):
    _settings(monkeypatch, mp_access_token="token")

    def falla(*a, **k):
        raise mercadopago.MercadoPagoError("MP caído")

    monkeypatch.setattr(mercadopago, "obtener_pago", falla)
    r = api.post(f"/api/v1/pagos/{datos['pago']}/confirmar", headers=datos["admin"],
                 json={"payment_id": "123"})
    assert r.status_code == 502
