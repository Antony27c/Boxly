from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.main import app
from app.models import (
    AccesoSoporte,
    Auditoria,
    Cliente,
    ConfiguracionTaller,
    Orden,
    Taller,
    Usuario,
    Vehiculo,
)
from app.models.usuario import RolUsuario

PASSWORD = "Clave1234"
RUTA_LOGIN = "/api/v1/auth/login"


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
    """Dos talleres con personal y datos propios + un superadmin de plataforma."""
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        # Taller 1 con plan pro: el límite de personal se prueba en test_suscripciones.py
        db.get(Taller, 1).plan_codigo = "pro"
        norte = Taller(nombre="Taller Norte")
        db.add(norte)
        db.flush()

        sa = _usuario("Super", "sa@x.com", RolUsuario.superadmin)
        admin1 = _usuario("Admin", "admin1@x.com", RolUsuario.administrador)
        recep1 = _usuario("Recep", "recep1@x.com", RolUsuario.recepcion)
        mec1 = _usuario("Mec", "mec1@x.com", RolUsuario.mecanico)
        admin2 = _usuario("Admin2", "admin2@x.com", RolUsuario.administrador, norte.id)
        recep2 = _usuario("Recep2", "recep2@x.com", RolUsuario.recepcion, norte.id)

        cliente1 = Cliente(nombre="Juan", apellido="Perez", dni="10000001", email="juan@x.com")
        cliente2 = Cliente(
            nombre="Ana", apellido="Gomez", dni="20000002", email="ana@x.com",
            taller_id=norte.id,
        )
        db.add_all([sa, admin1, recep1, mec1, admin2, recep2, cliente1, cliente2])
        db.flush()

        cuenta1 = _usuario("Juan", "cuenta1@x.com", RolUsuario.cliente)
        cuenta1.cliente_id = cliente1.id
        cuenta2 = _usuario("Ana", "cuenta2@x.com", RolUsuario.cliente, norte.id)
        cuenta2.cliente_id = cliente2.id

        veh1 = Vehiculo(cliente_id=cliente1.id, patente="AAA111", marca="VW", modelo="Gol")
        veh2 = Vehiculo(
            cliente_id=cliente2.id, patente="BBB222", marca="Fiat", modelo="Uno",
            taller_id=norte.id,
        )
        db.add_all([cuenta1, cuenta2, veh1, veh2])
        db.flush()

        orden1 = Orden(
            cliente_id=cliente1.id, vehiculo_id=veh1.id, creado_por_id=admin1.id,
            codigo="OT-1001", estado="pendiente", descripcion_ingreso="Service 1",
        )
        orden2 = Orden(
            cliente_id=cliente2.id, vehiculo_id=veh2.id, creado_por_id=admin2.id,
            codigo="OT-2001", estado="pendiente", descripcion_ingreso="Service 2",
            taller_id=norte.id,
        )

        # Auditoría: solo cuenta el login exitoso de admin1 (los otros registros
        # son de otra ruta o fallidos, aunque sean más recientes).
        ahora = datetime.now(timezone.utc)
        login_admin1 = ahora - timedelta(days=10)
        auditorias = [
            Auditoria(
                usuario_email="admin1@x.com", metodo="POST", ruta=RUTA_LOGIN,
                estado_http=200, taller_id=1,
                creado_en=login_admin1,
            ),
            Auditoria(
                usuario_email="admin1@x.com", metodo="POST", ruta=RUTA_LOGIN,
                estado_http=401, taller_id=1,
                creado_en=ahora - timedelta(days=2),
            ),
            Auditoria(
                usuario_email="admin1@x.com", metodo="GET", ruta="/api/v1/users",
                estado_http=200, taller_id=1,
                creado_en=ahora - timedelta(days=1),
            ),
        ]
        # Un acceso de soporte vigente y uno revocado para el taller 1.
        accesos = [
            AccesoSoporte(
                taller_id=1, otorgado_por_id=admin1.id, motivo="Revisión de soporte",
                desde=ahora - timedelta(hours=1), hasta=ahora + timedelta(hours=23),
            ),
            AccesoSoporte(
                taller_id=1, motivo="Ya revocado",
                desde=ahora - timedelta(days=3), hasta=ahora - timedelta(days=2),
                revocado_en=ahora - timedelta(days=2, hours=1),
            ),
        ]
        db.add_all([orden1, orden2, *auditorias, *accesos])
        db.commit()

        usuarios = {
            "superadmin": sa,
            "admin1": admin1,
            "recep1": recep1,
            "mec1": mec1,
            "admin2": admin2,
            "recep2": recep2,
            "cuenta1": cuenta1,
            "cuenta2": cuenta2,
        }
        return {
            "ids": {k: u.id for k, u in usuarios.items()},
            "norte_id": norte.id,
            "login_admin1": login_admin1,
            "headers": {
                k: {"Authorization": "Bearer " + create_access_token(u.id)}
                for k, u in usuarios.items()
            },
        }


