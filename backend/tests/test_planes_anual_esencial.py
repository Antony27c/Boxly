"""Esencial con 2 personas y descuento anual por plan (tarea V3, decisión del
dueño para empujar a los talleres hacia Pro y Profesional)."""

import os
import subprocess
import sys
from datetime import timedelta
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect, text

from app.core.errores import LIMITE_PERSONAL
from app.core.security import create_access_token, hash_password
from app.core.suscripcion import hoy
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.main import app
from app.models import Plan, Taller, Usuario
from app.models.suscripcion import PLANES_INICIALES
from app.models.usuario import RolUsuario

RUTA_PLANES = "/api/v1/plataforma/planes"
PASSWORD = "Clave1234"


def _usuario(email, rol, activo=True):
    return Usuario(
        nombre="Usu",
        apellido="Prueba",
        email=email,
        password_hash=hash_password(PASSWORD),
        rol=rol,
        activo=activo,
    )


@pytest.fixture
def datos():
    """Taller 1 en Esencial con 2 de personal activo (admin y recepción) y un
    mecánico inactivo; más un superadmin."""
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        taller = db.get(Taller, 1)
        taller.plan_codigo = "esencial"
        taller.suscripcion_vence_en = hoy() + timedelta(days=30)
        sa = _usuario("sa@x.com", RolUsuario.superadmin)
        admin = _usuario("admin@x.com", RolUsuario.administrador)
        recepcion = _usuario("recep@x.com", RolUsuario.recepcion)
        inactivo = _usuario("inac@x.com", RolUsuario.mecanico, activo=False)
        db.add_all([sa, admin, recepcion, inactivo])
        db.commit()
        return {
            "sa": {"Authorization": "Bearer " + create_access_token(sa.id)},
            "admin": {"Authorization": "Bearer " + create_access_token(admin.id)},
            "inactivo": inactivo.id,
        }


@pytest.fixture
def api():
    with TestClient(app) as cliente:
        yield cliente


def _descuento(codigo):
    with SessionLocal() as db:
        return db.get(Plan, codigo).descuento_anual_pct


MSG_CUPO_2 = "Tu plan permite hasta 2 usuarios del personal. Pasá a un plan mayor para sumar más."


# --- Esencial con 2 personas -------------------------------------------------------


def test_planes_iniciales_esencial_con_2():
    limites = {codigo: maximo for codigo, _, _, maximo, _ in PLANES_INICIALES}
    assert limites == {"esencial": 2, "pro": 10, "profesional": None}


def test_alta_en_esencial_con_2_activos_da_409_limite_personal(api, datos):
    r = api.post(
        "/api/v1/users",
        headers=datos["admin"],
        json={
            "nombre": "Mec",
            "apellido": "Nuevo",
            "email": "mec@x.com",
            "password": PASSWORD,
            "rol": "mecanico",
        },
    )

    assert r.status_code == 409
    assert r.json() == {"detail": MSG_CUPO_2, "codigo": LIMITE_PERSONAL}


def test_reactivar_en_esencial_con_2_activos_tambien_da_409(api, datos):
    r = api.put(f"/api/v1/users/{datos['inactivo']}", headers=datos["admin"], json={"activo": True})

    assert r.status_code == 409
    assert r.json()["codigo"] == LIMITE_PERSONAL


def test_taller_con_mas_personal_no_pierde_a_nadie(api, datos):
    """El cupo solo bloquea altas: si ya había 3, siguen los 3 activos."""
    with SessionLocal() as db:
        db.add(_usuario("tercero@x.com", RolUsuario.mecanico))
        db.commit()

    s = api.get("/api/v1/suscripcion", headers=datos["admin"]).json()

    assert (s["personal_activo"], s["max_personal"]) == (3, 2)
    assert api.get("/api/v1/auth/me", headers=datos["admin"]).status_code == 200


# --- descuento_anual_pct -----------------------------------------------------------


