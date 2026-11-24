"""IP del cliente confiable para la auditoría y los límites (tarea L8).

Un X-Forwarded-For mandado por el cliente no cambia nada. La IP real detrás de un
proxy la pone el ProxyHeadersMiddleware de uvicorn (lo que hacen --proxy-headers y
--forwarded-allow-ips / FORWARDED_ALLOW_IPS), y solo si la conexión viene de un
proxy de confianza: acá se arma la app igual que la sirve uvicorn.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from starlette.requests import Request
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

from app.core.ip import ip_cliente, ip_de_scope
from app.core.rate_limit import clave_por_ip, configurar_rate_limit, limiter
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.main import app

RUTA_CONTACTO = "/api/v1/publico/contacto"
RUTA_LOGIN = "/api/v1/auth/login"
CONTACTO = {"nombre": "Carlos", "taller": "El Pistón", "email": "carlos@piston.com"}
PROXY = ("10.0.0.2", 40000)
REDES_PROXY = "10.0.0.0/8"


@pytest.fixture(autouse=True)
def base_limpia():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)


@pytest.fixture
def api():
    with TestClient(app) as cliente:
        yield cliente


def _detras_de_proxy(conexion):
    """Cliente HTTP que llega desde ``conexion`` a la app servida como uvicorn con
    --forwarded-allow-ips=10.0.0.0/8."""
    return TestClient(ProxyHeadersMiddleware(app, trusted_hosts=REDES_PROXY), client=conexion)


@pytest.fixture
def limiter_activo(monkeypatch):
    monkeypatch.setenv("RATE_LIMIT_ENABLED", "true")
    estado_previo = limiter.enabled
    configurar_rate_limit(app)
    limiter.reset()
    yield
    limiter.reset()
    limiter.enabled = estado_previo


def _ips_auditadas(ruta):
    from app.models import Auditoria

    with SessionLocal() as db:
        return list(db.scalars(select(Auditoria.ip).where(Auditoria.ruta == ruta)))


def _ips_de_contacto():
    from app.models import SolicitudContacto

    with SessionLocal() as db:
        return list(db.scalars(select(SolicitudContacto.ip)))


def _request(client=None, headers=()):
    return Request({"type": "http", "client": client, "headers": list(headers)})


# --- La función central ----------------------------------------------------------

def test_ip_es_la_de_la_conexion_e_ignora_los_encabezados():
    falso = [(b"x-forwarded-for", b"1.2.3.4"), (b"x-real-ip", b"5.6.7.8")]
    req = _request(("203.0.113.9", 1234), falso)
    assert ip_cliente(req) == "203.0.113.9"
    assert ip_de_scope(req.scope) == "203.0.113.9"
    assert clave_por_ip(req) == "203.0.113.9"


def test_sin_conexion_conocida_no_hay_ip():
    assert ip_cliente(_request(None, [(b"x-forwarded-for", b"1.2.3.4")])) is None
    assert clave_por_ip(_request(None)) == "sin-ip"


# --- Sin proxy: el X-Forwarded-For del cliente no cuenta -------------------------

def test_x_forwarded_for_falso_no_cambia_la_ip_auditada(api):
    r = api.post(RUTA_LOGIN, json={"email": "nadie@x.com", "password": "Mala1234"},
                 headers={"X-Forwarded-For": "1.2.3.4"})
    assert r.status_code == 401
    assert _ips_auditadas(RUTA_LOGIN) == ["testclient"]


def test_x_forwarded_for_falso_no_saltea_el_limite_del_contacto(api):
    for i in range(5):
        r = api.post(RUTA_CONTACTO, json=CONTACTO, headers={"X-Forwarded-For": f"9.9.9.{i}"})
        assert r.status_code == 201
    r = api.post(RUTA_CONTACTO, json=CONTACTO, headers={"X-Forwarded-For": "9.9.9.200"})
    assert r.status_code == 429
    assert set(_ips_de_contacto()) == {"testclient"}
    assert set(_ips_auditadas(RUTA_CONTACTO)) == {"testclient"}


def test_x_forwarded_for_falso_no_saltea_el_limite_del_login(api, limiter_activo):
    for i in range(5):
        r = api.post(RUTA_LOGIN, json={"email": "nadie@x.com", "password": "Mala1234"},
                     headers={"X-Forwarded-For": f"9.9.9.{i}"})
        assert r.status_code == 401
    r = api.post(RUTA_LOGIN, json={"email": "nadie@x.com", "password": "Mala1234"},
                 headers={"X-Forwarded-For": "9.9.9.200"})
    assert r.status_code == 429


# --- Detrás de un proxy de confianza: vale la IP que informa el proxy ------------

def test_desde_proxy_confiable_se_usa_el_encabezado():
    with _detras_de_proxy(PROXY) as api:
        assert api.post(RUTA_CONTACTO, json=CONTACTO,
                        headers={"X-Forwarded-For": "203.0.113.7"}).status_code == 201
    assert _ips_de_contacto() == ["203.0.113.7"]
    assert _ips_auditadas(RUTA_CONTACTO) == ["203.0.113.7"]


def test_desde_proxy_confiable_se_toma_la_ultima_ip_no_confiable():
    # El visitante mete una IP falsa al principio; el proxy agrega la real al final.
    with _detras_de_proxy(PROXY) as api:
        api.post(RUTA_CONTACTO, json=CONTACTO,
                 headers={"X-Forwarded-For": "1.2.3.4, 203.0.113.7"})
    assert _ips_de_contacto() == ["203.0.113.7"]


def test_desde_proxy_confiable_el_limite_es_por_visitante():
    with _detras_de_proxy(PROXY) as api:
        for _ in range(5):
            assert api.post(RUTA_CONTACTO, json=CONTACTO,
                            headers={"X-Forwarded-For": "203.0.113.7"}).status_code == 201
        assert api.post(RUTA_CONTACTO, json=CONTACTO,
                        headers={"X-Forwarded-For": "203.0.113.7"}).status_code == 429
        # Otro visitante detrás del mismo proxy tiene su propio cupo.
        assert api.post(RUTA_CONTACTO, json=CONTACTO,
                        headers={"X-Forwarded-For": "198.51.100.20"}).status_code == 201


def test_desde_una_ip_que_no_es_proxy_el_encabezado_se_ignora():
    with _detras_de_proxy(("198.51.100.1", 5000)) as api:
        api.post(RUTA_CONTACTO, json=CONTACTO, headers={"X-Forwarded-For": "1.2.3.4"})
    assert _ips_de_contacto() == ["198.51.100.1"]
    assert _ips_auditadas(RUTA_CONTACTO) == ["198.51.100.1"]
