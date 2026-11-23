import pytest
from fastapi.testclient import TestClient

from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.main import app
from app.models import Cliente, Taller, Usuario
from app.models.usuario import RolUsuario

MSG_SIN_SUPERADMIN = "No se puede crear ni asignar el rol superadmin"
MSG_ULTIMO_ADMIN = "Tiene que quedar al menos un administrador activo en el taller"
MSG_PROPIO = "No podés desactivar tu propio usuario"

PASSWORD = "Clave1234"


@pytest.fixture
def datos():
    """Un taller con dos administradores, recepción, mecánico, una cuenta de
    cliente y un superadmin de plataforma (sin taller)."""
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        # el límite del plan se prueba en test_suscripciones.py
        db.get(Taller, 1).plan_codigo = "pro"
        usuarios = {
            "superadmin": Usuario(
                nombre="Super", apellido="Admin", email="sa@x.com",
                password_hash=hash_password("x"), rol=RolUsuario.superadmin,
            ),
            "administrador": Usuario(
                nombre="Admin", apellido="Uno", email="admin@x.com",
                password_hash=hash_password("x"), rol=RolUsuario.administrador,
            ),
            "admin2": Usuario(
                nombre="Admin", apellido="Dos", email="admin2@x.com",
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
        db.commit()
        ids = {rol: u.id for rol, u in usuarios.items()}
        ids["cliente"] = cuenta_cliente.id
        headers = {
            rol: {"Authorization": "Bearer " + create_access_token(u.id)}
            for rol, u in {**usuarios, "cliente": cuenta_cliente}.items()
        }
        return {"ids": ids, "headers": headers}


@pytest.fixture
def api():
    with TestClient(app) as cliente:
        yield cliente


def _body_usuario(rol, email):
    return {
        "nombre": "Nuevo",
        "apellido": "User",
        "email": email,
        "password": PASSWORD,
        "rol": rol,
    }


def test_superadmin_no_opera_las_rutas_del_taller(api, datos):
    """Las rutas de /users son del administrador del taller: el superadmin
    gestiona la plataforma por /plataforma, no por acá."""
    h = datos["headers"]["superadmin"]
    assert api.get("/api/v1/users", headers=h).status_code == 403
    assert api.post("/api/v1/users", headers=h, json=_body_usuario("recepcion", "x@x.com")).status_code == 403
    assert api.get("/api/v1/users/mecanicos", headers=h).status_code == 403
    # Las rutas viejas de cuentas de administración ya no existen.
    assert api.post(
        f"/api/v1/admin/usuarios/{datos['ids']['recepcion']}/cerrar-sesiones", headers=h
    ).status_code == 404


def test_admin_gestiona_todo_el_personal_de_su_taller(api, datos):
    h = datos["headers"]["administrador"]
    ids = datos["ids"]

    # Cualquier rol del taller, incluidos otros administradores.
    for rol in ("recepcion", "mecanico", "administrador"):
        r = api.post("/api/v1/users", headers=h, json=_body_usuario(rol, f"{rol}@x.com"))
        assert r.status_code == 201, (rol, r.text)

    assert api.put(
        f"/api/v1/users/{ids['admin2']}", headers=h, json={"nombre": "Admin Editado"}
    ).status_code == 200
    assert api.put(
        f"/api/v1/users/{ids['recepcion']}", headers=h, json={"rol": "administrador"}
    ).status_code == 200
    # Con dos administradores activos se puede desactivar al otro.
    assert api.delete(f"/api/v1/users/{ids['admin2']}", headers=h).status_code == 200


def test_nadie_del_taller_crea_ni_asigna_superadmin(api, datos):
    h = datos["headers"]["administrador"]
    ids = datos["ids"]

    r = api.post("/api/v1/users", headers=h, json=_body_usuario("superadmin", "sa2@x.com"))
    assert r.status_code == 403
    assert r.json()["detail"] == MSG_SIN_SUPERADMIN

    for objetivo in ("recepcion", "mecanico"):
        r = api.put(
            f"/api/v1/users/{ids[objetivo]}", headers=h, json={"rol": "superadmin"}
        )
        assert r.status_code == 403
        assert r.json()["detail"] == MSG_SIN_SUPERADMIN

    # El superadmin ni siquiera es visible para el taller: 404, no 403.
    assert api.put(
        f"/api/v1/users/{ids['superadmin']}", headers=h, json={"nombre": "Otro Nombre"}
    ).status_code == 404
    assert api.delete(f"/api/v1/users/{ids['superadmin']}", headers=h).status_code == 404


def test_ultimo_admin_activo_del_taller_protegido(api, datos):
    h = datos["headers"]["administrador"]
    ids = datos["ids"]

    # Con dos admins activos, degradar a uno está permitido (queda el otro).
    assert api.put(
        f"/api/v1/users/{ids['admin2']}", headers=h, json={"rol": "recepcion"}
    ).status_code == 200
    # Y desactivarlo también.
    assert api.delete(f"/api/v1/users/{ids['admin2']}", headers=h).status_code == 200

    # Ahora el actor es el último admin activo: no puede dejar el taller sin
    # administrador ni desactivarse (esta última da el error de autodesactivación).
    r = api.put(f"/api/v1/users/{ids['administrador']}", headers=h, json={"rol": "mecanico"})
    assert r.status_code == 409
    assert r.json()["detail"] == MSG_ULTIMO_ADMIN
    r = api.delete(f"/api/v1/users/{ids['administrador']}", headers=h)
    assert r.status_code == 409
    assert r.json()["detail"] == MSG_PROPIO


def test_nadie_puede_desactivarse_a_si_mismo(api, datos):
    admin = datos["ids"]["administrador"]
    h = datos["headers"]["administrador"]

    r = api.delete(f"/api/v1/users/{admin}", headers=h)
    assert r.status_code == 409
    assert r.json()["detail"] == MSG_PROPIO

    r = api.put(f"/api/v1/users/{admin}", headers=h, json={"activo": False})
    assert r.status_code == 409
    assert r.json()["detail"] == MSG_PROPIO
