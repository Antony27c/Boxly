"""HTTPS obligatorio en producción y X-Idempotency-Key en las preferencias de
Checkout Pro (tarea R3g, auditoría de Mercado Pago)."""

import io
import json
from datetime import timedelta
from decimal import Decimal
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.api.v1.pagos import mercadopago as pagos_mp
from app.api.v1.pagos import service as pagos_service
from app.core import mercadopago as mp
from app.core.config import Settings
from app.core.security import create_access_token, hash_password
from app.core.suscripcion import hoy
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.main import app
from app.models import Cliente, Orden, Pago, Taller, Usuario, Vehiculo
from app.models.usuario import RolUsuario

JWT_PROD = "un-secreto-de-produccion-bien-largo-y-aleatorio-0123456789"


def _settings_prod(**cambios) -> Settings:
    base = {
        "environment": "prod",
        "debug": False,
        "jwt_secret_key": JWT_PROD,
        "frontend_url": "https://boxly.test",
        "backend_public_url": "https://api.boxly.test",
    }
    return Settings(**{**base, **cambios})


# --- HTTPS en producción --------------------------------------------------------


@pytest.mark.parametrize(
    "campo,variable",
    [("frontend_url", "FRONTEND_URL"), ("backend_public_url", "BACKEND_PUBLIC_URL")],
)
@pytest.mark.parametrize("url", ["http://boxly.test", "boxly.test", "ftp://boxly.test"])
def test_produccion_rechaza_urls_publicas_sin_https(campo, variable, url):
    with pytest.raises(ValidationError) as error:
        _settings_prod(**{campo: url})
    assert f"{variable} tiene que usar https://" in str(error.value)


def test_produccion_acepta_https_y_backend_public_url_vacia():
    s = _settings_prod()
    assert (s.frontend_url, s.backend_public_url) == (
        "https://boxly.test",
        "https://api.boxly.test",
    )
    # Sin BACKEND_PUBLIC_URL no se manda notification_url: no hay nada que exigir.
    assert _settings_prod(backend_public_url=None).backend_public_url is None


def test_desarrollo_permite_http():
    s = Settings(
        environment="dev",
        frontend_url="http://localhost:5173",
        backend_public_url="http://localhost:8000",
    )
    assert s.frontend_url == "http://localhost:5173"


# --- X-Idempotency-Key en las preferencias -----------------------------------------


def test_request_suma_los_headers_sin_pisar_la_autorizacion(monkeypatch):
    enviados = []

    def urlopen(req, timeout):
        enviados.append(req)
        return io.BytesIO(json.dumps({"id": "pref-1"}).encode())

    monkeypatch.setattr(mp.urllib.request, "urlopen", urlopen)

    mp.request(
        "POST",
        "/checkout/preferences",
        "tok-real",
        {},
        headers={"X-Idempotency-Key": "pago-7", "Authorization": "Bearer otro"},
    )

    [req] = enviados
    assert req.get_header("X-idempotency-key") == "pago-7"
    assert req.get_header("Authorization") == "Bearer tok-real"
    assert req.get_header("Content-type") == "application/json"


@pytest.mark.parametrize("clave,headers", [("pago-7", {"X-Idempotency-Key": "pago-7"}), (None, None)])
def test_crear_preferencia_manda_la_clave_solo_si_hay(monkeypatch, clave, headers):
    llamadas = []
    monkeypatch.setattr(
        pagos_mp,
        "request",
        lambda metodo, ruta, token, body, **kw: llamadas.append((metodo, ruta, kw)) or {"id": "p"},
    )

    pagos_mp.crear_preferencia(
        "tok",
        titulo="Orden",
        monto=Decimal("10.00"),
        referencia="7",
        back_urls={"success": "https://f/ok", "failure": "https://f/x", "pending": "https://f/p"},
        idempotency_key=clave,
    )

    assert llamadas == [("POST", "/checkout/preferences", {"headers": headers})]


@pytest.fixture
def orden_pagable():
    """Orden lista del taller 1 con un pago pendiente y la cuenta del cliente."""
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        db.get(Taller, 1).suscripcion_vence_en = hoy() + timedelta(days=30)
        admin = Usuario(
            nombre="Admin",
            apellido="Uno",
            email="admin@x.com",
            password_hash=hash_password("x"),
            rol=RolUsuario.administrador,
        )
        cliente = Cliente(nombre="Juan", apellido="Perez", dni="12345678", email="juan@x.com")
        db.add_all([admin, cliente])
        db.flush()
        vehiculo = Vehiculo(cliente_id=cliente.id, patente="AB123CD", marca="Ford", modelo="Focus")
        cuenta = Usuario(
            nombre="Juan",
            apellido="Perez",
            email="cuenta@x.com",
            password_hash=hash_password("x"),
            rol=RolUsuario.cliente,
            cliente_id=cliente.id,
        )
        db.add_all([vehiculo, cuenta])
        db.flush()
        orden = Orden(
            cliente_id=cliente.id,
            vehiculo_id=vehiculo.id,
            creado_por_id=admin.id,
            codigo="ORD-IDEM-1",
            estado="listo",
            descripcion_ingreso="Frenos",
            costo_final=Decimal("1500.00"),
        )
        db.add(orden)
        db.flush()
        pago = Pago(orden_id=orden.id, monto=Decimal("1500.00"), estado="pendiente")
        db.add(pago)
        db.commit()
        return {
            "orden": orden.id,
            "pago": pago.id,
            "cliente": {"Authorization": "Bearer " + create_access_token(cuenta.id)},
        }


def test_reintento_tras_respuesta_perdida_usa_la_misma_clave(orden_pagable, monkeypatch):
    """Si la respuesta de MP se pierde, el reintento manda la misma clave
    (pago-<id>) y MP devuelve la misma preferencia en vez de crear otra."""
    fake = SimpleNamespace(
        debug=True,
        environment="dev",
        mp_access_token="APP_USR-x",
        frontend_url="http://front.test",
        backend_public_url=None,
    )
    monkeypatch.setattr(pagos_service, "get_settings", lambda: fake)
    claves = []

    def crear_preferencia(token, **kw):
        claves.append(kw["idempotency_key"])
        if len(claves) == 1:
            raise pagos_mp.MercadoPagoError("timeout", transitorio=True)
        return {"id": "pref-1", "init_point": "https://mp/pago"}

    monkeypatch.setattr(pagos_mp, "crear_preferencia", crear_preferencia)
    ruta = f"/api/v1/pagos/ordenes/{orden_pagable['orden']}"

    with TestClient(app) as api:
        perdido = api.post(ruta, headers=orden_pagable["cliente"])
        reintento = api.post(ruta, headers=orden_pagable["cliente"])

    assert perdido.status_code == 502
    assert reintento.status_code == 201, reintento.text
    assert claves == [f"pago-{orden_pagable['pago']}"] * 2
    with SessionLocal() as db:
        assert db.get(Pago, orden_pagable["pago"]).preference_id == "pref-1"
