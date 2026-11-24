"""Endurecimiento de seguridad de las rutas públicas (tarea S14).

Cubre la verificación de firma de los webhooks de Mercado Pago (frescura del
timestamp en producción y rechazo sin secreto configurado), la sanitización de
los ids que van a la API de MP, la idempotencia del cobro de suscripción y la
no enumeración del login.

El cliente HTTP de MP siempre se mockea: ningún test llama a Mercado Pago.
"""
import hashlib
import hmac
import time
from datetime import date, timedelta
from decimal import Decimal
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.api.v1.pagos import mercadopago
from app.api.v1.pagos import service as pagos_service
from app.api.v1.suscripcion_mp import cliente_mp
from app.api.v1.suscripcion_mp import service as sus_service
from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine, fijar_taller
from app.main import app
from app.models import PagoSuscripcion, Taller, Usuario
from app.models.usuario import RolUsuario

SECRETO_SUS = "secreto-boxly-test"
SECRETO_PAGOS = "secreto-pagos-test"
TS_VIEJO = "1700000000"  # noviembre 2023: una firma capturada hace años


@pytest.fixture
def datos():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        admin = Usuario(nombre="Admin", apellido="Uno", email="admin@x.com",
                        password_hash=hash_password("x"), rol=RolUsuario.administrador)
        taller2 = Taller(nombre="Taller Dos", estado="activo")
        db.add_all([admin, taller2])
        db.flush()
        admin2 = Usuario(nombre="Admin", apellido="Dos", email="admin2@x.com",
                         password_hash=hash_password("x"), rol=RolUsuario.administrador,
                         taller_id=taller2.id)
        db.add(admin2)
        db.commit()
        return {
            "headers": {"admin": {"Authorization": "Bearer " + create_access_token(admin.id)}},
            "ids": {"taller2": taller2.id},
        }


@pytest.fixture
def api():
    with TestClient(app) as cliente:
        yield cliente


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
    monkeypatch.setattr(sus_service, "get_settings", lambda: fake)
    return fake


def _settings_pagos(monkeypatch, **cambios):
    fake = SimpleNamespace(
        debug=True,
        environment="dev",
        mp_access_token="tok-pagos",
        mp_webhook_secret=None,
        frontend_url="http://front.test",
        backend_public_url=None,
    )
    for clave, valor in cambios.items():
        setattr(fake, clave, valor)
    monkeypatch.setattr(pagos_service, "get_settings", lambda: fake)
    return fake


def _firma(secret, data_id, request_id, ts):
    manifest = f"id:{data_id};request-id:{request_id};ts:{ts};"
    return hmac.new(secret.encode(), manifest.encode(), hashlib.sha256).hexdigest()


def _headers_firma(secret, data_id, request_id="req-1", ts=None):
    ts = ts if ts is not None else str(int(time.time()))
    return {
        "x-signature": f"ts={ts},v1={_firma(secret, data_id, request_id, ts)}",
        "x-request-id": request_id,
    }


# --- Webhook de suscripción: firma -------------------------------------------------


def test_suscripcion_prod_rechaza_firma_vieja(api, datos, monkeypatch):
    """Una firma válida pero con ts viejo (replay de un aviso capturado) → 401."""
    _settings_sus(monkeypatch, environment="prod",
                  boxly_mp_webhook_secret=SECRETO_SUS, boxly_mp_access_token="tok")
    r = api.post("/api/v1/suscripcion/webhook",
                 json={"type": "topic_desconocido", "data": {"id": "777"}},
                 headers=_headers_firma(SECRETO_SUS, "777", ts=TS_VIEJO))
    assert r.status_code == 401


def test_suscripcion_prod_sin_secreto_da_401(api, datos, monkeypatch):
    """En producción un webhook sin secreto configurado no se puede verificar."""
    _settings_sus(monkeypatch, environment="prod", boxly_mp_webhook_secret=None)
    r = api.post("/api/v1/suscripcion/webhook",
                 json={"type": "topic_desconocido", "data": {"id": "777"}})
    assert r.status_code == 401


def test_suscripcion_prod_sin_headers_da_401(api, datos, monkeypatch):
    _settings_sus(monkeypatch, environment="prod",
                  boxly_mp_webhook_secret=SECRETO_SUS)
    r = api.post("/api/v1/suscripcion/webhook",
                 json={"type": "topic_desconocido", "data": {"id": "777"}})
    assert r.status_code == 401


