"""Tests de P3: GET /plataforma/sistema (superadmin) y GET /taller/respaldo
(administrador, solo su taller). Las rutas viejas /admin/* ya no existen."""

import csv
import io
import re
import zipfile
from datetime import datetime
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

import app.api.v1.sistema.service as sistema_service_module
from app.core.config import get_settings
from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.main import app
from app.models import Cliente, Orden, Pago, Repuesto, Turno, Usuario, Vehiculo
from app.models.usuario import RolUsuario

RUTAS_PLATAFORMA = ("/api/v1/plataforma/sistema", "/api/v1/plataforma/auditoria")

TABLAS_CSV = [
    "usuarios",
    "clientes",
    "vehiculos",
    "ordenes",
    "detalles_orden",
    "historial_estado",
    "repuestos",
    "turnos",
    "pagos",
    "horarios_mecanico",
    "configuracion_taller",
]


@pytest.fixture
def datos():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        password_hash = hash_password("Clave1234")
        usuarios = {
            "superadmin": Usuario(
                nombre="Root", apellido="Admin", email="root@x.com",
                password_hash=password_hash, rol=RolUsuario.superadmin,
            ),
            "administrador": Usuario(
                nombre="Admin", apellido="Taller", email="admin@x.com",
                password_hash=password_hash, rol=RolUsuario.administrador,
            ),
            "recepcion": Usuario(
                nombre="Recep", apellido="Taller", email="recep@x.com",
                password_hash=password_hash, rol=RolUsuario.recepcion,
            ),
            "mecanico": Usuario(
                nombre="Mec", apellido="Uno", email="mec1@x.com",
                password_hash=password_hash, rol=RolUsuario.mecanico,
            ),
            "otro_mecanico": Usuario(
                nombre="Mec", apellido="Dos", email="mec2@x.com",
                password_hash=password_hash, rol=RolUsuario.mecanico,
            ),
        }
        cliente = Cliente(nombre="Ana", apellido="Gomez", dni="30111222", email="ana@x.com")
        db.add_all([*usuarios.values(), cliente])
        db.flush()
        cuenta_cliente = Usuario(
            nombre="Ana", apellido="Gomez", email="cuenta@x.com",
            password_hash=password_hash, rol=RolUsuario.cliente, cliente_id=cliente.id,
        )
        vehiculo = Vehiculo(cliente_id=cliente.id, patente="BBB222", marca="Ford", modelo="Focus")
        repuesto = Repuesto(codigo="BUJ-01", nombre="Bujia", stock=4, stock_minimo=1, precio=120)
        db.add_all([cuenta_cliente, vehiculo, repuesto])
        db.flush()
        creado_por = usuarios["administrador"].id
        ordenes = [
            Orden(
                cliente_id=cliente.id, vehiculo_id=vehiculo.id, creado_por_id=creado_por,
                codigo="OT-2001", estado="pendiente", descripcion_ingreso="Service",
            ),
            Orden(
                cliente_id=cliente.id, vehiculo_id=vehiculo.id, creado_por_id=creado_por,
                codigo="OT-2002", estado="entregado", descripcion_ingreso="Reparacion",
            ),
            Orden(
                cliente_id=cliente.id, vehiculo_id=vehiculo.id, creado_por_id=creado_por,
                codigo="OT-2003", estado="cancelado", descripcion_ingreso="Anulada",
            ),
        ]
        db.add_all(ordenes)
        db.flush()
        db.add(Pago(orden_id=ordenes[0].id, monto=Decimal("1500.00"), estado="pendiente"))
        db.add(
            Turno(
                cliente_id=cliente.id, vehiculo_id=vehiculo.id,
                registrado_por_id=creado_por, fecha_hora=datetime(2026, 12, 1, 9, 0),
                estado="confirmado",
            )
        )
        db.commit()
        headers = {
            rol: {"Authorization": "Bearer " + create_access_token(u.id)}
            for rol, u in usuarios.items()
        }
        headers["cliente"] = {
            "Authorization": "Bearer " + create_access_token(cuenta_cliente.id)
        }
        return {"headers": headers, "password_hash": password_hash}


@pytest.fixture
def api():
    with TestClient(app) as cliente:
        yield cliente


def _leer_csvs(contenido: bytes) -> dict[str, list[list[str]]]:
    """Abre el ZIP y devuelve {nombre.csv: filas} ya decodificadas."""
    csvs = {}
    with zipfile.ZipFile(io.BytesIO(contenido)) as respaldo:
        for nombre in respaldo.namelist():
            texto = respaldo.read(nombre).decode("utf-8-sig")
            csvs[nombre] = list(csv.reader(io.StringIO(texto)))
    return csvs


def test_sistema_devuelve_estado(api, datos, monkeypatch, tmp_path):
    monkeypatch.setattr(sistema_service_module, "UPLOADS_DIR", tmp_path)
    r = api.get("/api/v1/plataforma/sistema", headers=datos["headers"]["superadmin"])
    assert r.status_code == 200
    body = r.json()
    settings = get_settings()
    assert body["version"] == settings.app_version
    assert body["entorno"] == settings.environment
    assert body["db"] == {"motor": "sqlite", "ok": True, "revision": None}
    assert body["conteos"] == {
        "usuarios": 6,
        "clientes": 1,
        "vehiculos": 1,
        "ordenes": 3,
        "ordenes_abiertas": 1,
        "repuestos": 1,
        "turnos": 1,
        "pagos": 1,
    }
    assert body["usuarios_por_rol"] == {
        "superadmin": 1,
        "administrador": 1,
        "recepcion": 1,
        "mecanico": 2,
        "cliente": 1,
    }
    # Un solo taller (el principal) y activo.
    assert body["talleres"] == {"activo": 1, "suspendido": 0}
    assert body["uploads"] == {"archivos": 0, "bytes": 0}
    assert set(body["integraciones"]) == {"email", "mercadopago", "rate_limit"}
    assert all(isinstance(v, bool) for v in body["integraciones"].values())
    assert body["integraciones"]["email"] is False
    assert body["integraciones"]["mercadopago"] is False