@pytest.fixture
def api():
    with TestClient(app) as cliente:
        yield cliente


def _body_alta(nombre_taller="Taller Sur", email="admin.sur@x.com"):
    return {
        "nombre": nombre_taller,
        "admin": {"nombre": "Admin", "apellido": "Sur", "email": email},
    }


def test_alta_taller_crea_taller_config_y_admin_que_puede_entrar(api, datos):
    h = datos["headers"]["superadmin"]
    r = api.post("/api/v1/plataforma/talleres", headers=h, json=_body_alta())
    assert r.status_code == 201, r.text
    cuerpo = r.json()
    assert cuerpo["admin_email"] == "admin.sur@x.com"
    temporal = cuerpo["password_temporal"]
    assert len(temporal) == 12
    assert any(c.isalpha() for c in temporal)
    assert any(c.isdigit() for c in temporal)
    assert cuerpo["taller"]["nombre"] == "Taller Sur"
    assert cuerpo["taller"]["estado"] == "activo"
    assert cuerpo["taller"]["personal"] == 1

    # En la base quedaron las tres filas, todas del taller nuevo.
    with SessionLocal() as db:
        taller_id = cuerpo["taller"]["id"]
        assert db.get(Taller, taller_id).nombre == "Taller Sur"
        config = db.query(ConfiguracionTaller).filter_by(taller_id=taller_id).one()
        assert config.nombre == "Taller Sur"
        admin = db.query(Usuario).filter_by(email="admin.sur@x.com").one()
        assert admin.taller_id == taller_id
        assert admin.rol == RolUsuario.administrador

    # La contraseña temporal sirve para entrar y el usuario queda en su taller.
    r = api.post(
        "/api/v1/auth/login",
        json={"email": "admin.sur@x.com", "password": temporal},
    )
    assert r.status_code == 200, r.text
    token = {"Authorization": "Bearer " + r.json()["access_token"]}
    assert api.get("/api/v1/users", headers=token).status_code == 200

    # Email repetido: 409.
    r = api.post("/api/v1/plataforma/talleres", headers=h, json=_body_alta())
    assert r.status_code == 409


def test_listado_talleres_conteos_y_sin_datos_de_clientes(api, datos):
    h = datos["headers"]["superadmin"]
    r = api.get("/api/v1/plataforma/talleres", headers=h)
    assert r.status_code == 200
    assert r.headers["X-Total-Count"] == "2"

    items = {t["id"]: t for t in r.json()}
    t1 = items[1]
    norte = items[datos["norte_id"]]

    # Conteos agregados por taller, sin filas de clientes.
    assert t1["personal"] == 3  # admin + recepción + mecánico (no la cuenta cliente)
    assert t1["clientes"] == 1
    assert t1["ordenes_mes"] == 1
    assert t1["ultimo_uso"] is not None
    assert t1["soporte_vigente_hasta"] is not None
    assert norte["personal"] == 2
    assert norte["clientes"] == 1
    assert norte["ordenes_mes"] == 1
    assert norte["soporte_vigente_hasta"] is None

    # La respuesta solo tiene agregados: ninguna clave con datos de clientes.
    claves = set(t1) | set(norte)
    assert not claves & {"dni", "telefono", "direccion", "cuit", "patente"}
    assert isinstance(t1["personal"], int)

    # Filtros: estado y q por nombre.
    r = api.post(f"/api/v1/plataforma/talleres/{datos['norte_id']}/suspender", headers=h)
    assert r.status_code == 200
    r = api.get("/api/v1/plataforma/talleres?estado=suspendido", headers=h)
    assert [t["id"] for t in r.json()] == [datos["norte_id"]]
    assert r.headers["X-Total-Count"] == "1"
    r = api.get("/api/v1/plataforma/talleres?q=principal", headers=h)
    assert [t["id"] for t in r.json()] == [1]
    r = api.get("/api/v1/plataforma/talleres?q=norte", headers=h)
    assert [t["id"] for t in r.json()] == [datos["norte_id"]]


