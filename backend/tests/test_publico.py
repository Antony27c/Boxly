"""API pública de la landing y solicitudes del superadmin (docs/Landing.md, L5)."""
import os
import subprocess
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect, select

from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.main import app
from app.models import Auditoria, Plan, SolicitudContacto, Usuario
from app.models.usuario import RolUsuario

RUTA_CONTACTO = "/api/v1/publico/contacto"
RUTA_SOLICITUDES = "/api/v1/plataforma/solicitudes"

CONTACTO_VALIDO = {
    "nombre": "Carlos Díaz",
    "taller": "Taller El Pistón",
    "email": "carlos@piston.com",
    "telefono": "11 5555-1234",
    "ciudad": "Rosario",
    "mensaje": "Quiero ver una demo.",
}


def _usuario(email, rol):
    return Usuario(
        nombre="Usu", apellido="Prueba", email=email,
        password_hash=hash_password("Clave1234"), rol=rol, activo=True,
    )


@pytest.fixture
def datos():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        # Un plan inactivo y otro más barato que los iniciales, para ver filtro y orden.
        db.add_all([
            Plan(codigo="viejo", nombre="Viejo", precio_mensual=1000, max_personal=1, activo=False),
            Plan(codigo="mini", nombre="Mini", precio_mensual=5000, max_personal=1, activo=True),
        ])
        sa = _usuario("sa@x.com", RolUsuario.superadmin)
        admin = _usuario("admin@x.com", RolUsuario.administrador)
        db.add_all([sa, admin])
        db.commit()
        return {
            "sa": {"Authorization": "Bearer " + create_access_token(sa.id)},
            "admin": {"Authorization": "Bearer " + create_access_token(admin.id)},
        }


@pytest.fixture
def api():
    with TestClient(app) as cliente:
        yield cliente


def _solicitudes():
    with SessionLocal() as db:
        return list(db.scalars(select(SolicitudContacto).order_by(SolicitudContacto.id)))


def test_planes_publicos_sin_token_solo_activos_y_ordenados(api, datos):
    r = api.get("/api/v1/publico/planes")
    assert r.status_code == 200
    planes = r.json()
    assert [p["codigo"] for p in planes] == ["mini", "esencial", "pro", "profesional"]
    assert set(planes[0]) == {"codigo", "nombre", "precio_mensual", "max_personal", "funciones"}
    assert planes[-1]["max_personal"] is None


def test_planes_publicos_traen_sus_funciones(api, datos):
    """La landing arma lo que trae cada plan con `funciones` (docs/Oferta.md)."""
    planes = {p["codigo"]: p for p in api.get("/api/v1/publico/planes").json()}
    assert planes["mini"]["funciones"] == []

    esencial = set(planes["esencial"]["funciones"])
    assert esencial == {"gestion", "whatsapp_manual"}
    assert "whatsapp_automatico" not in esencial

    pro = set(planes["pro"]["funciones"])
    assert {"whatsapp_automatico", "arca"} <= pro

    profesional = set(planes["profesional"]["funciones"])
    assert {"recordatorios_service", "marca_propia"} <= profesional


def test_contacto_valido_se_guarda(api, datos):
    r = api.post(RUTA_CONTACTO, json={**CONTACTO_VALIDO, "sitio_web": ""})
    assert r.status_code == 201
    assert r.json() == {"ok": True}
    [s] = _solicitudes()
    assert (s.nombre, s.taller, s.email, s.estado) == (
        "Carlos Díaz", "Taller El Pistón", "carlos@piston.com", "nueva",
    )
    assert s.ip


def test_contacto_minimo_con_opcionales_vacios(api, datos):
    r = api.post(RUTA_CONTACTO, json={
        "nombre": "Ana", "taller": "AB", "email": "ana@x.com", "telefono": "", "ciudad": "",
    })
    assert r.status_code == 201
    [s] = _solicitudes()
    assert s.telefono is None and s.ciudad is None


@pytest.mark.parametrize("cambio", [
    {"email": "no-es-un-mail"},
    {"nombre": "A"},
    {"taller": "x" * 121},
    {"telefono": "123"},
    {"ciudad": "x" * 81},
    {"mensaje": "x" * 1001},
    {"nombre": None},
])
def test_contacto_invalido_422(api, datos, cambio):
    r = api.post(RUTA_CONTACTO, json={**CONTACTO_VALIDO, **cambio})
    assert r.status_code == 422
    assert _solicitudes() == []


def test_campo_trampa_responde_201_sin_guardar(api, datos):
    r = api.post(RUTA_CONTACTO, json={**CONTACTO_VALIDO, "sitio_web": "http://spam.example"})
    assert r.status_code == 201
    assert r.json() == {"ok": True}
    assert _solicitudes() == []


def test_sexto_envio_de_la_misma_ip_429(api, datos):
    for _ in range(5):
        assert api.post(RUTA_CONTACTO, json=CONTACTO_VALIDO).status_code == 201
    r = api.post(RUTA_CONTACTO, json=CONTACTO_VALIDO)
    assert r.status_code == 429
    assert r.json()["detail"] == "Recibimos varias solicitudes, probá más tarde"
    assert len(_solicitudes()) == 5


