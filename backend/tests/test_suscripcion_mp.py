"""Tests del cobro automático de suscripción con Mercado Pago (tarea S2).

El cliente HTTP de MP (app.api.v1.suscripcion_mp.cliente_mp) siempre se mockea:
ningún test llama a Mercado Pago de verdad.
"""
import hashlib
import hmac
from datetime import date, timedelta
from decimal import Decimal
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.api.v1.suscripcion_mp import cliente_mp, service
from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.main import app
from app.models import PagoSuscripcion, Taller, Usuario
from app.models.usuario import RolUsuario

SECRETO = "secreto-boxly-test"
BASE = "/api/v1/suscripcion"


@pytest.fixture
def datos():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        admin = Usuario(nombre="Admin", apellido="Uno", email="admin@x.com",
                        password_hash=hash_password("x"), rol=RolUsuario.administrador)
        recepcion = Usuario(nombre="Recep", apellido="Uno", email="recep@x.com",
                            password_hash=hash_password("x"), rol=RolUsuario.recepcion)
        mecanico = Usuario(nombre="Mec", apellido="Uno", email="mec@x.com",
                           password_hash=hash_password("x"), rol=RolUsuario.mecanico)
        db.add_all([admin, recepcion, mecanico])
        db.flush()
        taller2 = Taller(nombre="Taller Dos", estado="activo")
        db.add(taller2)
        db.flush()
        admin2 = Usuario(nombre="Admin", apellido="Dos", email="admin2@x.com",
                         password_hash=hash_password("x"), rol=RolUsuario.administrador,
                         taller_id=taller2.id)
        db.add(admin2)
        db.commit()
        ids = {"taller2": taller2.id, "admin2": admin2.id}
        headers = {
            "admin": {"Authorization": "Bearer " + create_access_token(admin.id)},
            "recepcion": {"Authorization": "Bearer " + create_access_token(recepcion.id)},
            "mecanico": {"Authorization": "Bearer " + create_access_token(mecanico.id)},
            "admin2": {"Authorization": "Bearer " + create_access_token(admin2.id)},
        }
        return {"headers": headers, "ids": ids}


@pytest.fixture
def api():
    with TestClient(app) as cliente:
        yield cliente


def _settings(monkeypatch, **cambios):
    """Settings de prueba para el service (sin tocar config.py)."""
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
    monkeypatch.setattr(service, "get_settings", lambda: fake)
    return fake


def _preapproval_mock(retorno=None, llamadas=None):
    def fake(token, **kwargs):
        if llamadas is not None:
            llamadas.append(kwargs)
        return retorno if retorno is not None else {
            "id": "pre-1",
            "init_point": "https://mp.test/init",
            "status": "pending",
        }
    return fake


def _taller(db, taller_id=1):
    return db.get(Taller, taller_id)


def _pagos(db, taller_id=None):
    stmt = select(PagoSuscripcion).order_by(PagoSuscripcion.id)
    if taller_id is not None:
        stmt = stmt.where(PagoSuscripcion.taller_id == taller_id)
    return list(db.scalars(stmt))


def _firma_mp(secret, data_id, request_id, ts):
    manifest = f"id:{data_id};request-id:{request_id};ts:{ts};"
    return hmac.new(secret.encode(), manifest.encode(), hashlib.sha256).hexdigest()


def _headers_firma(secret=SECRETO, data_id="777", request_id="req-1", ts="1700000000",
                   v1=None):
    v1 = v1 if v1 is not None else _firma_mp(secret, data_id, request_id, ts)
    return {
        "x-signature": f"ts={ts},v1={v1}",
        "x-request-id": request_id,
    }


def _webhook(api, tipo, data_id, headers=None):
    return api.post(
        f"{BASE}/webhook",
        json={"type": tipo, "data": {"id": data_id}},
        headers=headers or {},
    )


# --- Activar / cancelar ---------------------------------------------------------


