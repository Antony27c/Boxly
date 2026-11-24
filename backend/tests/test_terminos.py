"""Tests de P8: términos y acuerdo de tratamiento de datos (docs/Plataforma.md)."""

import pytest
from fastapi.testclient import TestClient

from app.api.v1.terminos.service import TERMINOS_VERSION
from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.main import app
from app.models import Cliente, Taller, Usuario
from app.models.usuario import RolUsuario

GET = "/api/v1/terminos"
POST = "/api/v1/terminos/aceptar"


@pytest.fixture
def datos():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        usuarios = {
            "administrador": Usuario(
                nombre="Admin", apellido="Taller", email="admin@x.com",
                password_hash=hash_password("x"), rol=RolUsuario.administrador,
            ),
            "recepcion": Usuario(
                nombre="Recep", apellido="Taller", email="recep@x.com",
                password_hash=hash_password("x"), rol=RolUsuario.recepcion,
            ),
            "mecanico": Usuario(
                nombre="Mec", apellido="Uno", email="mec1@x.com",
                password_hash=hash_password("x"), rol=RolUsuario.mecanico,
            ),
            "superadmin": Usuario(
                nombre="Super", apellido="Admin", email="sa@x.com",
                password_hash=hash_password("x"), rol=RolUsuario.superadmin,
            ),
        }
        cliente = Cliente(nombre="Juan", apellido="Perez", dni="10000001", email="juan@x.com")
        db.add_all([*usuarios.values(), cliente])
        db.flush()
        cuenta_cliente = Usuario(
            nombre="Juan", apellido="Perez", email="cuenta@x.com",
            password_hash=hash_password("x"), rol=RolUsuario.cliente,
            cliente_id=cliente.id,
        )
        db.add(cuenta_cliente)
        db.flush()

        taller2 = Taller(nombre="Taller dos")
        db.add(taller2)
        db.flush()
        admin_taller2 = Usuario(
            nombre="Admin", apellido="Dos", email="admin2@x.com",
            password_hash=hash_password("x"), rol=RolUsuario.administrador,
            taller_id=taller2.id,
        )
        db.add(admin_taller2)
        db.commit()

        todos = {**usuarios, "cliente": cuenta_cliente, "admin_taller2": admin_taller2}
        headers = {
            rol: {"Authorization": "Bearer " + create_access_token(u.id)}
            for rol, u in todos.items()
        }
        return {"headers": headers, "taller2_id": taller2.id}


@pytest.fixture
def api():
    with TestClient(app) as cliente:
        yield cliente


def _get(api, datos, rol):
    return api.get(GET, headers=datos["headers"][rol])


def _post(api, datos, rol):
    return api.post(POST, headers=datos["headers"][rol])


def test_get_terminos_antes_de_aceptar(api, datos):
    for rol in ("administrador", "recepcion", "mecanico"):
        r = _get(api, datos, rol)
        assert r.status_code == 200, f"{rol}: {r.status_code} -> {r.text[:200]}"
        cuerpo = r.json()
        assert cuerpo["version"] == TERMINOS_VERSION
        assert "BORRADOR" in cuerpo["texto"]
        assert "encargado del tratamiento" in cuerpo["texto"]
        assert cuerpo["aceptados_en"] is None
        assert cuerpo["aceptados_por"] is None


def test_get_solo_para_personal_del_taller(api, datos):
    assert _get(api, datos, "superadmin").status_code == 403
    assert _get(api, datos, "cliente").status_code == 403
    assert api.get(GET).status_code == 401


def test_aceptar_como_admin_guarda_version_y_usuario(api, datos):
    r = _post(api, datos, "administrador")
    assert r.status_code == 200, r.text[:300]
    cuerpo = r.json()
    assert cuerpo["version"] == TERMINOS_VERSION
    assert cuerpo["aceptados_en"] is not None
    assert cuerpo["aceptados_por"] == "admin@x.com"

    # El resto del personal ve la aceptación en el GET.
    for rol in ("recepcion", "mecanico"):
        cuerpo = _get(api, datos, rol).json()
        assert cuerpo["aceptados_en"] is not None
        assert cuerpo["aceptados_por"] == "admin@x.com"

    # Quedó guardado en el taller.
    with SessionLocal() as db:
        taller = db.get(Taller, 1)
        assert taller.terminos_version == TERMINOS_VERSION
        assert taller.terminos_aceptados_en is not None
        assert taller.terminos_aceptados_por_id is not None


def test_aceptar_es_idempotente(api, datos):
    primero = _post(api, datos, "administrador").json()
    segundo = _post(api, datos, "administrador").json()
    assert segundo["aceptados_en"] == primero["aceptados_en"]
    assert segundo["aceptados_por"] == primero["aceptados_por"]


def test_no_admin_no_puede_aceptar(api, datos):
    for rol in ("recepcion", "mecanico", "cliente", "superadmin"):
        assert _post(api, datos, rol).status_code == 403, rol
    # Y el taller sigue sin aceptar.
    assert _get(api, datos, "administrador").json()["aceptados_en"] is None


def test_un_taller_no_ve_la_aceptacion_de_otro(api, datos):
    # El taller 1 acepta.
    assert _post(api, datos, "administrador").status_code == 200

    # El taller 2 sigue pendiente.
    cuerpo = _get(api, datos, "admin_taller2").json()
    assert cuerpo["aceptados_en"] is None
    assert cuerpo["aceptados_por"] is None

    # Cuando el taller 2 acepta, cada uno ve su propia aceptación.
    assert _post(api, datos, "admin_taller2").status_code == 200
    uno = _get(api, datos, "administrador").json()
    dos = _get(api, datos, "admin_taller2").json()
    assert uno["aceptados_por"] == "admin@x.com"
    assert dos["aceptados_por"] == "admin2@x.com"
