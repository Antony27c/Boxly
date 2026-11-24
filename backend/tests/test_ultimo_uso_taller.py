"""Último uso del taller en /plataforma/talleres (U2).

El login se audita sin token, así que el middleware resuelve el taller_id
del usuario por el email del body cuando el ingreso es exitoso. Las filas
de auditoría con soporte=true (superadmin en modo soporte) no cuentan
como uso del taller. El resumen también expone max_personal del plan.
"""

from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.main import app
from app.models import AccesoSoporte, Auditoria, Taller, Usuario
from app.models.usuario import RolUsuario

PASSWORD = "Clave1234"


def _usuario(nombre, email, rol, taller_id=None):
    return Usuario(
        nombre=nombre,
        apellido="Taller",
        email=email,
        password_hash=hash_password(PASSWORD),
        rol=rol,
        taller_id=taller_id,
        activo=True,
    )


@pytest.fixture
def datos():
    """Tres talleres en planes esencial/pro/profesional + superadmin y admins."""
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        # El taller 1 lo crea el propio create_all (esencial por defecto).
        db.get(Taller, 1).plan_codigo = "esencial"
        norte = Taller(nombre="Taller Norte", plan_codigo="pro")
        sur = Taller(nombre="Taller Sur", plan_codigo="profesional")
        db.add_all([norte, sur])
        db.flush()

        sa = _usuario("Super", "sa@x.com", RolUsuario.superadmin)
        admin1 = _usuario("Admin", "admin1@x.com", RolUsuario.administrador)
        admin2 = _usuario("Admin2", "admin2@x.com", RolUsuario.administrador, norte.id)
        db.add_all([sa, admin1, admin2])
        db.commit()

        usuarios = {"superadmin": sa, "admin1": admin1, "admin2": admin2}
        return {
            "ids": {k: u.id for k, u in usuarios.items()},
            "norte_id": norte.id,
            "sur_id": sur.id,
            "headers": {
                k: {"Authorization": "Bearer " + create_access_token(u.id)}
                for k, u in usuarios.items()
            },
        }


@pytest.fixture
def api():
    with TestClient(app) as cliente:
        yield cliente


def _resumenes(api, datos):
    r = api.get("/api/v1/plataforma/talleres", headers=datos["headers"]["superadmin"])
    assert r.status_code == 200
    return {t["id"]: t for t in r.json()}


def _login(api, email, password=PASSWORD):
    return api.post("/api/v1/auth/login", json={"email": email, "password": password})


def test_login_exitoso_actualiza_ultimo_uso(api, datos):
    antes = _resumenes(api, datos)[1]
    assert antes["ultimo_uso"] is None

    r = _login(api, "admin1@x.com")
    assert r.status_code == 200

    despues = _resumenes(api, datos)[1]
    assert despues["ultimo_uso"] is not None


def test_login_fallido_no_actualiza_ultimo_uso(api, datos):
    r = _login(api, "admin1@x.com", password="mala")
    assert r.status_code == 401

    resumen = _resumenes(api, datos)[1]
    assert resumen["ultimo_uso"] is None
    with SessionLocal() as db:
        fila = db.scalar(
            select(Auditoria).where(
                Auditoria.ruta == "/api/v1/auth/login",
                Auditoria.estado_http == 401,
            )
        )
    assert fila is not None and fila.taller_id is None


def test_login_guarda_taller_id_en_auditoria(api, datos):
    _login(api, "ADMIN1@x.com")  # el email auditado puede venir en mayúsculas
    with SessionLocal() as db:
        filas = db.scalars(
            select(Auditoria).where(
                Auditoria.ruta == "/api/v1/auth/login",
                Auditoria.estado_http == 200,
            )
        ).all()
    assert len(filas) == 1
    assert filas[0].taller_id == 1
    assert filas[0].soporte is False


def test_modo_soporte_no_actualiza_ultimo_uso(api, datos):
    ahora = datetime.now(timezone.utc)
    with SessionLocal() as db:
        db.add(AccesoSoporte(
            taller_id=1, otorgado_por_id=datos["ids"]["superadmin"],
            motivo="Revisión", desde=ahora - timedelta(hours=1),
            hasta=ahora + timedelta(hours=23),
        ))
        db.commit()

    headers = {
        **datos["headers"]["superadmin"],
        "X-Taller-Soporte": "1",
    }
    r = api.get("/api/v1/clientes", headers=headers)
    assert r.status_code == 200

    # La lectura en modo soporte quedó auditada con soporte=true y taller_id=1,
    # pero no cuenta como uso del taller.
    with SessionLocal() as db:
        soporte = db.scalar(
            select(Auditoria).where(
                Auditoria.soporte.is_(True),
                Auditoria.taller_id == 1,
            )
        )
    assert soporte is not None

    resumen = _resumenes(api, datos)[1]
    assert resumen["ultimo_uso"] is None


def test_listado_trae_max_personal(api, datos):
    resumenes = _resumenes(api, datos)
    assert resumenes[1]["max_personal"] == 3       # esencial
    assert resumenes[datos["norte_id"]]["max_personal"] == 10   # pro
    assert resumenes[datos["sur_id"]]["max_personal"] is None   # profesional
