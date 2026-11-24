"""Arreglos de la auditoría R3 de Mercado Pago (sandbox, reintentos del
webhook y timeout del cliente HTTP).

Cubre: ``sandbox_init_point`` solo fuera de prod o con token TEST-, 503 del
webhook ante falla transitoria de MP (200 en los casos ya decididos) y el
manejo del init_point faltante en ambos flujos de cobro.
"""
from datetime import timedelta
from decimal import Decimal
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.api.v1.pagos import mercadopago as pagos_mp
from app.api.v1.pagos import service as pagos_service
from app.api.v1.suscripcion_mp import cliente_mp
from app.api.v1.suscripcion_mp import service as sus_mp_service
from app.core import mercadopago as mp
from app.core.security import create_access_token, hash_password
from app.core.suscripcion import hoy
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.main import app
from app.models import Cliente, Orden, Pago, Taller, Usuario, Vehiculo
from app.models.suscripcion import PagoSuscripcion
from app.models.usuario import RolUsuario


@pytest.fixture
def api():
    with TestClient(app) as cliente:
        yield cliente


@pytest.fixture
def datos():
    """Taller 1 pago/pro con orden lista para cobrar y un pago pendiente."""
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        taller = db.get(Taller, 1)
        taller.tipo_acceso = "pago"
        taller.plan_codigo = "pro"
        taller.suscripcion_vence_en = hoy() + timedelta(days=30)
        admin = Usuario(nombre="Admin", apellido="Uno", email="admin@x.com",
                        password_hash=hash_password("x"), rol=RolUsuario.administrador)
        cliente = Cliente(nombre="Juan", apellido="Perez", dni="12345678",
                          email="juan@x.com")
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
                      creado_por_id=admin.id, codigo="ORD-AUD-1", estado="listo",
                      descripcion_ingreso="Cambio de frenos",
                      costo_final=Decimal("1500.00"))
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


def _settings_pagos(monkeypatch, **cambios):
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
    monkeypatch.setattr(pagos_service, "get_settings", lambda: fake)
    return fake


def _settings_sus(monkeypatch, **cambios):
    fake = SimpleNamespace(
        debug=True,
        environment="dev",
        boxly_mp_access_token="tok-boxly",
        boxly_mp_webhook_secret=None,
        frontend_url="http://front.test",
        backend_public_url=None,
    )
    for clave, valor in cambios.items():
        setattr(fake, clave, valor)
    monkeypatch.setattr(sus_mp_service, "get_settings", lambda: fake)
    return fake


def _taller(taller_id: int = 1) -> Taller:
    with SessionLocal() as db:
        taller = db.get(Taller, taller_id)
        db.expunge(taller)
        return taller


# --- sandbox_init_point / url_de_pago ----------------------------------------


def test_url_de_pago_prefiere_init_point_siempre():
    recurso = {"init_point": "https://mp/pago", "sandbox_init_point": "https://sb"}
    assert mp.url_de_pago(recurso, token="APP_USR-x", produccion=True) == "https://mp/pago"


@pytest.mark.parametrize(
    "token,produccion,esperado",
    [
        ("TEST-123", True, "https://sb"),      # token de prueba: sandbox vale
        ("APP_USR-x", False, "https://sb"),    # fuera de prod: sandbox vale
        ("APP_USR-x", True, None),             # prod con token real: nunca sandbox
    ],
)
def test_url_de_pago_sandbox_solo_test_o_no_prod(token, produccion, esperado):
    recurso = {"sandbox_init_point": "https://sb"}
    assert mp.url_de_pago(recurso, token=token, produccion=produccion) == esperado


def test_url_de_pago_sin_urls_devuelve_none():
    assert mp.url_de_pago({}, token="TEST-1", produccion=False) is None