def test_activar_devuelve_init_point_y_guarda_preapproval(api, datos, monkeypatch):
    _settings(monkeypatch)
    llamadas = []
    monkeypatch.setattr(cliente_mp, "crear_preapproval", _preapproval_mock(llamadas=llamadas))
    r = api.post(f"{BASE}/cobro-automatico", headers=datos["headers"]["admin"])
    assert r.status_code == 201
    assert r.json()["init_point"] == "https://mp.test/init"
    assert llamadas[0]["reason"] == "Boxly · plan Esencial · Taller principal"
    assert llamadas[0]["external_reference"] == "taller-1"
    assert llamadas[0]["monto"] == Decimal("35000.00")
    assert llamadas[0]["back_url"] == "http://front.test/suscripcion"
    with SessionLocal() as db:
        taller = _taller(db)
        assert taller.mp_preapproval_id == "pre-1"
        assert taller.cobro_automatico is False  # pending: se activa por webhook


def test_activar_sin_token_da_503(api, datos, monkeypatch):
    _settings(monkeypatch, boxly_mp_access_token=None)
    r = api.post(f"{BASE}/cobro-automatico", headers=datos["headers"]["admin"])
    assert r.status_code == 503
    assert r.json()["detail"] == "El cobro automático todavía no está configurado"


def test_cancelar_desactiva_y_limpia(api, datos, monkeypatch):
    _settings(monkeypatch)
    llamadas = []
    with SessionLocal() as db:
        taller = _taller(db)
        taller.mp_preapproval_id = "pre-9"
        taller.cobro_automatico = True
        db.commit()
    monkeypatch.setattr(
        cliente_mp, "cancelar_preapproval",
        lambda token, pid: llamadas.append((token, pid)) or {},
    )
    r = api.delete(f"{BASE}/cobro-automatico", headers=datos["headers"]["admin"])
    assert r.status_code == 200
    assert llamadas == [("tok-boxly", "pre-9")]
    with SessionLocal() as db:
        taller = _taller(db)
        assert taller.cobro_automatico is False
        assert taller.mp_preapproval_id is None


def test_cancelar_sin_preapproval_da_404(api, datos, monkeypatch):
    _settings(monkeypatch)
    r = api.delete(f"{BASE}/cobro-automatico", headers=datos["headers"]["admin"])
    assert r.status_code == 404


@pytest.mark.parametrize("rol", ["recepcion", "mecanico"])
def test_activar_y_cancelar_solo_admin(api, datos, monkeypatch, rol):
    _settings(monkeypatch)
    headers = datos["headers"][rol]
    assert api.post(f"{BASE}/cobro-automatico", headers=headers).status_code == 403
    assert api.delete(f"{BASE}/cobro-automatico", headers=headers).status_code == 403


def test_admin_de_suscripcion_suspendida_puede_activar(api, datos, monkeypatch):
    """Con la suscripción suspendida (>= 31 días) el admin igual puede pagar."""
    _settings(monkeypatch)
    monkeypatch.setattr(cliente_mp, "crear_preapproval", _preapproval_mock())
    with SessionLocal() as db:
        taller = _taller(db)
        taller.suscripcion_vence_en = date.today() - timedelta(days=40)
        db.commit()
    r = api.post(f"{BASE}/cobro-automatico", headers=datos["headers"]["admin"])
    assert r.status_code == 201
    assert r.json()["init_point"] == "https://mp.test/init"


# --- Webhook ---------------------------------------------------------------------


def test_webhook_firma_invalida_da_401(api, datos, monkeypatch):
    _settings(monkeypatch, boxly_mp_webhook_secret=SECRETO)
    r = _webhook(api, "authorized_payment", "777",
                 headers=_headers_firma(v1="0" * 64))
    assert r.status_code == 401


def test_webhook_sin_firma_da_401(api, datos, monkeypatch):
    _settings(monkeypatch, boxly_mp_webhook_secret=SECRETO)
    r = _webhook(api, "authorized_payment", "777")
    assert r.status_code == 401


def _prepara_cobro_api(monkeypatch, info_mp):
    """Settings con token y cliente MP mockeado para authorized_payment."""
    _settings(monkeypatch, boxly_mp_access_token="tok-boxly")
    monkeypatch.setattr(cliente_mp, "obtener_pago_autorizado", lambda *a, **k: info_mp)
    with SessionLocal() as db:
        taller = _taller(db)
        taller.mp_preapproval_id = "pre-1"
        taller.suscripcion_vence_en = date.today() - timedelta(days=10)  # solo_lectura
        db.commit()


