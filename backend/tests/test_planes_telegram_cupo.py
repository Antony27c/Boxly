"""Telegram automático en Pro y Profesional, y cupo de facturas ARCA por plan
(docs/Oferta.md, secciones 1 y 4; tarea PL1)."""

import json
import os
import subprocess
import sys
from datetime import timedelta
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect, text

from app.core.funciones import FUNCION_TELEGRAM_AUTOMATICO, FUNCIONES
from app.core.security import create_access_token, hash_password
from app.core.suscripcion import hoy
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.main import app
from app.models import Plan, Taller, Usuario
from app.models.usuario import RolUsuario

RUTA_PLANES = "/api/v1/plataforma/planes"


def _usuario(email, rol):
    return Usuario(
        nombre="Usu",
        apellido="Prueba",
        email=email,
        password_hash=hash_password("Clave1234"),
        rol=rol,
        activo=True,
    )


@pytest.fixture
def headers():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        db.get(Taller, 1).suscripcion_vence_en = hoy() + timedelta(days=30)
        usuarios = {
            "sa": _usuario("sa@x.com", RolUsuario.superadmin),
            "admin": _usuario("admin@x.com", RolUsuario.administrador),
            "mecanico": _usuario("mec@x.com", RolUsuario.mecanico),
        }
        db.add_all(usuarios.values())
        db.commit()
        return {
            clave: {"Authorization": "Bearer " + create_access_token(u.id)} for clave, u in usuarios.items()
        }


@pytest.fixture
def api():
    with TestClient(app) as cliente:
        yield cliente


def _cupo_guardado(codigo):
    with SessionLocal() as db:
        return db.get(Plan, codigo).cupo_facturas_arca


# --- telegram_automatico ---------------------------------------------------------


def test_telegram_es_una_funcion_conocida():
    assert FUNCION_TELEGRAM_AUTOMATICO == "telegram_automatico"
    assert FUNCION_TELEGRAM_AUTOMATICO in FUNCIONES


def test_pro_y_profesional_traen_telegram_y_esencial_no(api, headers):
    planes = {p["codigo"]: p for p in api.get(RUTA_PLANES, headers=headers["sa"]).json()}

    assert "telegram_automatico" in planes["pro"]["funciones"]
    assert "telegram_automatico" in planes["profesional"]["funciones"]
    assert "telegram_automatico" not in planes["esencial"]["funciones"]
    # Profesional hereda todo lo de Pro.
    assert set(planes["pro"]["funciones"]) <= set(planes["profesional"]["funciones"])


# --- cupo_facturas_arca ------------------------------------------------------------


def test_los_cupos_arrancan_pendientes(api, headers):
    planes = api.get(RUTA_PLANES, headers=headers["sa"]).json()

    assert {p["codigo"]: p["cupo_facturas_arca"] for p in planes} == {
        "esencial": None,
        "pro": None,
        "profesional": None,
    }


def test_superadmin_edita_el_cupo_de_facturas(api, headers):
    r = api.put(f"{RUTA_PLANES}/pro", headers=headers["sa"], json={"cupo_facturas_arca": 50})
    assert r.status_code == 200, r.text
    assert r.json()["cupo_facturas_arca"] == 50
    assert _cupo_guardado("pro") == 50

    # Editar otro campo no toca el cupo.
    r = api.put(f"{RUTA_PLANES}/pro", headers=headers["sa"], json={"nombre": "Pro"})
    assert r.json()["cupo_facturas_arca"] == 50

    # null explícito lo vuelve a dejar pendiente.
    r = api.put(f"{RUTA_PLANES}/pro", headers=headers["sa"], json={"cupo_facturas_arca": None})
    assert r.status_code == 200
    assert r.json()["cupo_facturas_arca"] is None
    assert _cupo_guardado("pro") is None


def test_cupo_negativo_da_422(api, headers):
    r = api.put(f"{RUTA_PLANES}/pro", headers=headers["sa"], json={"cupo_facturas_arca": -1})
    assert r.status_code == 422
    assert _cupo_guardado("pro") is None