def test_crear_pago_prod_sin_init_point_da_502_y_no_cae_en_sandbox(api, datos, monkeypatch):
    _settings_pagos(monkeypatch, environment="prod", mp_access_token="APP_USR-x")
    monkeypatch.setattr(
        pagos_mp, "crear_preferencia",
        lambda *a, **k: {"id": "pref-1", "sandbox_init_point": "https://sb.invalid"},
    )
    r = api.post(f"/api/v1/pagos/ordenes/{datos['orden']}", headers=datos["cliente"])
    assert r.status_code == 502
    # La preferencia quedó creada y referenciada: no es huérfana.
    with SessionLocal() as db:
        assert db.get(Pago, datos["pago"]).preference_id == "pref-1"


def test_crear_pago_dev_sin_init_point_usa_sandbox(api, datos, monkeypatch):
    _settings_pagos(monkeypatch, mp_access_token="APP_USR-x")
    monkeypatch.setattr(
        pagos_mp, "crear_preferencia",
        lambda *a, **k: {"id": "pref-1", "sandbox_init_point": "https://sb/pago"},
    )
    r = api.post(f"/api/v1/pagos/ordenes/{datos['orden']}", headers=datos["cliente"])
    assert r.status_code == 201 and r.json()["url_pago"] == "https://sb/pago"


def test_activar_cobro_prod_sin_init_point_da_502(api, datos, monkeypatch):
    _settings_sus(monkeypatch, environment="prod", boxly_mp_access_token="APP_USR-x")
    monkeypatch.setattr(mp, "listar_preapprovals", lambda *a, **k: {"results": []})
    monkeypatch.setattr(
        cliente_mp, "crear_preapproval",
        lambda *a, **k: {"id": "pre-1", "status": "pending",
                         "sandbox_init_point": "https://sb/pre"},
    )
    r = api.post("/api/v1/suscripcion/cobro-automatico", headers=datos["admin"])
    assert r.status_code == 502
    # La preapproval quedó referenciada en el taller: el barrido no la toca.
    taller = _taller()
    assert taller.mp_preapproval_id == "pre-1"


def test_activar_cobro_dev_sin_init_point_usa_sandbox(api, datos, monkeypatch):
    _settings_sus(monkeypatch)
    monkeypatch.setattr(mp, "listar_preapprovals", lambda *a, **k: {"results": []})
    monkeypatch.setattr(
        cliente_mp, "crear_preapproval",
        lambda *a, **k: {"id": "pre-1", "status": "pending",
                         "sandbox_init_point": "https://sb/pre"},
    )
    r = api.post("/api/v1/suscripcion/cobro-automatico", headers=datos["admin"])
    assert r.status_code == 201
    assert r.json()["init_point"] == "https://sb/pre"


# --- Webhook de pagos: 503 transitorio, 200 en los casos decididos -------------


def _webhook_pago(api, payment_id):
    return api.post("/api/v1/pagos/webhook",
                    json={"type": "payment", "data": {"id": str(payment_id)}})


def test_webhook_pagos_falla_transitoria_de_mp_responde_503(api, datos, monkeypatch):
    """Con la consulta a MP caída (red, 5xx, timeout) el webhook responde 503
    para que MP reintente: un 200 perdería el aviso para siempre."""
    _settings_pagos(monkeypatch, mp_access_token="token")

    def falla(*a, **k):
        raise mp.MercadoPagoError("timeout", transitorio=True)

    monkeypatch.setattr(pagos_mp, "obtener_pago", falla)
    assert _webhook_pago(api, "321").status_code == 503


def test_webhook_pagos_error_permanente_de_mp_responde_200(api, datos, monkeypatch):
    """Un 4xx de MP (p. ej. pago inexistente) es permanente: reintentar no
    cambia nada, el aviso se ignora con 200."""
    _settings_pagos(monkeypatch, mp_access_token="token")

    def falla(*a, **k):
        raise mp.MercadoPagoError("HTTP 404", transitorio=False)

    monkeypatch.setattr(pagos_mp, "obtener_pago", falla)
    assert _webhook_pago(api, "321").status_code == 200