def test_cobro_aprobado_extiende_y_desbloquea(api, datos, monkeypatch):
    info = {
        "id": 9001,
        "preapproval_id": "pre-1",
        "status": "processed",
        "transaction_amount": 15000.0,
        "payment": {"id": 555001, "status": "approved", "transaction_amount": 15000.0},
    }
    _prepara_cobro_api(monkeypatch, info)
    # Antes del pago el taller está en solo_lectura: no puede escribir.
    bloqueado = api.post("/api/v1/clientes", headers=datos["headers"]["admin"],
                         json={"nombre": "Ana", "apellido": "Prueba", "dni": "30111222"})
    assert bloqueado.status_code == 403
    r = _webhook(api, "authorized_payment", "777")
    assert r.status_code == 200
    with SessionLocal() as db:
        taller = _taller(db)
        pagos = _pagos(db, taller_id=1)
        assert len(pagos) == 1
        pago = pagos[0]
        assert pago.estado == "aprobado"
        assert pago.medio == "mercadopago"
        assert pago.mp_payment_id == "555001"
        assert pago.monto == Decimal("15000.00")
        assert taller.suscripcion_vence_en == pago.periodo_hasta
        assert taller.suscripcion_vence_en > date.today()
    # Después del pago el taller vuelve a poder escribir.
    libre = api.post("/api/v1/clientes", headers=datos["headers"]["admin"],
                     json={"nombre": "Ana", "apellido": "Prueba", "dni": "30111222"})
    assert libre.status_code in (200, 201)


def test_cobro_repetido_es_idempotente(api, datos, monkeypatch):
    info = {
        "id": 9001, "preapproval_id": "pre-1", "status": "processed",
        "payment": {"id": 555001, "status": "approved", "transaction_amount": 15000.0},
    }
    _prepara_cobro_api(monkeypatch, info)
    _webhook(api, "authorized_payment", "777")
    _webhook(api, "authorized_payment", "777")
    with SessionLocal() as db:
        pagos = _pagos(db, taller_id=1)
        assert len(pagos) == 1
        taller = _taller(db)
        # vencimiento = hoy - 10 → periodo_desde = max(vence_en + 1, hoy) = hoy,
        # aplicado una sola vez aunque el webhook llegó dos veces.
        assert pagos[0].periodo_desde == date.today()
        assert taller.suscripcion_vence_en == pagos[0].periodo_hasta


def test_cobro_rechazado_no_extiende(api, datos, monkeypatch):
    info = {
        "id": 9002, "preapproval_id": "pre-1", "status": "processed",
        "payment": {"id": 555002, "status": "rejected", "transaction_amount": 15000.0},
    }
    _prepara_cobro_api(monkeypatch, info)
    _webhook(api, "authorized_payment", "778")
    with SessionLocal() as db:
        pagos = _pagos(db, taller_id=1)
        assert len(pagos) == 1
        assert pagos[0].estado == "rechazado"
        assert pagos[0].mp_payment_id == "555002"
        taller = _taller(db)
        assert taller.suscripcion_vence_en == date.today() - timedelta(days=10)


def test_webhook_de_un_taller_no_toca_otro(api, datos, monkeypatch):
    _settings(monkeypatch, boxly_mp_access_token="tok-boxly")
    info = {
        "id": 9003, "preapproval_id": "pre-2", "status": "processed",
        "payment": {"id": 555003, "status": "approved", "transaction_amount": 30000.0},
    }
    monkeypatch.setattr(cliente_mp, "obtener_pago_autorizado", lambda *a, **k: info)
    with SessionLocal() as db:
        t1 = _taller(db, 1)
        t2 = _taller(db, datos["ids"]["taller2"])
        t1.mp_preapproval_id = "pre-1"
        t1.suscripcion_vence_en = date.today() - timedelta(days=10)
        t2.mp_preapproval_id = "pre-2"
        t2.plan_codigo = "pro"
        db.commit()
    _webhook(api, "authorized_payment", "779")
    with SessionLocal() as db:
        t1 = _taller(db, 1)
        t2 = _taller(db, datos["ids"]["taller2"])
        assert t1.suscripcion_vence_en == date.today() - timedelta(days=10)
        assert t2.suscripcion_vence_en is not None and t2.suscripcion_vence_en > date.today()
        pagos = _pagos(db)
        assert len(pagos) == 1
        assert pagos[0].taller_id == datos["ids"]["taller2"]
        assert pagos[0].monto == Decimal("30000.00")


