import pytest
from fastapi.testclient import TestClient

from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.main import app
from app.models import Cliente, Usuario
from app.models.usuario import RolUsuario

MSG_GERENCIA = "Solo el superadmin puede gestionar administradores"
MSG_ULTIMO = "Tiene que quedar al menos un superadmin activo"
MSG_PROPIO = "No podés desactivar tu propio usuario"


@pytest.fixture
def datos():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        usuarios = {
            "superadmin": Usuario(
                nombre="Super", apellido="Admin", email="sa@x.com",
                password_hash=hash_password("x"), rol=RolUsuario.superadmin,
            ),
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
        "password": "Clave1234",
        "rol": rol,
    }


def test_superadmin_pasa_los_endpoints_de_administrador(api, datos):
    h = datos["headers"]["superadmin"]
    assert api.get("/api/v1/users", headers=h).status_code == 200
    assert api.get("/api/v1/users/mecanicos", headers=h).status_code == 200
    assert api.get("/api/v1/metricas/mecanicos", headers=h).status_code == 200


def test_admin_gestiona_roles_comunes_pero_no_gerencia(api, datos):
    h = datos["headers"]["administrador"]
    ids = datos["ids"]

    # Recepción y mecánico: crear, editar y desactivar como siempre.
    r = api.post("/api/v1/users", headers=h, json=_body_usuario("recepcion", "nuevo@x.com"))
    assert r.status_code == 201
    nuevo_id = r.json()["id"]
    assert api.put(f"/api/v1/users/{nuevo_id}", headers=h, json={"nombre": "Otro"}).status_code == 200
    assert api.delete(f"/api/v1/users/{nuevo_id}", headers=h).status_code == 200

    r = api.post("/api/v1/users", headers=h, json=_body_usuario("mecanico", "mec@x.com"))
    assert r.status_code == 201

    # No puede crear ni asignar roles de gerencia.
    for rol in ("administrador", "superadmin"):
        r = api.post("/api/v1/users", headers=h, json=_body_usuario(rol, f"{rol}@x.com"))
        assert r.status_code == 403
        assert r.json()["detail"] == MSG_GERENCIA

    # No puede editar ni desactivar cuentas de gerencia (borrarse a sí mismo
    # da 409 por la regla de autodesactivación, está en su propio test).
    for objetivo in ("administrador", "superadmin"):
        assert api.put(
            f"/api/v1/users/{ids[objetivo]}", headers=h, json={"nombre": "Otro"}
        ).status_code == 403
    r = api.delete(f"/api/v1/users/{ids['superadmin']}", headers=h)
    assert r.status_code == 403
    assert r.json()["detail"] == MSG_GERENCIA

    # Tampoco puede ascender a alguien a gerencia.
    for rol in ("administrador", "superadmin"):
        r = api.put(f"/api/v1/users/{ids['recepcion']}", headers=h, json={"rol": rol})
        assert r.status_code == 403
        assert r.json()["detail"] == MSG_GERENCIA


def test_superadmin_gestiona_cuentas_de_gerencia(api, datos):
    h = datos["headers"]["superadmin"]
    ids = datos["ids"]

    r = api.post("/api/v1/users", headers=h, json=_body_usuario("administrador", "admin2@x.com"))
    assert r.status_code == 201
    assert r.json()["rol"] == "administrador"

    assert api.put(
        f"/api/v1/users/{ids['administrador']}", headers=h, json={"nombre": "Admin Nuevo"}
    ).status_code == 200
    assert api.put(
        f"/api/v1/users/{ids['recepcion']}", headers=h, json={"rol": "superadmin"}
    ).status_code == 200


