"""Tests de la auditoría de acciones (tarea B2): el middleware ASGI registra
los POST/PUT/PATCH/DELETE de /api/v1 y el superadmin los consulta/exporta."""

import csv
import io
from datetime import datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

import app.core.auditoria as modulo_auditoria
from app.core.auditoria import _email_del_login
from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.main import app
from app.models import Auditoria, Cliente, Usuario
from app.models.usuario import RolUsuario

PASSWORD = "Clave1234"


@pytest.fixture
def datos():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        usuarios = {
            "superadmin": Usuario(
                nombre="Super", apellido="Admin", email="super@x.com",
                password_hash=hash_password(PASSWORD), rol=RolUsuario.superadmin,
            ),
            "administrador": Usuario(
                nombre="Admin", apellido="Taller", email="admin@x.com",
                password_hash=hash_password(PASSWORD), rol=RolUsuario.administrador,
            ),
            "recepcion": Usuario(
                nombre="Recep", apellido="Taller", email="recep@x.com",
                password_hash=hash_password(PASSWORD), rol=RolUsuario.recepcion,
            ),
            "mecanico": Usuario(
                nombre="Mec", apellido="Uno", email="mec@x.com",
                password_hash=hash_password(PASSWORD), rol=RolUsuario.mecanico,
            ),
        }
        cliente = Cliente(nombre="Juan", apellido="Perez", dni="10000001")
        db.add_all([*usuarios.values(), cliente])
        db.flush()
        cuenta_cliente = Usuario(
            nombre="Juan", apellido="Perez", email="cuenta@x.com",
            password_hash=hash_password(PASSWORD), rol=RolUsuario.cliente,
            cliente_id=cliente.id,
        )
        db.add(cuenta_cliente)
        db.commit()
        todos = {**usuarios, "cliente": cuenta_cliente}
        headers = {
            rol: {
                "Authorization": "Bearer "
                + create_access_token(u.id, {"email": u.email, "rol": u.rol.value})
            }
            for rol, u in todos.items()
        }
        return {"headers": headers, "usuarios": todos}


@pytest.fixture
def api():
    with TestClient(app) as cliente:
        yield cliente


def _filas() -> list[Auditoria]:
    with SessionLocal() as db:
        return list(db.scalars(select(Auditoria).order_by(Auditoria.id)).all())


def _insertar_fila(**campos) -> int:
    datos_fila = {
        "metodo": "POST",
        "ruta": "/api/v1/repuestos",
        "estado_http": 200,
    }
    datos_fila.update(campos)
    with SessionLocal() as db:
        fila = Auditoria(**datos_fila)
        db.add(fila)
        db.commit()
        db.refresh(fila)
        return fila.id


def _login(api, email, password):
    return api.post("/api/v1/auth/login", json={"email": email, "password": password})


def test_post_autenticado_deja_fila_con_usuario_entidad_y_estado(api, datos):
    r = api.post(
        "/api/v1/clientes",
        headers=datos["headers"]["administrador"],
        json={"nombre": "Nuevo", "apellido": "Cliente", "dni": "40000001"},
    )
    assert r.status_code == 201

    filas = [f for f in _filas() if f.ruta == "/api/v1/clientes"]
    assert len(filas) == 1
    fila = filas[0]
    assert fila.metodo == "POST"
    assert fila.entidad == "clientes"
    assert fila.estado_http == 201
    assert fila.usuario_id == datos["usuarios"]["administrador"].id
    assert fila.usuario_email == "admin@x.com"
    assert fila.rol == "administrador"
    # P2: cada fila guarda el taller del usuario que hizo la acción.
    assert fila.taller_id == 1
    assert fila.soporte is False
    assert fila.ip is not None


def test_get_no_deja_filas_de_auditoria(api, datos):
    antes = len(_filas())
    r = api.get("/api/v1/clientes", headers=datos["headers"]["administrador"])
    assert r.status_code == 200
    assert len(_filas()) == antes


def test_login_fallido_registra_email_sin_contrasena(api, datos):
    r = _login(api, "admin@x.com", "ClaveMala9")
    assert r.status_code == 401

    filas = [f for f in _filas() if f.ruta == "/api/v1/auth/login"]
    assert len(filas) == 1
    fila = filas[0]
    assert fila.metodo == "POST"
    assert fila.entidad == "auth"
    assert fila.estado_http == 401
    assert fila.usuario_email == "admin@x.com"
    assert fila.usuario_id is None
    assert fila.taller_id is None
    # La contraseña no queda en ningún campo de la fila.
    for campo in (
        "usuario_email", "usuario_id", "rol", "metodo", "ruta",
        "entidad", "detalle", "ip",
    ):
        assert "ClaveMala9" not in str(getattr(fila, campo) or "")