def test_el_limite_no_cuenta_envios_viejos(api, datos):
    from datetime import datetime, timedelta, timezone

    for _ in range(5):
        assert api.post(RUTA_CONTACTO, json=CONTACTO_VALIDO).status_code == 201
    with SessionLocal() as db:
        for s in db.scalars(select(SolicitudContacto)):
            s.creado_en = datetime.now(timezone.utc) - timedelta(hours=2)
        db.commit()
    assert api.post(RUTA_CONTACTO, json=CONTACTO_VALIDO).status_code == 201


def test_auditoria_del_contacto_sin_datos_personales(api, datos):
    assert api.post(RUTA_CONTACTO, json=CONTACTO_VALIDO).status_code == 201
    with SessionLocal() as db:
        [fila] = db.scalars(select(Auditoria).where(Auditoria.ruta == RUTA_CONTACTO)).all()
    assert fila.usuario_email is None and fila.detalle is None
    valores = " ".join(str(v) for v in vars(fila).values())
    assert "carlos" not in valores.lower() and "Pistón" not in valores


def test_superadmin_lista_filtra_y_cambia_estado(api, datos):
    for i in range(3):
        api.post(RUTA_CONTACTO, json={**CONTACTO_VALIDO, "nombre": f"Persona {i}"})

    r = api.get(RUTA_SOLICITUDES, headers=datos["sa"])
    assert r.status_code == 200
    assert r.headers["X-Total-Count"] == "3"
    lista = r.json()
    assert len(lista) == 3 and "ip" not in lista[0]

    r = api.get(RUTA_SOLICITUDES, params={"limit": 2}, headers=datos["sa"])
    assert len(r.json()) == 2 and r.headers["X-Total-Count"] == "3"

    id_ = lista[0]["id"]
    r = api.patch(f"{RUTA_SOLICITUDES}/{id_}", json={"estado": "contactada", "nota": "Llamar el lunes"},
                  headers=datos["sa"])
    assert r.status_code == 200
    assert (r.json()["estado"], r.json()["nota"]) == ("contactada", "Llamar el lunes")

    # Sin nota en el body: la nota queda como estaba.
    r = api.patch(f"{RUTA_SOLICITUDES}/{id_}", json={"estado": "convertida"}, headers=datos["sa"])
    assert (r.json()["estado"], r.json()["nota"]) == ("convertida", "Llamar el lunes")

    r = api.get(RUTA_SOLICITUDES, params={"estado": "convertida"}, headers=datos["sa"])
    assert [s["id"] for s in r.json()] == [id_] and r.headers["X-Total-Count"] == "1"
    r = api.get(RUTA_SOLICITUDES, params={"estado": "nueva"}, headers=datos["sa"])
    assert r.headers["X-Total-Count"] == "2"

    assert api.patch(f"{RUTA_SOLICITUDES}/{id_}", json={"estado": "otra"},
                     headers=datos["sa"]).status_code == 422
    assert api.get(RUTA_SOLICITUDES, params={"estado": "otra"},
                   headers=datos["sa"]).status_code == 422
    assert api.patch(f"{RUTA_SOLICITUDES}/99999", json={"estado": "nueva"},
                     headers=datos["sa"]).status_code == 404


def test_solicitudes_admin_de_taller_403_y_anonimo_401(api, datos):
    api.post(RUTA_CONTACTO, json=CONTACTO_VALIDO)
    [s] = _solicitudes()
    assert api.get(RUTA_SOLICITUDES, headers=datos["admin"]).status_code == 403
    assert api.patch(f"{RUTA_SOLICITUDES}/{s.id}", json={"estado": "descartada"},
                     headers=datos["admin"]).status_code == 403
    assert api.get(RUTA_SOLICITUDES).status_code == 401
    assert api.patch(f"{RUTA_SOLICITUDES}/{s.id}", json={"estado": "descartada"}).status_code == 401
    assert _solicitudes()[0].estado == "nueva"


def test_migracion_upgrade_y_downgrade(tmp_path):
    """Corre alembic en una base SQLite aparte (subproceso: env.py lee DATABASE_URL)."""
    backend = Path(__file__).resolve().parents[1]
    db = tmp_path / "migraciones.db"
    url = f"sqlite:///{db.as_posix()}"
    env = {**os.environ, "DATABASE_URL": url}

    def alembic(*args):
        r = subprocess.run(
            [sys.executable, "-m", "alembic", *args],
            cwd=backend, env=env, capture_output=True, text=True,
        )
        assert r.returncode == 0, r.stderr

    alembic("upgrade", "c5a9e3f7d214")
    motor = create_engine(url)
    try:
        insp = inspect(motor)
        assert "solicitudes_contacto" in insp.get_table_names()
        indices = {i["name"] for i in insp.get_indexes("solicitudes_contacto")}
        assert {"ix_solicitudes_contacto_estado", "ix_solicitudes_contacto_ip_creado_en"} <= indices
    finally:
        motor.dispose()

    alembic("downgrade", "b8d4f2a6c013")
    motor = create_engine(url)
    try:
        assert "solicitudes_contacto" not in inspect(motor).get_table_names()
    finally:
        motor.dispose()