def test_descuento_anual_arranca_vacio_y_lo_devuelven_las_dos_vistas(api, datos):
    plataforma = api.get(RUTA_PLANES, headers=datos["sa"]).json()
    publico = api.get("/api/v1/publico/planes").json()

    assert {p["codigo"]: p["descuento_anual_pct"] for p in plataforma} == {
        "esencial": None,
        "pro": None,
        "profesional": None,
    }
    assert all(p["descuento_anual_pct"] is None for p in publico)


def test_superadmin_edita_el_descuento_anual(api, datos):
    r = api.put(f"{RUTA_PLANES}/pro", headers=datos["sa"], json={"descuento_anual_pct": 15})
    assert r.status_code == 200, r.text
    assert r.json()["descuento_anual_pct"] == 15
    assert _descuento("pro") == 15

    publico = {p["codigo"]: p for p in api.get("/api/v1/publico/planes").json()}
    assert publico["pro"]["descuento_anual_pct"] == 15

    # Los extremos valen; null explícito lo saca.
    for valor in (0, 100, None):
        r = api.put(f"{RUTA_PLANES}/pro", headers=datos["sa"], json={"descuento_anual_pct": valor})
        assert r.status_code == 200, valor
        assert _descuento("pro") == valor


@pytest.mark.parametrize("valor", [-1, 101, 2.5, "diez"])
def test_descuento_fuera_de_0_a_100_da_422(api, datos, valor):
    r = api.put(f"{RUTA_PLANES}/pro", headers=datos["sa"], json={"descuento_anual_pct": valor})

    assert r.status_code == 422
    assert _descuento("pro") is None


def test_el_admin_de_un_taller_no_edita_el_descuento(api, datos):
    r = api.put(f"{RUTA_PLANES}/pro", headers=datos["admin"], json={"descuento_anual_pct": 50})

    assert r.status_code == 403
    assert _descuento("pro") is None


# --- Migración ---------------------------------------------------------------------


def _alembic(backend: Path, url: str, *args: str) -> None:
    r = subprocess.run(
        [sys.executable, "-m", "alembic", *args],
        cwd=backend,
        env={**os.environ, "DATABASE_URL": url},
        capture_output=True,
        text=True,
    )
    assert r.returncode == 0, r.stderr


def _max_esencial(motor) -> int | None:
    with motor.connect() as con:
        return con.execute(text("SELECT max_personal FROM planes WHERE codigo = 'esencial'")).scalar_one()


@pytest.mark.parametrize("previo,esperado", [(3, 2), (5, 5), (None, None)])
def test_migracion_baja_esencial_solo_si_seguia_en_3(tmp_path, previo, esperado):
    """Sube y baja: 3 pasa a 2 y vuelve; si el superadmin lo había cambiado (5 o
    sin límite), la migración no lo toca en ningún sentido."""
    backend = Path(__file__).resolve().parents[1]
    url = f"sqlite:///{(tmp_path / 'migraciones.db').as_posix()}"

    _alembic(backend, url, "upgrade", "b4e6d2f8a3c1")
    motor = create_engine(url)
    try:
        with motor.begin() as con:
            con.execute(text("UPDATE planes SET max_personal = :m WHERE codigo = 'esencial'"), {"m": previo})
    finally:
        motor.dispose()

    _alembic(backend, url, "upgrade", "d8f1a3c5b7e2")
    motor = create_engine(url)
    try:
        assert _max_esencial(motor) == esperado
        columnas = {c["name"] for c in inspect(motor).get_columns("planes")}
        assert "descuento_anual_pct" in columnas
        with motor.connect() as con:
            descuentos = con.execute(text("SELECT descuento_anual_pct FROM planes")).scalars().all()
        assert set(descuentos) == {None}
    finally:
        motor.dispose()

    _alembic(backend, url, "downgrade", "b4e6d2f8a3c1")
    motor = create_engine(url)
    try:
        assert _max_esencial(motor) == previo
        columnas = {c["name"] for c in inspect(motor).get_columns("planes")}
        assert "descuento_anual_pct" not in columnas
    finally:
        motor.dispose()