def test_login_exitoso_sigue_funcionando_y_se_audita(api, datos):
    r = _login(api, "admin@x.com", PASSWORD)
    assert r.status_code == 200
    assert r.json()["access_token"]

    fila = [f for f in _filas() if f.ruta == "/api/v1/auth/login"][0]
    assert fila.estado_http == 200
    assert fila.usuario_email == "admin@x.com"


def test_email_del_login_se_parsea_de_formulario():
    scope = {
        "headers": [(b"content-type", b"application/x-www-form-urlencoded")],
    }
    cuerpo = b"email=ana%40x.com&password=secreta123"
    assert _email_del_login(scope, cuerpo) == "ana@x.com"


def test_si_falla_la_escritura_la_respuesta_no_cambia(api, datos, monkeypatch):
    def _boom():
        raise RuntimeError("db caída")

    monkeypatch.setattr(modulo_auditoria, "SessionLocal", _boom)
    r = api.post(
        "/api/v1/repuestos",
        headers=datos["headers"]["administrador"],
        json={"codigo": "ACE-99", "nombre": "Aceite", "precio": 100, "stock": 3},
    )
    assert r.status_code == 201
    assert r.json()["codigo"] == "ACE-99"


# Desde P3 las rutas son /taller/auditoria* (administrador, su taller) y
# /plataforma/auditoria* (superadmin, filtro opcional taller_id).
PLATAFORMA_LISTA = "/api/v1/plataforma/auditoria"
PLATAFORMA_EXPORTAR = "/api/v1/plataforma/auditoria/exportar"
TALLER_LISTA = "/api/v1/taller/auditoria"
TALLER_EXPORTAR = "/api/v1/taller/auditoria/exportar"


def test_filtros_entidad_usuario_errores_y_fechas(api, datos):
    admin_id = datos["usuarios"]["administrador"].id
    mec_id = datos["usuarios"]["mecanico"].id
    hoy = datetime(2026, 1, 20, 12, 0, 0)
    id_clientes = _insertar_fila(
        entidad="clientes", usuario_id=admin_id, usuario_email="a@x.com",
        estado_http=201, creado_en=hoy,
    )
    id_repuestos = _insertar_fila(
        entidad="repuestos", usuario_id=mec_id, usuario_email="m@x.com",
        estado_http=404, creado_en=datetime(2026, 1, 10, 12, 0, 0),
    )
    id_ordenes = _insertar_fila(
        entidad="ordenes", usuario_id=None, estado_http=500,
        creado_en=datetime(2025, 12, 1, 12, 0, 0),
    )

    headers = datos["headers"]["superadmin"]

    def ids(**params):
        r = api.get(PLATAFORMA_LISTA, headers=headers, params=params)
        assert r.status_code == 200
        return [f["id"] for f in r.json()]

    assert ids(entidad="clientes") == [id_clientes]
    assert ids(usuario_id=mec_id) == [id_repuestos]
    assert set(ids(solo_errores=True)) == {id_repuestos, id_ordenes}
    assert ids(metodo="DELETE") == []
    assert set(ids(metodo="post")) == {id_clientes, id_repuestos, id_ordenes}
    assert ids(desde="2026-01-01", hasta="2026-01-31") == [id_clientes, id_repuestos]
    assert ids(hasta="2026-01-15") == [id_repuestos, id_ordenes]
    assert ids() == [id_clientes, id_repuestos, id_ordenes]


def test_listado_paginado_con_x_total_count(api, datos):
    base = datetime(2026, 1, 20, 12, 0, 0)
    ids = [
        _insertar_fila(creado_en=base.replace(hour=10 + i))
        for i in range(3)
    ]
    headers = datos["headers"]["superadmin"]

    r = api.get(PLATAFORMA_LISTA, headers=headers, params={"limit": 2})
    assert r.status_code == 200
    assert r.headers["X-Total-Count"] == "3"
    assert [f["id"] for f in r.json()] == [ids[2], ids[1]]  # más nuevo primero

    r = api.get(
        PLATAFORMA_LISTA,
        headers=headers,
        params={"limit": 2, "offset": 2},
    )
    assert [f["id"] for f in r.json()] == [ids[0]]
    assert r.headers["X-Total-Count"] == "3"