def test_webhook_preapproval_actualiza_cobro_automatico(api, datos, monkeypatch):
    _settings(monkeypatch, boxly_mp_access_token="tok-boxly")
    monkeypatch.setattr(
        cliente_mp, "obtener_preapproval",
        lambda *a, **k: {"id": "pre-1", "status": "authorized",
                        "external_reference": "taller-1"},
    )
    with SessionLocal() as db:
        _taller(db).mp_preapproval_id = "pre-1"
        db.commit()
    r = _webhook(api, "preapproval", "pre-1")
    assert r.status_code == 200
    with SessionLocal() as db:
        assert _taller(db).cobro_automatico is True
    # Y si MP la cancela, vuelve a false.
    monkeypatch.setattr(
        cliente_mp, "obtener_preapproval",
        lambda *a, **k: {"id": "pre-1", "status": "cancelled",
                        "external_reference": "taller-1"},
    )
    _webhook(api, "preapproval", "pre-1")
    with SessionLocal() as db:
        assert _taller(db).cobro_automatico is False


def test_webhook_tipo_desconocido_se_ignora(api, datos, monkeypatch):
    _settings(monkeypatch, boxly_mp_access_token="tok-boxly")
    llamadas = []
    monkeypatch.setattr(cliente_mp, "obtener_preapproval",
                        lambda *a, **k: llamadas.append(a))
    monkeypatch.setattr(cliente_mp, "obtener_pago_autorizado",
                        lambda *a, **k: llamadas.append(a))
    r = _webhook(api, "otro_topic", "123")
    assert r.status_code == 200
    assert llamadas == []


# --- Simulador -------------------------------------------------------------------


def test_simular_aprobado_extiende(api, datos, monkeypatch):
    _settings(monkeypatch)
    r = api.post(f"{BASE}/simular-cobro", headers=datos["headers"]["admin"],
                 json={"estado": "aprobado"})
    assert r.status_code == 200
    assert r.json()["estado"] == "aprobado"
    with SessionLocal() as db:
        pagos = _pagos(db, taller_id=1)
        assert len(pagos) == 1
        assert pagos[0].estado == "aprobado"
        assert pagos[0].medio == "mercadopago"
        taller = _taller(db)
        assert taller.suscripcion_vence_en == pagos[0].periodo_hasta


def test_simular_rechazado_no_extiende(api, datos, monkeypatch):
    _settings(monkeypatch)
    with SessionLocal() as db:
        _taller(db).suscripcion_vence_en = date.today() + timedelta(days=5)
        db.commit()
    r = api.post(f"{BASE}/simular-cobro", headers=datos["headers"]["admin"],
                 json={"estado": "rechazado"})
    assert r.status_code == 200
    with SessionLocal() as db:
        pagos = _pagos(db, taller_id=1)
        assert len(pagos) == 1 and pagos[0].estado == "rechazado"
        assert _taller(db).suscripcion_vence_en == date.today() + timedelta(days=5)


@pytest.mark.parametrize("entorno,debug", [("prod", True), ("dev", False), ("prod", False)])
def test_simular_fuera_de_dev_debug_da_404(api, datos, monkeypatch, entorno, debug):
    _settings(monkeypatch, environment=entorno, debug=debug)
    r = api.post(f"{BASE}/simular-cobro", headers=datos["headers"]["admin"],
                 json={"estado": "aprobado"})
    assert r.status_code == 404


@pytest.mark.parametrize("rol", ["recepcion", "mecanico"])
def test_simular_solo_admin(api, datos, monkeypatch, rol):
    _settings(monkeypatch)
    r = api.post(f"{BASE}/simular-cobro", headers=datos["headers"][rol],
                 json={"estado": "aprobado"})
    assert r.status_code == 403