def test_suscripcion_prod_firma_fresca_pasa(api, datos, monkeypatch):
    _settings_sus(monkeypatch, environment="prod",
                  boxly_mp_webhook_secret=SECRETO_SUS, boxly_mp_access_token="tok")
    r = api.post("/api/v1/suscripcion/webhook",
                 json={"type": "topic_desconocido", "data": {"id": "777"}},
                 headers=_headers_firma(SECRETO_SUS, "777"))
    assert r.status_code == 200


def test_suscripcion_dev_sigue_aceptando_ts_viejo(api, datos, monkeypatch):
    """En desarrollo se aceptan firmas de prueba con ts arbitrario (como antes)."""
    _settings_sus(monkeypatch, environment="dev",
                  boxly_mp_webhook_secret=SECRETO_SUS, boxly_mp_access_token="tok")
    r = api.post("/api/v1/suscripcion/webhook",
                 json={"type": "topic_desconocido", "data": {"id": "777"}},
                 headers=_headers_firma(SECRETO_SUS, "777", ts=TS_VIEJO))
    assert r.status_code == 200


def test_suscripcion_data_id_raro_no_consulta_mp(api, datos, monkeypatch):
    """Un data.id con caracteres de ruta no llega a la API de MP."""
    _settings_sus(monkeypatch, boxly_mp_access_token="tok")
    llamadas = []
    monkeypatch.setattr(cliente_mp, "obtener_preapproval",
                        lambda *a, **k: llamadas.append(a))
    monkeypatch.setattr(cliente_mp, "obtener_pago_autorizado",
                        lambda *a, **k: llamadas.append(a))
    for raro in ("../x", "pre-1/../../v1/payments", "a" * 100, ""):
        r = api.post("/api/v1/suscripcion/webhook",
                     json={"type": "preapproval", "data": {"id": raro}})
        assert r.status_code == 200
    assert llamadas == []


# --- Webhook de pagos de los talleres: firma --------------------------------------


def _webhook_pagos(api, payment_id="123", headers=None):
    return api.post("/api/v1/pagos/webhook",
                    json={"type": "payment", "data": {"id": payment_id}},
                    headers=headers or {})


def test_pagos_prod_rechaza_firma_vieja(api, datos, monkeypatch):
    _settings_pagos(monkeypatch, environment="prod",
                    mp_webhook_secret=SECRETO_PAGOS, mp_access_token="tok")
    monkeypatch.setattr(mercadopago, "obtener_pago", lambda *a, **k: {})
    r = _webhook_pagos(api, headers=_headers_firma(SECRETO_PAGOS, "123", ts=TS_VIEJO))
    assert r.status_code == 401


def test_pagos_prod_sin_secreto_da_401(api, datos, monkeypatch):
    _settings_pagos(monkeypatch, environment="prod", mp_webhook_secret=None)
    r = _webhook_pagos(api)
    assert r.status_code == 401


def test_pagos_prod_firma_fresca_pasa(api, datos, monkeypatch):
    _settings_pagos(monkeypatch, environment="prod",
                    mp_webhook_secret=SECRETO_PAGOS, mp_access_token="tok")
    monkeypatch.setattr(mercadopago, "obtener_pago", lambda *a, **k: {})
    r = _webhook_pagos(api, headers=_headers_firma(SECRETO_PAGOS, "123"))
    assert r.status_code == 200


def test_pagos_dev_sigue_aceptando_ts_viejo(api, datos, monkeypatch):
    _settings_pagos(monkeypatch, environment="dev",
                    mp_webhook_secret=SECRETO_PAGOS, mp_access_token="tok")
    monkeypatch.setattr(mercadopago, "obtener_pago", lambda *a, **k: {})
    r = _webhook_pagos(api, headers=_headers_firma(SECRETO_PAGOS, "123", ts=TS_VIEJO))
    assert r.status_code == 200


# --- Clientes HTTP de MP: ids en la ruta ------------------------------------------