def test_exportar_csv_con_encabezado_y_filas(api, datos):
    _insertar_fila(
        entidad="clientes", usuario_email="auditada@x.com", estado_http=201,
    )
    headers = datos["headers"]["superadmin"]

    r = api.get(PLATAFORMA_EXPORTAR, headers=headers)
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/csv")
    assert 'attachment; filename="auditoria-' in r.headers["content-disposition"]

    texto = r.content.decode("utf-8-sig")
    filas = list(csv.reader(io.StringIO(texto)))
    assert filas[0][:4] == ["id", "creado_en", "usuario_id", "usuario_email"]
    assert any("auditada@x.com" in fila for fila in filas[1:])


def test_plataforma_auditoria_exige_superadmin(api, datos):
    for rol in ("administrador", "recepcion", "mecanico", "cliente"):
        headers = datos["headers"][rol]
        assert api.get(PLATAFORMA_LISTA, headers=headers).status_code == 403
        assert api.get(PLATAFORMA_EXPORTAR, headers=headers).status_code == 403


def test_taller_auditoria_exige_administrador(api, datos):
    # El administrador del taller sí entra y ve solo lo suyo (ver test siguiente).
    assert api.get(
        TALLER_LISTA, headers=datos["headers"]["administrador"]
    ).status_code == 200
    assert api.get(
        TALLER_EXPORTAR, headers=datos["headers"]["administrador"]
    ).status_code == 200
    for rol in ("recepcion", "mecanico", "cliente", "superadmin"):
        headers = datos["headers"][rol]
        assert api.get(TALLER_LISTA, headers=headers).status_code == 403, rol
        assert api.get(TALLER_EXPORTAR, headers=headers).status_code == 403, rol


def test_taller_auditoria_solo_muestra_su_taller(api, datos):
    """El administrador ve las filas de su taller (taller_id=1): las de otros
    talleres y las de plataforma (taller_id NULL) quedan afuera."""
    propia = _insertar_fila(taller_id=1, entidad="clientes", estado_http=201)
    _insertar_fila(taller_id=2, entidad="clientes", estado_http=201)
    _insertar_fila(taller_id=None, entidad="clientes", estado_http=201)

    headers = datos["headers"]["administrador"]
    r = api.get(TALLER_LISTA, headers=headers)
    assert r.status_code == 200
    # Solo la fila del taller 1: las de taller 2 y las de plataforma no entran.
    assert [f["id"] for f in r.json()] == [propia]
    assert r.headers["X-Total-Count"] == "1"

    # El CSV del taller tampoco filtra datos ajenos.
    r = api.get(TALLER_EXPORTAR, headers=headers)
    assert r.status_code == 200
    texto = r.content.decode("utf-8-sig")
    filas = list(csv.reader(io.StringIO(texto)))
    assert len(filas) == 2  # encabezado + la fila del taller 1


def test_plataforma_auditoria_filtra_por_taller_id(api, datos):
    del_taller1 = _insertar_fila(taller_id=1, entidad="clientes")
    del_taller2 = _insertar_fila(taller_id=2, entidad="clientes")
    _insertar_fila(taller_id=None, entidad="clientes")

    headers = datos["headers"]["superadmin"]
    # Sin filtro ve las tres (plataforma no queda acotada por taller).
    r = api.get(PLATAFORMA_LISTA, headers=headers)
    assert r.status_code == 200
    assert len(r.json()) == 3
    assert {f["taller_id"] for f in r.json()} == {1, 2, None}
    # Con filtro, solo las del taller pedido.
    r = api.get(PLATAFORMA_LISTA, headers=headers, params={"taller_id": 1})
    assert [f["id"] for f in r.json()] == [del_taller1]
    r = api.get(PLATAFORMA_LISTA, headers=headers, params={"taller_id": 2})
    assert [f["id"] for f in r.json()] == [del_taller2]
    assert r.headers["X-Total-Count"] == "1"
    # El exportar también lo aplica.
    r = api.get(PLATAFORMA_EXPORTAR, headers=headers, params={"taller_id": 1})
    texto = r.content.decode("utf-8-sig")
    filas = list(csv.reader(io.StringIO(texto)))
    assert len(filas) == 2


def test_sin_token_da_401(api, datos):
    for ruta in (PLATAFORMA_LISTA, PLATAFORMA_EXPORTAR, TALLER_LISTA, TALLER_EXPORTAR):
        assert api.get(ruta).status_code == 401
