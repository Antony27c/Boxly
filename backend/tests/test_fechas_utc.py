"""Fechas del servidor siempre en UTC con zona (tarea S12).

SQLite no guarda la zona: el tipo ``FechaHoraUTC`` (app.db.tipos) convierte a
UTC al guardar y devuelve ``datetime`` con ``tzinfo=UTC`` al leer, así la API
serializa ``+00:00`` y el frontend no tiene que adivinar.
"""
import re
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient

from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.db.tipos import FechaHoraUTC
from app.main import app
from app.models import Cliente, Usuario
from app.models.usuario import RolUsuario

ZONA = ZoneInfo("America/Argentina/Buenos_Aires")  # UTC-3
CON_ZONA = re.compile(r"(Z|[+-]\d{2}:?\d{2})$")


@pytest.fixture
def datos():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        admin = Usuario(nombre="Admin", apellido="Uno", email="admin@x.com",
                        password_hash=hash_password("x"), rol=RolUsuario.administrador)
        db.add(admin)
        db.commit()
        return {"admin": {"Authorization": "Bearer " + create_access_token(admin.id)}}


@pytest.fixture
def api():
    with TestClient(app) as cliente:
        yield cliente


def test_auditoria_devuelve_creado_en_con_zona(api, datos):
    api.post("/api/v1/clientes", headers=datos["admin"],
             json={"nombre": "Ana", "apellido": "Prueba", "dni": "30999888"})
    r = api.get("/api/v1/taller/auditoria", headers=datos["admin"])
    assert r.status_code == 200
    filas = r.json()
    assert filas, "la auditoría debería tener al menos la creación del cliente"
    assert CON_ZONA.search(filas[0]["creado_en"]), filas[0]["creado_en"]


def test_acceso_soporte_devuelve_fechas_con_zona(api, datos):
    r = api.post("/api/v1/soporte/accesos", headers=datos["admin"], json={"horas": 4})
    assert r.status_code in (200, 201)
    body = r.json()
    assert CON_ZONA.search(body["desde"]), body["desde"]
    assert CON_ZONA.search(body["hasta"]), body["hasta"]


def test_ida_y_vuelta_con_zona_mismo_instante():
    """Un datetime -03:00 se guarda en UTC y vuelve como el mismo instante."""
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    original = datetime(2026, 1, 10, 12, 0, tzinfo=ZONA)  # 15:00 UTC
    with SessionLocal() as db:
        cliente = Cliente(nombre="Ana", apellido="Prueba", dni="30999888",
                          creado_en=original)
        db.add(cliente)
        db.commit()
        cliente_id = cliente.id
    with SessionLocal() as db:
        vuelto = db.get(Cliente, cliente_id).creado_en
    assert vuelto.tzinfo is not None
    assert vuelto.utcoffset() == timedelta(0)
    assert vuelto == original
    assert vuelto.astimezone(ZONA).replace(tzinfo=None) == original.replace(tzinfo=None)


def test_datetime_naive_se_asume_utc():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    naive = datetime(2026, 1, 10, 15, 0)  # se interpreta como 15:00 UTC
    with SessionLocal() as db:
        cliente = Cliente(nombre="Ana", apellido="Prueba", dni="30999888",
                          creado_en=naive)
        db.add(cliente)
        db.commit()
        cliente_id = cliente.id
    with SessionLocal() as db:
        vuelto = db.get(Cliente, cliente_id).creado_en
    assert vuelto == datetime(2026, 1, 10, 15, 0, tzinfo=timezone.utc)


def test_decorator_convierte_a_utc():
    tipo = FechaHoraUTC()
    sqlite = SimpleNamespace(name="sqlite")
    original = datetime(2026, 1, 10, 12, 0, tzinfo=ZONA)
    guardado = tipo.process_bind_param(original, sqlite)
    # En SQLite queda la hora UTC sin zona (mismo formato de siempre).
    assert guardado == datetime(2026, 1, 10, 15, 0)
    assert guardado.tzinfo is None
    assert tipo.process_result_value(guardado, sqlite) == original