@pytest.mark.parametrize(
    "llamar",
    [
        lambda: cliente_mp.obtener_preapproval("tok", "../x"),
        lambda: cliente_mp.actualizar_preapproval("tok", "a/b", monto=Decimal("1")),
        lambda: cliente_mp.cancelar_preapproval("tok", "../../etc"),
        lambda: cliente_mp.obtener_pago_autorizado("tok", "x" * 200),
        lambda: mercadopago.obtener_preferencia("tok", "../x"),
        lambda: mercadopago.obtener_pago("tok", "12a3"),
    ],
)
def test_clientes_mp_rechazan_ids_raros_sin_llamar_a_mp(llamar):
    """La validación es previa al request: un id raro nunca sale a la red."""
    with pytest.raises(Exception) as exc:
        llamar()
    assert type(exc.value).__name__ == "MercadoPagoError"


# --- Idempotencia del cobro de suscripción -----------------------------------------


def _info_cobro_aprobado():
    return {
        "id": 9001,
        "preapproval_id": "pre-1",
        "status": "processed",
        "payment": {"id": 555001, "status": "approved", "transaction_amount": 15000.0},
    }


def _prepara_taller_con_cobro(db):
    taller = db.get(Taller, 1)
    taller.mp_preapproval_id = "pre-1"
    taller.suscripcion_vence_en = date.today() - timedelta(days=10)
    db.commit()


def test_cobro_duplicado_no_duplica_pago_ni_extension(api, datos, monkeypatch):
    """El mismo cobro notificado dos veces registra UN pago y extiende el
    vencimiento una sola vez.

    SQLite no permite una carrera de escritura real (un solo escritor a la vez),
    así que el test dispara los dos webhooks seguidos. La protección contra la
    carrera verdadera es el UNIQUE de mp_payment_id más el IntegrityError de
    _registrar_cobro, que en Postgres hace rollback y devuelve None.
    """
    _settings_sus(monkeypatch, boxly_mp_access_token="tok")
    monkeypatch.setattr(cliente_mp, "obtener_pago_autorizado",
                        lambda *a, **k: _info_cobro_aprobado())
    with SessionLocal() as db:
        _prepara_taller_con_cobro(db)
    for _ in range(2):
        r = api.post("/api/v1/suscripcion/webhook",
                     json={"type": "authorized_payment", "data": {"id": "9001"}})
        assert r.status_code == 200
    with SessionLocal() as db:
        pagos = list(db.scalars(select(PagoSuscripcion)))
        assert len(pagos) == 1
        taller = db.get(Taller, 1)
        assert taller.suscripcion_vence_en == pagos[0].periodo_hasta


def test_registrar_cobro_repetido_devuelve_none(datos):
    """A nivel de service: el segundo _registrar_cobro con el mismo
    mp_payment_id devuelve None y no toca el vencimiento."""
    with SessionLocal() as db:
        _prepara_taller_con_cobro(db)
        taller = db.get(Taller, 1)
        fijar_taller(db, taller.id)
        primero = sus_service._registrar_cobro(
            db, taller, monto=Decimal("15000.00"), estado="aprobado",
            mp_payment_id="555001", referencia="authorized_payment:9001",
        )
        segundo = sus_service._registrar_cobro(
            db, taller, monto=Decimal("15000.00"), estado="aprobado",
            mp_payment_id="555001", referencia="authorized_payment:9001",
        )
        assert primero is not None and segundo is None
        db.commit()


# --- Enumeración y errores públicos ----------------------------------------------


def test_login_no_enumera_emails(api, datos):
    """Email inexistente y email existente con contraseña mala: mismo 401."""
    r1 = api.post("/api/v1/auth/login",
                  json={"email": "noexiste@x.com", "password": "Clave1234"})
    r2 = api.post("/api/v1/auth/login",
                  json={"email": "admin@x.com", "password": "ClaveMala123"})
    assert r1.status_code == r2.status_code == 401
    assert r1.json() == r2.json()


def test_webhook_respuestas_no_filtran_detalles(api, datos, monkeypatch):
    """Un webhook rechazado responde siempre el mismo detalle genérico."""
    _settings_sus(monkeypatch, environment="prod", boxly_mp_webhook_secret=SECRETO_SUS)
    r = api.post("/api/v1/suscripcion/webhook",
                 json={"type": "authorized_payment", "data": {"id": "9001"}},
                 headers={"x-signature": "ts=1,v1=basura", "x-request-id": "r"})
    assert r.status_code == 401
    assert r.json()["detail"] == "Firma de webhook inválida"