def test_webhook_pagos_referencia_desconocida_responde_200(api, datos, monkeypatch):
    _settings_pagos(monkeypatch, mp_access_token="token")
    monkeypatch.setattr(
        pagos_mp, "obtener_pago",
        lambda *a, **k: {"id": "1", "status": "approved",
                         "transaction_amount": "1500.00",
                         "external_reference": "999999"},
    )
    assert _webhook_pago(api, "1").status_code == 200


def test_webhook_pagos_repetido_responde_200_y_no_duplica(api, datos, monkeypatch):
    _settings_pagos(monkeypatch, mp_access_token="token")
    with SessionLocal() as db:
        pago = db.get(Pago, datos["pago"])
        pago.estado = "aprobado"
        pago.payment_id = "555"
        db.commit()
    monkeypatch.setattr(
        pagos_mp, "obtener_pago",
        lambda *a, **k: {"id": "555", "status": "approved",
                         "transaction_amount": "1500.00",
                         "external_reference": str(datos["pago"])},
    )
    assert _webhook_pago(api, "555").status_code == 200
    assert _webhook_pago(api, "555").status_code == 200
    with SessionLocal() as db:
        assert db.get(Pago, datos["pago"]).estado == "aprobado"


# --- Webhook de suscripciones: 503 transitorio, 200 en los casos decididos -----


def _webhook_sus(api, tipo, data_id):
    return api.post("/api/v1/suscripcion/webhook",
                    json={"type": tipo, "data": {"id": data_id}})


def test_webhook_suscripcion_cobro_caido_responde_503(api, datos, monkeypatch):
    _settings_sus(monkeypatch)

    def falla(*a, **k):
        raise mp.MercadoPagoError("timeout", transitorio=True)

    monkeypatch.setattr(cliente_mp, "obtener_pago_autorizado", falla)
    r = _webhook_sus(api, "subscription_authorized_payment", "ap-1")
    assert r.status_code == 503


def test_webhook_suscripcion_preapproval_caida_responde_503(api, datos, monkeypatch):
    _settings_sus(monkeypatch)

    def falla(*a, **k):
        raise mp.MercadoPagoError("500 de MP", transitorio=True)

    monkeypatch.setattr(cliente_mp, "obtener_preapproval", falla)
    r = _webhook_sus(api, "subscription_preapproval", "pre-1")
    assert r.status_code == 503


def test_webhook_suscripcion_cobro_desconocido_responde_200(api, datos, monkeypatch):
    _settings_sus(monkeypatch)
    monkeypatch.setattr(
        cliente_mp, "obtener_pago_autorizado",
        lambda *a, **k: {"preapproval_id": "pre-xx", "external_reference": None,
                         "payment": {"id": "mp-9", "status": "approved"}},
    )
    r = _webhook_sus(api, "authorized_payment", "ap-9")
    assert r.status_code == 200


def test_webhook_suscripcion_cobro_repetido_es_idempotente(api, datos, monkeypatch):
    with SessionLocal() as db:
        taller = db.get(Taller, 1)
        taller.mp_preapproval_id = "pre-1"
        db.commit()
    _settings_sus(monkeypatch)
    monkeypatch.setattr(
        cliente_mp, "obtener_pago_autorizado",
        lambda *a, **k: {"preapproval_id": "pre-1", "status": "processed",
                         "payment": {"id": "777", "status": "approved",
                                     "transaction_amount": "299.00"}},
    )
    assert _webhook_sus(api, "authorized_payment", "ap-777").status_code == 200
    assert _webhook_sus(api, "authorized_payment", "ap-777").status_code == 200
    with SessionLocal() as db:
        filas = db.scalars(
            select(PagoSuscripcion).where(PagoSuscripcion.mp_payment_id == "777")
        ).all()
        assert len(filas) == 1