def test_simular_sin_token_funciona_en_dev_debug(api, datos, monkeypatch):
    _settings(monkeypatch, boxly_mp_access_token=None)
    r = api.post(f"{BASE}/simular-cobro", headers=datos["headers"]["admin"],
                 json={"estado": "aprobado"})
    assert r.status_code == 200


def test_simular_cobro_no_registra_usuario(api, datos, monkeypatch):
    """Un cobro de Mercado Pago (real o simulado) queda con registrado_por NULL."""
    _settings(monkeypatch)
    r = api.post(f"{BASE}/simular-cobro", headers=datos["headers"]["admin"],
                 json={"estado": "aprobado"})
    assert r.status_code == 200
    with SessionLocal() as db:
        pagos = _pagos(db, taller_id=1)
        assert len(pagos) == 1
        assert pagos[0].registrado_por_id is None


# --- Mismo cobro avisado dos veces (pendiente -> aprobado) ------------------------


def _info_cobro(status_mp, pago_id="555001", data_id=9001):
    return {
        "id": data_id,
        "preapproval_id": "pre-1",
        "status": "processed",
        "payment": {"id": pago_id, "status": status_mp,
                    "transaction_amount": 15000.0},
    }


def _prepara_taller_vencido(db):
    taller = _taller(db)
    taller.mp_preapproval_id = "pre-1"
    taller.suscripcion_vence_en = date.today() - timedelta(days=10)
    db.commit()


def test_cobro_pendiente_despues_aprobado_extiende(api, datos, monkeypatch):
    """MP avisa el mismo cobro dos veces: primero pendiente y después aprobado.
    La fila se actualiza (no se duplica) y el vencimiento se extiende recién
    cuando llega el aprobado."""
    _settings(monkeypatch, boxly_mp_access_token="tok-boxly")
    with SessionLocal() as db:
        _prepara_taller_vencido(db)
    respuestas = iter([_info_cobro("pending"), _info_cobro("approved")])
    monkeypatch.setattr(cliente_mp, "obtener_pago_autorizado",
                        lambda *a, **k: next(respuestas))

    _webhook(api, "authorized_payment", "9001")
    with SessionLocal() as db:
        pagos = _pagos(db, taller_id=1)
        assert len(pagos) == 1
        assert pagos[0].estado == "pendiente"
        # Todavía no extendió: el cobro no está aprobado.
        assert _taller(db).suscripcion_vence_en == date.today() - timedelta(days=10)

    _webhook(api, "authorized_payment", "9001")
    with SessionLocal() as db:
        pagos = _pagos(db, taller_id=1)
        assert len(pagos) == 1
        assert pagos[0].estado == "aprobado"
        taller = _taller(db)
        assert taller.suscripcion_vence_en == pagos[0].periodo_hasta
        assert taller.suscripcion_vence_en > date.today()


def test_cobro_aprobado_luego_rechazado_no_desfaz(api, datos, monkeypatch):
    """Decisión: aprobado y rechazado son estados finales. Si MP manda después
    un aviso contradictorio para el mismo cobro, no se deshace el pago ni se
    retrocede el vencimiento (un replay viejo no puede "despagar" un cobro)."""
    _settings(monkeypatch, boxly_mp_access_token="tok-boxly")
    with SessionLocal() as db:
        _prepara_taller_vencido(db)
    respuestas = iter([_info_cobro("approved"), _info_cobro("rejected")])
    monkeypatch.setattr(cliente_mp, "obtener_pago_autorizado",
                        lambda *a, **k: next(respuestas))

    _webhook(api, "authorized_payment", "9001")
    _webhook(api, "authorized_payment", "9001")
    with SessionLocal() as db:
        pagos = _pagos(db, taller_id=1)
        assert len(pagos) == 1
        assert pagos[0].estado == "aprobado"
        taller = _taller(db)
        assert taller.suscripcion_vence_en == pagos[0].periodo_hasta
        assert taller.suscripcion_vence_en > date.today()