def test_suspendery_reactivar_deja_al_personal_sin_acceso(api, datos):
    h = datos["headers"]["superadmin"]
    h2 = datos["headers"]["admin2"]
    norte_id = datos["norte_id"]

    r = api.post(f"/api/v1/plataforma/talleres/{norte_id}/suspender", headers=h)
    assert r.status_code == 200
    assert r.json()["estado"] == "suspendido"
    assert r.json()["suspendido_en"] is not None

    # Todo el personal del taller recibe 403 hasta que se reactive.
    for rol in ("admin2", "recep2", "cuenta2"):
        r = api.get("/api/v1/users", headers=datos["headers"][rol])
        assert r.status_code == 403, rol
        assert "suspendido" in r.json()["detail"]

    r = api.post(f"/api/v1/plataforma/talleres/{norte_id}/reactivar", headers=h)
    assert r.status_code == 200
    assert r.json()["estado"] == "activo"
    assert r.json()["suspendido_en"] is None
    assert api.get("/api/v1/users", headers=h2).status_code == 200


def test_detalle_incluye_personal_sin_clientes_y_accesos(api, datos):
    h = datos["headers"]["superadmin"]
    r = api.get("/api/v1/plataforma/talleres/1", headers=h)
    assert r.status_code == 200, r.text
    detalle = r.json()

    assert detalle["id"] == 1
    assert detalle["nombre"] == "Taller principal"

    # Personal: solo roles del taller, nunca la cuenta de cliente.
    personal = {p["email"]: p for p in detalle["personal"]}
    assert set(personal) == {"admin1@x.com", "recep1@x.com", "mec1@x.com"}
    assert set(personal["admin1@x.com"]) == {
        "id", "nombre", "apellido", "email", "rol", "activo", "ultimo_ingreso",
    }
    assert personal["admin1@x.com"]["rol"] == "administrador"
    # ultimo_ingreso: solo el login exitoso (no el 401 ni la otra ruta, que son
    # más recientes pero no corresponden).
    ultimo = datetime.fromisoformat(
        personal["admin1@x.com"]["ultimo_ingreso"].replace("Z", "+00:00")
    )
    assert ultimo.date() == datos["login_admin1"].date()
    assert personal["recep1@x.com"]["ultimo_ingreso"] is None

    # Accesos de soporte: el más nuevo primero (id descendente), con el
    # otorgante resuelto.
    accesos = detalle["accesos_soporte"]
    assert len(accesos) == 2
    revocado, vigente = accesos
    assert vigente["motivo"] == "Revisión de soporte"
    assert vigente["vigente"] is True
    assert vigente["otorgado_por"] == {"nombre": "Admin Taller", "email": "admin1@x.com"}
    assert revocado["motivo"] == "Ya revocado"
    assert revocado["vigente"] is False
    assert revocado["revocado_en"] is not None

    # Taller inexistente: 404.
    assert api.get("/api/v1/plataforma/talleres/9999", headers=h).status_code == 404


def test_restablecer_password_y_cerrar_sesiones_del_personal(api, datos):
    h = datos["headers"]["superadmin"]
    recep = datos["ids"]["recep1"]
    mec = datos["ids"]["mec1"]
    token_viejo = datos["headers"]["recep1"]["Authorization"]

    r = api.post(f"/api/v1/plataforma/usuarios/{recep}/restablecer-password", headers=h)
    assert r.status_code == 200, r.text
    temporal = r.json()["password_temporal"]
    assert len(temporal) == 12
    assert any(c.isalpha() for c in temporal)
    assert any(c.isdigit() for c in temporal)

    # El token viejo queda inválido y la temporal sirve para entrar.
    assert api.get("/api/v1/auth/me", headers={"Authorization": token_viejo}).status_code == 401
    r = api.post("/api/v1/auth/login", json={"email": "recep1@x.com", "password": temporal})
    assert r.status_code == 200, r.text

    # Cerrar sesiones solo sube token_version: la contraseña sigue sirviendo.
    token_mec = datos["headers"]["mec1"]["Authorization"]
    r = api.post(f"/api/v1/plataforma/usuarios/{mec}/cerrar-sesiones", headers=h)
    assert r.status_code == 200
    assert r.json()["detail"] == "Se cerraron las sesiones de mec1@x.com"
    assert api.get("/api/v1/auth/me", headers={"Authorization": token_mec}).status_code == 401
    r = api.post("/api/v1/auth/login", json={"email": "mec1@x.com", "password": PASSWORD})
    assert r.status_code == 200

    # Cuentas que no son personal del taller: 404 (cliente, superadmin, inexistente).
    for uid in (datos["ids"]["cuenta1"], datos["ids"]["superadmin"], 9999):
        assert api.post(
            f"/api/v1/plataforma/usuarios/{uid}/restablecer-password", headers=h
        ).status_code == 404
        assert api.post(
            f"/api/v1/plataforma/usuarios/{uid}/cerrar-sesiones", headers=h
        ).status_code == 404