def test_no_se_puede_dejar_sin_superadmin_activo(api, datos):
    h = datos["headers"]["superadmin"]
    sa = datos["ids"]["superadmin"]

    # Es el único superadmin activo: no se puede desactivar ni cambiarle el rol.
    for payload in ({"activo": False}, {"rol": "administrador"}):
        r = api.put(f"/api/v1/users/{sa}", headers=h, json=payload)
        assert r.status_code == 409
    # El borrado propio ya lo frena la regla de autodesactivación (también 409).
    assert api.delete(f"/api/v1/users/{sa}", headers=h).status_code == 409

    # Con un segundo superadmin activo sí se puede mover la cuenta.
    r = api.post("/api/v1/users", headers=h, json=_body_usuario("superadmin", "sa2@x.com"))
    assert r.status_code == 201
    sa2 = r.json()["id"]

    # El segundo superadmin desactiva al primero y queda él como último:
    # a partir de ahí tampoco se lo puede desactivar ni degradar.
    with SessionLocal() as db:
        token_sa2 = create_access_token(db.get(Usuario, sa2).id)
    h2 = {"Authorization": f"Bearer {token_sa2}"}
    assert api.delete(f"/api/v1/users/{sa}", headers=h2).status_code == 200

    r = api.delete(f"/api/v1/users/{sa2}", headers=h2)
    assert r.status_code == 409
    r = api.put(f"/api/v1/users/{sa2}", headers=h2, json={"rol": "administrador"})
    assert r.status_code == 409
    assert r.json()["detail"] == MSG_ULTIMO


def test_nadie_puede_desactivarse_a_si_mismo(api, datos):
    sa = datos["ids"]["superadmin"]
    admin = datos["ids"]["administrador"]

    r = api.delete(f"/api/v1/users/{sa}", headers=datos["headers"]["superadmin"])
    assert r.status_code == 409
    assert r.json()["detail"] == MSG_PROPIO

    r = api.put(
        f"/api/v1/users/{sa}", headers=datos["headers"]["superadmin"], json={"activo": False}
    )
    assert r.status_code == 409
    assert r.json()["detail"] == MSG_PROPIO

    # El admin tampoco puede borrarse a sí mismo (aunque no pueda gestionar gerencia).
    r = api.delete(f"/api/v1/users/{admin}", headers=datos["headers"]["administrador"])
    assert r.status_code == 409
    assert r.json()["detail"] == MSG_PROPIO


def test_restablecer_password_devuelve_clave_usable_e_invalida_sesiones(api, datos):
    h = datos["headers"]["superadmin"]
    recep = datos["ids"]["recepcion"]
    token_viejo = datos["headers"]["recepcion"]["Authorization"]

    r = api.post(f"/api/v1/admin/usuarios/{recep}/restablecer-password", headers=h)
    assert r.status_code == 200
    temporal = r.json()["password_temporal"]
    assert len(temporal) == 12
    assert any(c.isalpha() for c in temporal)
    assert any(c.isdigit() for c in temporal)

    # El token viejo queda inválido y la contraseña temporal sirve para entrar.
    assert api.get("/api/v1/auth/me", headers={"Authorization": token_viejo}).status_code == 401
    r = api.post("/api/v1/auth/login", json={"email": "recep@x.com", "password": temporal})
    assert r.status_code == 200
    assert r.json()["usuario"]["email"] == "recep@x.com"


def test_cerrar_sesiones_invalida_el_token_viejo(api, datos):
    h = datos["headers"]["superadmin"]
    mec = datos["ids"]["mecanico"]
    token_viejo = datos["headers"]["mecanico"]["Authorization"]

    r = api.post(f"/api/v1/admin/usuarios/{mec}/cerrar-sesiones", headers=h)
    assert r.status_code == 200
    assert r.json()["detail"] == "Se cerraron las sesiones de mec1@x.com"

    assert api.get("/api/v1/auth/me", headers={"Authorization": token_viejo}).status_code == 401
    # La contraseña no cambió: puede volver a entrar.
    r = api.post("/api/v1/auth/login", json={"email": "mec1@x.com", "password": "x"})
    assert r.status_code == 200


def test_rutas_admin_usuarios_solo_para_superadmin(api, datos):
    sa = datos["ids"]["superadmin"]
    for rol in ("administrador", "recepcion", "mecanico", "cliente"):
        h = datos["headers"][rol]
        assert api.post(
            f"/api/v1/admin/usuarios/{sa}/restablecer-password", headers=h
        ).status_code == 403
        assert api.post(
            f"/api/v1/admin/usuarios/{sa}/cerrar-sesiones", headers=h
        ).status_code == 403

    # Sin token: 401. Con superadmin y usuario inexistente: 404.
    assert api.post(f"/api/v1/admin/usuarios/{sa}/cerrar-sesiones").status_code == 401
    h = datos["headers"]["superadmin"]
    assert api.post("/api/v1/admin/usuarios/9999/restablecer-password", headers=h).status_code == 404
    assert api.post("/api/v1/admin/usuarios/9999/cerrar-sesiones", headers=h).status_code == 404
