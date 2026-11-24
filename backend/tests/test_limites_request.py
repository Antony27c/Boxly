"""Límites de tamaño de los requests y rate limit de la activación (S14b).

- El middleware LimiteTamanoBody corta con 413 los bodies que superan el límite
  de la ruta, contando los bytes reales del stream (un Content-Length mentiroso
  no sirve).
- La activación de cuenta tiene el mismo límite por IP que el login.
"""
import asyncio
import io

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.core.body_limit import LimiteTamanoBody
from app.core.rate_limit import configurar_rate_limit, limiter
from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.main import app
from app.models import Cliente, Orden, Usuario, Vehiculo
from app.models.usuario import RolUsuario

BODY_GRANDE = b'{"x":"' + b"0" * (100 * 1024) + b'"}'


@pytest.fixture
def datos(tmp_path, monkeypatch):
    # Las subidas escriben en un directorio descartable, no en uploads/ real.
    monkeypatch.setattr("app.api.v1.ordenes.service.UPLOADS_DIR", tmp_path)
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        admin = Usuario(
            nombre="Admin", apellido="Uno", email="admin@x.com",
            password_hash=hash_password("x"), rol=RolUsuario.administrador,
        )
        cliente = Cliente(nombre="Juan", apellido="Perez", dni="1", email="j@x.com")
        db.add_all([admin, cliente])
        db.commit()
        vehiculo = Vehiculo(
            cliente_id=cliente.id, patente="AB123CD",
            marca="Fiat", modelo="Cronos", anio=2020,
        )
        db.add(vehiculo)
        db.flush()
        orden = Orden(
            codigo="OT-LIM-1", cliente_id=cliente.id, vehiculo_id=vehiculo.id,
            creado_por_id=admin.id, estado="ingresado",
            descripcion_ingreso="Ruido en el motor",
        )
        db.add(orden)
        db.commit()
        return {
            "h_admin": {"Authorization": "Bearer " + create_access_token(admin.id)},
            "orden_id": orden.id,
            "tmp_path": tmp_path,
        }


@pytest.fixture
def api():
    with TestClient(app) as cliente:
        yield cliente


@pytest.fixture
def limiter_activo(monkeypatch):
    """Enciende el rate limit solo para este test y limpia los contadores al salir."""
    monkeypatch.setenv("RATE_LIMIT_ENABLED", "true")
    estado_previo = limiter.enabled
    configurar_rate_limit(app)
    limiter.reset()
    yield
    limiter.reset()
    limiter.enabled = estado_previo


# --- Tamaño máximo del body ------------------------------------------------------


@pytest.mark.parametrize(
    "ruta",
    [
        "/api/v1/pagos/webhook",
        "/api/v1/suscripcion/webhook",
        "/api/v1/publico/contacto",
        "/api/v1/auth/login",
    ],
)
def test_body_de_mas_de_64kb_da_413(api, datos, ruta):
    r = api.post(ruta, content=BODY_GRANDE,
                 headers={"Content-Type": "application/json"})
    assert r.status_code == 413


def test_ruta_normal_permite_mas_de_64kb_hasta_1mb(api, datos):
    """La activación no es ruta sensible de 64 KB: 100 KB pasa el middleware
    y llega a la app (acá falla por token inválido, no por tamaño)."""
    cuerpo = (
        b'{"padding":"' + b"0" * (100 * 1024) + b'",'
        b'"token":"xxxxxxxxxx","password":"Clave1234","confirmo_datos":true}'
    )
    r = api.post("/api/v1/auth/activacion", content=cuerpo,
                 headers={"Content-Type": "application/json"})
    assert r.status_code in (400, 422)


def test_body_de_mas_de_1mb_da_413_en_cualquier_ruta(api, datos):
    cuerpo = b'{"padding":"' + b"0" * (2 * 1024 * 1024) + b'"}'
    r = api.post("/api/v1/auth/activacion", content=cuerpo,
                 headers={"Content-Type": "application/json"})
    assert r.status_code == 413


def test_content_length_mentiroso_no_saltea_el_limite():
    """Content-Length chico pero stream grande: el middleware cuenta los bytes
    reales y corta con 413 sin llamar a la app."""

    class AppFalsa:
        def __init__(self):
            self.llamado = False

        async def __call__(self, scope, receive, send):
            self.llamado = True

    app_falsa = AppFalsa()
    middleware = LimiteTamanoBody(app_falsa)
    scope = {
        "type": "http",
        "method": "POST",
        "path": "/api/v1/pagos/webhook",
        "headers": [(b"content-length", b"10")],
    }
    mensajes = iter([
        {"type": "http.request", "body": b"0" * (70 * 1024), "more_body": False},
    ])

    async def receive():
        return next(mensajes)

    enviados = []

    async def send(mensaje):
        enviados.append(mensaje)

    asyncio.run(middleware(scope, receive, send))

    assert app_falsa.llamado is False
    assert enviados[0]["status"] == 413


def test_middleware_replay_el_body_intacto():
    """Con un body chico la app recibe exactamente los mismos bytes."""

    class AppFalsa:
        def __init__(self):
            self.cuerpo = None

        async def __call__(self, scope, receive, send):
            cuerpo = b""
            while True:
                mensaje = await receive()
                if mensaje["type"] != "http.request":
                    continue
                cuerpo += mensaje.get("body", b"")
                if not mensaje.get("more_body", False):
                    break
            self.cuerpo = cuerpo
            await send({"type": "http.response.start", "status": 200, "headers": []})
            await send({"type": "http.response.body", "body": b"ok"})

    app_falsa = AppFalsa()
    middleware = LimiteTamanoBody(app_falsa)
    scope = {
        "type": "http",
        "method": "POST",
        "path": "/api/v1/auth/login",
        "headers": [],
    }
    mensajes = iter([
        {"type": "http.request", "body": b'{"a":', "more_body": True},
        {"type": "http.request", "body": b"1}", "more_body": False},
    ])

    async def receive():
        return next(mensajes)

    async def send(mensaje):
        pass

    asyncio.run(middleware(scope, receive, send))

    assert app_falsa.cuerpo == b'{"a":1}'


# --- Subida de imágenes (límite propio más grande) --------------------------------


def test_subida_de_imagen_sigue_andando(api, datos):
    img = Image.new("RGB", (64, 48), (180, 40, 40))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    r = api.post(
        f"/api/v1/ordenes/{datos['orden_id']}/imagenes",
        headers=datos["h_admin"],
        files={"archivo": ("foto.jpg", buf.getvalue(), "image/jpeg")},
        data={"etapa": "ingresado"},
    )
    assert r.status_code == 201


# --- Límite de intentos en la activación ------------------------------------------


def test_sexto_intento_de_activacion_get_da_429(api, datos, limiter_activo):
    for _ in range(5):
        r = api.get("/api/v1/auth/activacion", params={"token": "token-cualquiera"})
        assert r.status_code == 400
    r = api.get("/api/v1/auth/activacion", params={"token": "token-cualquiera"})
    assert r.status_code == 429


def test_sexto_intento_de_activacion_post_da_429(api, datos, limiter_activo):
    cuerpo = {"token": "x" * 10, "password": "Clave1234", "confirmo_datos": True}
    for _ in range(5):
        r = api.post("/api/v1/auth/activacion", json=cuerpo)
        assert r.status_code == 400
    r = api.post("/api/v1/auth/activacion", json=cuerpo)
    assert r.status_code == 429