def test_renombrar_taller(api, datos):
    h = datos["headers"]["superadmin"]
    norte_id = datos["norte_id"]
    r = api.put(
        f"/api/v1/plataforma/talleres/{norte_id}",
        headers=h,
        json={"nombre": "Taller Norte Grande"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["nombre"] == "Taller Norte Grande"
    with SessionLocal() as db:
        assert db.get(Taller, norte_id).nombre == "Taller Norte Grande"


def test_usuarios_del_taller_no_ven_ni_tocan_otros_talleres(api, datos):
    h1 = datos["headers"]["admin1"]
    ids = datos["ids"]

    # El admin del taller 1 solo ve el personal de su taller.
    r = api.get("/api/v1/users", headers=h1)
    assert r.status_code == 200
    emails = {u["email"] for u in r.json()}
    assert emails == {
        "admin1@x.com", "recep1@x.com", "mec1@x.com", "cuenta1@x.com",
    }
    assert "admin2@x.com" not in emails and "recep2@x.com" not in emails

    # Ni lectura, ni edición, ni borrado de usuarios del taller 2: 404.
    for uid in (ids["admin2"], ids["recep2"], ids["cuenta2"]):
        assert api.get(f"/api/v1/users/{uid}", headers=h1).status_code == 404
        assert api.put(
            f"/api/v1/users/{uid}", headers=h1, json={"nombre": "Intruso"}
        ).status_code == 404
        assert api.delete(f"/api/v1/users/{uid}", headers=h1).status_code == 404

    # El email es único en toda la plataforma: 409 aunque sea de otro taller.
    r = api.post(
        "/api/v1/users", headers=h1,
        json={
            "nombre": "Nuevo", "apellido": "User", "email": "admin2@x.com",
            "password": PASSWORD, "rol": "recepcion",
        },
    )
    assert r.status_code == 409

    # El admin gestiona todo el personal de su taller, incluidos otros admins.
    r = api.post(
        "/api/v1/users", headers=h1,
        json={
            "nombre": "Admin", "apellido": "Nuevo", "email": "admin1b@x.com",
            "password": PASSWORD, "rol": "administrador",
        },
    )
    assert r.status_code == 201
    assert r.json()["rol"] == "administrador"
    assert api.put(
        f"/api/v1/users/{ids['recep1']}", headers=h1, json={"rol": "administrador"}
    ).status_code == 200

    # Pero nadie del taller crea ni asigna superadmin.
    r = api.post(
        "/api/v1/users", headers=h1,
        json={
            "nombre": "Super", "apellido": "Admin", "email": "sa2@x.com",
            "password": PASSWORD, "rol": "superadmin",
        },
    )
    assert r.status_code == 403
    assert api.put(
        f"/api/v1/users/{ids['mec1']}", headers=h1, json={"rol": "superadmin"}
    ).status_code == 403


def test_plataforma_solo_para_superadmin(api, datos):
    ids = datos["ids"]
    norte_id = datos["norte_id"]

    for rol in ("admin1", "recep1", "mec1", "cuenta1"):
        h = datos["headers"][rol]
        assert api.get("/api/v1/plataforma/talleres", headers=h).status_code == 403
        assert api.post(
            "/api/v1/plataforma/talleres", headers=h,
            json=_body_alta("Taller X", f"alta-{rol}@x.com"),
        ).status_code == 403
        assert api.get(f"/api/v1/plataforma/talleres/{norte_id}", headers=h).status_code == 403
        assert api.post(
            f"/api/v1/plataforma/usuarios/{ids['recep1']}/cerrar-sesiones", headers=h
        ).status_code == 403

    # Sin token: 401. Con superadmin: 200.
    assert api.get("/api/v1/plataforma/talleres").status_code == 401
    assert api.get(
        "/api/v1/plataforma/talleres", headers=datos["headers"]["superadmin"]
    ).status_code == 200