def test_el_admin_de_un_taller_no_edita_el_cupo(api, headers):
    r = api.put(f"{RUTA_PLANES}/pro", headers=headers["admin"], json={"cupo_facturas_arca": 999})
    assert r.status_code == 403
    assert _cupo_guardado("pro") is None


def test_planes_publicos_devuelven_el_cupo(api, headers):
    api.put(f"{RUTA_PLANES}/profesional", headers=headers["sa"], json={"cupo_facturas_arca": 300})

    planes = {p["codigo"]: p for p in api.get("/api/v1/publico/planes").json()}

    assert planes["profesional"]["cupo_facturas_arca"] == 300
    assert planes["pro"]["cupo_facturas_arca"] is None


def test_el_mecanico_ve_el_cupo_pero_no_el_precio(api, headers):
    """El cupo no es dinero: no lo oculta sin_dinero."""
    api.put(f"{RUTA_PLANES}/esencial", headers=headers["sa"], json={"cupo_facturas_arca": 10})

    r = api.get("/api/v1/suscripcion", headers=headers["mecanico"])

    assert r.status_code == 200
    plan = r.json()["plan"]
    assert plan["cupo_facturas_arca"] == 10
    assert plan["precio_mensual"] is None


# --- Migración ---------------------------------------------------------------------


def test_migracion_suma_telegram_sin_pisar_ediciones_y_baja(tmp_path):
    """Corre alembic en una base SQLite aparte (subproceso: env.py lee DATABASE_URL)."""
    backend = Path(__file__).resolve().parents[1]
    url = f"sqlite:///{(tmp_path / 'migraciones.db').as_posix()}"
    env = {**os.environ, "DATABASE_URL": url}

    def alembic(*args):
        r = subprocess.run(
            [sys.executable, "-m", "alembic", *args],
            cwd=backend,
            env=env,
            capture_output=True,
            text=True,
        )
        assert r.returncode == 0, r.stderr

    def funciones(motor):
        with motor.connect() as con:
            filas = con.execute(text("SELECT codigo, funciones FROM planes")).all()
        return {codigo: json.loads(valor) for codigo, valor in filas}

    alembic("upgrade", "c7d4e8f2a1b9")
    motor = create_engine(url)
    try:
        # Ediciones previas del superadmin: Pro sin ARCA y Esencial con marca propia.
        with motor.begin() as con:
            con.execute(
                text("UPDATE planes SET funciones = :f WHERE codigo = 'pro'"),
                {"f": json.dumps(["gestion", "whatsapp_manual", "whatsapp_automatico"])},
            )
            con.execute(
                text("UPDATE planes SET funciones = :f WHERE codigo = 'esencial'"),
                {"f": json.dumps(["gestion", "whatsapp_manual", "marca_propia"])},
            )
        antes = funciones(motor)
    finally:
        motor.dispose()

    alembic("upgrade", "b4e6d2f8a3c1")
    motor = create_engine(url)
    try:
        despues = funciones(motor)
        assert despues["pro"] == [
            "gestion",
            "whatsapp_manual",
            "whatsapp_automatico",
            "telegram_automatico",
        ]
        assert despues["profesional"] == [
            "gestion",
            "whatsapp_manual",
            "whatsapp_automatico",
            "telegram_automatico",
            "arca",
            "recordatorios_service",
            "marca_propia",
        ]
        assert despues["esencial"] == antes["esencial"]
        assert "cupo_facturas_arca" in {c["name"] for c in inspect(motor).get_columns("planes")}
        with motor.connect() as con:
            cupos = con.execute(text("SELECT cupo_facturas_arca FROM planes")).scalars().all()
        assert set(cupos) == {None}
    finally:
        motor.dispose()

    alembic("downgrade", "c7d4e8f2a1b9")
    motor = create_engine(url)
    try:
        assert funciones(motor) == antes
        assert "cupo_facturas_arca" not in {c["name"] for c in inspect(motor).get_columns("planes")}
    finally:
        motor.dispose()