def test_sistema_uploads_cuenta_archivos_y_bytes(api, datos, monkeypatch, tmp_path):
    sub = tmp_path / "sub"
    sub.mkdir()
    (tmp_path / "a.jpg").write_bytes(b"x" * 100)
    (sub / "b.png").write_bytes(b"y" * 50)
    (tmp_path / "vacio.txt").write_bytes(b"")
    monkeypatch.setattr(sistema_service_module, "UPLOADS_DIR", tmp_path)
    r = api.get("/api/v1/plataforma/sistema", headers=datos["headers"]["superadmin"])
    assert r.status_code == 200
    assert r.json()["uploads"] == {"archivos": 3, "bytes": 150}


def test_sistema_no_expone_secretos(api, datos, monkeypatch):
    settings = get_settings()
    secretos = {
        "smtp_user": "smtp-user-falso",
        "smtp_password": "smtp-pass-falso-999",
        "smtp_from_email": "from-falso@x.com",
        "mp_access_token": "APP_USR-falso-token-777",
        "mp_webhook_secret": "whsec-falso-555",
        "postgres_password": "pg-pass-falsa",
    }
    for clave, valor in secretos.items():
        monkeypatch.setattr(settings, clave, valor)
    monkeypatch.setattr(sistema_service_module.limiter, "enabled", True)

    r = api.get("/api/v1/plataforma/sistema", headers=datos["headers"]["superadmin"])
    assert r.status_code == 200
    body = r.json()
    assert body["integraciones"] == {"email": True, "mercadopago": True, "rate_limit": True}
    for valor in secretos.values():
        assert valor not in r.text
    # Ni el secreto JWT de desarrollo ni el hash de las contraseñas se filtran.
    assert settings.jwt_secret_key not in r.text
    assert datos["password_hash"] not in r.text


def test_exportar_devuelve_zip_con_csv_del_taller(api, datos):
    # La fila de configuración del taller 1 se crea al pedir sus datos.
    assert api.get("/api/v1/taller", headers=datos["headers"]["administrador"]).status_code == 200

    r = api.get("/api/v1/taller/respaldo", headers=datos["headers"]["administrador"])
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/zip"
    assert re.fullmatch(
        r'attachment; filename="boxly-respaldo-\d{8}-\d{4}\.zip"',
        r.headers["content-disposition"],
    )

    with zipfile.ZipFile(io.BytesIO(r.content)) as respaldo:
        assert sorted(respaldo.namelist()) == sorted(f"{t}.csv" for t in TABLAS_CSV)
        for nombre in respaldo.namelist():
            crudo = respaldo.read(nombre)
            # BOM UTF-8 al inicio de cada CSV.
            assert crudo.startswith(b"\xef\xbb\xbf")
            texto = crudo.decode("utf-8-sig")
            filas = list(csv.reader(io.StringIO(texto)))
            for columna in filas[0]:
                assert not any(
                    palabra in columna.lower()
                    for palabra in ("password", "token", "secret")
                )

    csvs = _leer_csvs(r.content)
    # usuarios.csv: encabezado sin password_hash ni token_version.
    assert csvs["usuarios.csv"][0] == [
        "id", "nombre", "apellido", "email", "rol", "activo",
        "taller_id", "cliente_id", "creado_en", "actualizado_en",
    ]
    # Encabezado + los 5 usuarios del taller: el superadmin (sin taller) no sale.
    assert len(csvs["usuarios.csv"]) == 6
    usuarios_texto = "\n".join(",".join(fila) for fila in csvs["usuarios.csv"])
    assert datos["password_hash"] not in usuarios_texto
    assert "root@x.com" not in usuarios_texto
    # El resto de las tablas también sale con datos.
    assert csvs["ordenes.csv"][0][0] == "id"
    assert len(csvs["ordenes.csv"]) == 4  # encabezado + 3 órdenes
    assert len(csvs["clientes.csv"]) == 2
    assert len(csvs["configuracion_taller.csv"]) == 2  # encabezado + la fila creada


@pytest.mark.parametrize("ruta", RUTAS_PLATAFORMA)
@pytest.mark.parametrize("rol", ["administrador", "recepcion", "mecanico", "cliente"])
def test_rutas_plataforma_solo_superadmin(api, datos, rol, ruta):
    r = api.get(ruta, headers=datos["headers"][rol])
    assert r.status_code == 403


@pytest.mark.parametrize("ruta", RUTAS_PLATAFORMA)
def test_rutas_plataforma_sin_token(api, ruta):
    assert api.get(ruta).status_code == 401


@pytest.mark.parametrize("rol", ["superadmin", "recepcion", "mecanico", "cliente"])
def test_respaldo_solo_para_el_administrador(api, datos, rol):
    r = api.get("/api/v1/taller/respaldo", headers=datos["headers"][rol])
    assert r.status_code == 403


def test_respaldo_sin_token(api):
    assert api.get("/api/v1/taller/respaldo").status_code == 401


def test_rutas_admin_viejas_ya_no_existen(api, datos):
    h = datos["headers"]["superadmin"]
    for ruta in ("/api/v1/admin/sistema", "/api/v1/admin/exportar", "/api/v1/admin/auditoria"):
        assert api.get(ruta, headers=h).status_code == 404
