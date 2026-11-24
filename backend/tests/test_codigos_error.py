"""Códigos de error estables y tabla de decisión del bloqueo (tarea Q4).

El frontend deja de reconocer los errores de negocio por el texto en
castellano: cada uno viaja como ``{"detail": "<el texto de siempre>",
"codigo": "<codigo estable>"}``. Además ``_decision_suscripcion`` decide el
bloqueo por suscripción con una tabla plana (estado, ruta libre, rol, método)
y ``ruta_libre`` ya no libera ``/api/v1/suscripcionX`` por un ``startswith``
sin barra.
"""
from datetime import date, datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app.core.dependencies import _decision_suscripcion, _es_ruta_auth
from app.core.errores import (
    LIMITE_PERSONAL,
    PLAN_PERSONAL_EXCEDIDO,
    SOPORTE_SIN_ACCESO,
    SOPORTE_SOLO_LECTURA,
    SUSCRIPCION_SOLO_LECTURA,
    SUSCRIPCION_SUSPENDIDA,
    TALLER_SUSPENDIDO,
)
from app.core.security import create_access_token, hash_password
from app.core.suscripcion import (
    AL_DIA,
    GRACIA,
    SOLO_LECTURA,
    SUSPENDIDA,
    ruta_libre,
)
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.main import app
from app.models import AccesoSoporte, Cliente, Taller, Usuario, Vehiculo
from app.models.usuario import RolUsuario

PASSWORD = "Clave1234"
MSG_VENCIDA = "La suscripción del taller está vencida"
MSG_LECTURA = "El taller está en solo lectura por falta de pago de la suscripción"
MSG_TALLER = "El taller está suspendido. Comunicate con Boxly."
MSG_SOPORTE = "El modo soporte es de solo lectura"
MSG_SIN_ACCESO = "El taller no te dio acceso de soporte"
MSG_LIMITE = (
    "Tu plan permite hasta 3 usuarios del personal. "
    "Pasá a un plan mayor para sumar más."
)
MSG_PLAN = "Tu personal activo supera el límite de ese plan"


def _usuario(nombre, email, rol, taller_id=None):
    return Usuario(
        nombre=nombre,
        apellido="Prueba",
        email=email,
        password_hash=hash_password(PASSWORD),
        rol=rol,
        taller_id=taller_id,
    )


def _acceso_suscripcion(taller_id: int, dias: int, tipo: str = "pago") -> None:
    """Fija tipo_acceso y vencimiento (dias<0 = ya venció hace |dias|)."""
    with SessionLocal() as db:
        taller = db.get(Taller, taller_id)
        taller.tipo_acceso = tipo
        taller.suscripcion_vence_en = date.today() + timedelta(days=dias)
        db.commit()


@pytest.fixture
def datos():
    """Taller 1 al día en plan esencial con 4 de personal (admin, recepción y
    dos mecánicos) más un superadmin, y un cliente con vehículo."""
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        taller1 = db.get(Taller, 1)
        taller1.plan_codigo = "esencial"
        taller1.tipo_acceso = "pago"
        taller1.suscripcion_vence_en = date.today() + timedelta(days=30)

        usuarios = {
            "admin": _usuario("Admin", "admin@x.com", RolUsuario.administrador),
            "recepcion": _usuario("Recep", "recep@x.com", RolUsuario.recepcion),
            "mecanico": _usuario("Mec", "mec@x.com", RolUsuario.mecanico),
            "mecanico2": _usuario("Mec2", "mec2@x.com", RolUsuario.mecanico),
            "superadmin": _usuario("Super", "sa@x.com", RolUsuario.superadmin),
        }
        cliente = Cliente(nombre="Juan", apellido="Perez", dni="30000001",
                          email="juan@x.com")
        db.add_all([*usuarios.values(), cliente])
        db.flush()
        vehiculo = Vehiculo(cliente_id=cliente.id, patente="AAA111",
                            marca="Ford", modelo="Focus")
        db.add(vehiculo)
        db.commit()

        return {
            "headers": {
                k: {"Authorization": "Bearer " + create_access_token(u.id)}
                for k, u in usuarios.items()
            },
            "vehiculo_id": vehiculo.id,
        }


@pytest.fixture
def api():
    with TestClient(app) as cliente:
        yield cliente


def _acceso_soporte_vigente(taller_id: int = 1) -> None:
    with SessionLocal() as db:
        db.add(AccesoSoporte(
            taller_id=taller_id,
            desde=datetime.now(timezone.utc) - timedelta(minutes=1),
            hasta=datetime.now(timezone.utc) + timedelta(hours=4),
        ))
        db.commit()


# --- Formato del error -------------------------------------------------------


def test_error_con_codigo_trae_detail_y_codigo(api, datos):
    """El JSON del error es exactamente {"detail": ..., "codigo": ...}."""
    _acceso_suscripcion(1, -40)
    r = api.get("/api/v1/ordenes", headers=datos["headers"]["admin"])
    assert r.status_code == 403
    assert set(r.json()) == {"detail", "codigo"}
    assert r.json() == {"detail": MSG_VENCIDA, "codigo": SUSCRIPCION_SUSPENDIDA}


def test_error_sin_codigo_sigue_con_code(api, datos):
    """Los HTTPException de siempre no cambian: {"detail", "code"}."""
    r = api.get("/api/v1/ordenes/9999", headers=datos["headers"]["admin"])
    assert r.status_code == 404
    assert set(r.json()) == {"detail", "code"}


# --- Tabla de decisión del bloqueo por suscripción ---------------------------


@pytest.mark.parametrize("estado", [AL_DIA, GRACIA])
def test_tabla_al_dia_y_gracia_pasan_siempre(estado):
    for libre in (False, True):
        for es_admin in (False, True):
            for es_lectura in (False, True):
                assert _decision_suscripcion(
                    estado, libre=libre, es_admin=es_admin,
                    es_lectura=es_lectura,
                ) is None


def test_tabla_suspendida_solo_admin_en_ruta_libre():
    # Admin + ruta libre: pasa (puede pagar). Todo lo demás: suspendida.
    assert _decision_suscripcion(
        SUSPENDIDA, libre=True, es_admin=True, es_lectura=False
    ) is None
    assert _decision_suscripcion(
        SUSPENDIDA, libre=True, es_admin=True, es_lectura=True
    ) is None
    for libre, es_admin in (
        (True, False),   # recepcion en /suscripcion: no es admin
        (False, True),   # admin en ruta normal
        (False, False),  # recepcion en ruta normal
    ):
        for es_lectura in (False, True):
            assert _decision_suscripcion(
                SUSPENDIDA, libre=libre, es_admin=es_admin,
                es_lectura=es_lectura,
            ) == SUSCRIPCION_SUSPENDIDA


def test_tabla_solo_lectura_libre_y_lecturas_pasan():
    # Ruta libre: cualquier rol y método pasa.
    for es_admin in (False, True):
        for es_lectura in (False, True):
            assert _decision_suscripcion(
                SOLO_LECTURA, libre=True, es_admin=es_admin,
                es_lectura=es_lectura,
            ) is None
    # Ruta normal: lecturas pasan, escrituras cortan con su código.
    for es_admin in (False, True):
        assert _decision_suscripcion(
            SOLO_LECTURA, libre=False, es_admin=es_admin, es_lectura=True
        ) is None
        assert _decision_suscripcion(
            SOLO_LECTURA, libre=False, es_admin=es_admin, es_lectura=False
        ) == SUSCRIPCION_SOLO_LECTURA


# --- ruta_libre y /auth -------------------------------------------------------


@pytest.mark.parametrize(
    "ruta,esperado",
    [
        ("/api/v1/suscripcion", True),
        ("/api/v1/suscripcion/plan", True),
        ("/api/v1/suscripcion/encuesta", True),
        ("/api/v1/suscripcionX", False),
        ("/api/v1/suscripcionX/plan", False),
        ("/api/v1/auth", True),
        ("/api/v1/auth/login", True),
        ("/api/v1/authX", False),
        ("/api/v1/terminos", True),
        ("/api/v1/terminos/aceptar", True),
        ("/api/v1/terminosX", False),
        ("/api/v1/ordenes", False),
    ],
)
def test_ruta_libre_prefijo_exacto_o_con_barra(ruta, esperado):
    assert ruta_libre(ruta) is esperado


@pytest.mark.parametrize(
    "ruta,esperado",
    [
        ("/api/v1/auth", True),
        ("/api/v1/auth/me", True),
        ("/api/v1/authX", False),
        ("/api/v1/authX/login", False),
        ("/api/v1/suscripcion", False),
    ],
)
def test_es_ruta_auth_prefijo_exacto(ruta, esperado):
    assert _es_ruta_auth(ruta) is esperado


def test_suscripcion_suspendida_auth_sigue_libre(api, datos):
    """Taller suspendido: /auth/* pasa para cualquier rol (no desloguea)."""
    _acceso_suscripcion(1, -40)
    for rol in ("admin", "recepcion", "mecanico"):
        r = api.get("/api/v1/auth/me", headers=datos["headers"][rol])
        assert r.status_code == 200, rol
    # Pero el resto del taller queda cortado.
    r = api.get("/api/v1/ordenes", headers=datos["headers"]["admin"])
    assert r.json() == {"detail": MSG_VENCIDA, "codigo": SUSCRIPCION_SUSPENDIDA}


# --- Cada código en su endpoint ------------------------------------------------


def test_suscripcion_solo_lectura(api, datos):
    """Pago vencido hace 10 días (8-30): lecturas pasan, escrituras 403."""
    _acceso_suscripcion(1, -10)
    h = datos["headers"]["admin"]

    r = api.post("/api/v1/ordenes", headers=h, json={
        "vehiculo_id": datos["vehiculo_id"], "descripcion_ingreso": "Service",
    })
    assert r.status_code == 403
    assert r.json() == {"detail": MSG_LECTURA, "codigo": SUSCRIPCION_SOLO_LECTURA}

    assert api.get("/api/v1/ordenes", headers=h).status_code == 200
    # Ruta libre: también escribe (por ejemplo la encuesta o el plan).
    assert api.get("/api/v1/suscripcion", headers=h).status_code == 200


def test_suscripcion_suspendida(api, datos):
    """Pago vencido hace 40 días: solo el admin en rutas libres (pagar)."""
    _acceso_suscripcion(1, -40)

    # Admin: ruta normal cortada; ruta libre (/suscripcion) pasa.
    r = api.get("/api/v1/ordenes", headers=datos["headers"]["admin"])
    assert r.status_code == 403
    assert r.json() == {"detail": MSG_VENCIDA, "codigo": SUSCRIPCION_SUSPENDIDA}
    assert api.get("/api/v1/suscripcion", headers=datos["headers"]["admin"]).status_code == 200

    # Recepción: ni lectura de rutas normales ni rutas libres (no es admin).
    r = api.get("/api/v1/ordenes", headers=datos["headers"]["recepcion"])
    assert r.json() == {"detail": MSG_VENCIDA, "codigo": SUSCRIPCION_SUSPENDIDA}
    r = api.get("/api/v1/suscripcion", headers=datos["headers"]["recepcion"])
    assert r.json() == {"detail": MSG_VENCIDA, "codigo": SUSCRIPCION_SUSPENDIDA}


def test_limite_personal(api, datos):
    """El 409 del cupo de personal lleva codigo=limite_personal."""
    r = api.post("/api/v1/users", headers=datos["headers"]["admin"], json={
        "nombre": "Otro", "apellido": "User", "email": "otro@x.com",
        "password": PASSWORD, "rol": "mecanico",
    })
    assert r.status_code == 409
    assert r.json() == {"detail": MSG_LIMITE, "codigo": LIMITE_PERSONAL}


def test_plan_personal_excedido(api, datos):
    """Bajar de plan con más personal del que entra: 409 con su código."""
    with SessionLocal() as db:
        taller = db.get(Taller, 1)
        taller.plan_codigo = "pro"
        db.commit()

    r = api.put("/api/v1/suscripcion/plan", headers=datos["headers"]["admin"],
                json={"plan": "esencial"})
    assert r.status_code == 409
    assert r.json() == {"detail": MSG_PLAN, "codigo": PLAN_PERSONAL_EXCEDIDO}


def test_taller_suspendido(api, datos):
    """Taller dado de baja por la plataforma: 403 con taller_suspendido."""
    with SessionLocal() as db:
        taller = db.get(Taller, 1)
        taller.estado = "suspendido"
        db.commit()

    r = api.get("/api/v1/ordenes", headers=datos["headers"]["admin"])
    assert r.status_code == 403
    assert r.json() == {"detail": MSG_TALLER, "codigo": TALLER_SUSPENDIDO}


def test_soporte_sin_acceso(api, datos):
    """Superadmin con X-Taller-Soporte sin acceso vigente: soporte_sin_acceso."""
    h = {**datos["headers"]["superadmin"], "X-Taller-Soporte": "999"}
    r = api.get("/api/v1/clientes", headers=h)
    assert r.status_code == 403
    assert r.json() == {"detail": MSG_SIN_ACCESO, "codigo": SOPORTE_SIN_ACCESO}

    # Acceso vencido: mismo código.
    with SessionLocal() as db:
        db.add(AccesoSoporte(
            taller_id=1,
            desde=datetime.now(timezone.utc) - timedelta(hours=5),
            hasta=datetime.now(timezone.utc) - timedelta(hours=1),
        ))
        db.commit()
    h = {**datos["headers"]["superadmin"], "X-Taller-Soporte": "1"}
    r = api.get("/api/v1/clientes", headers=h)
    assert r.json() == {"detail": MSG_SIN_ACCESO, "codigo": SOPORTE_SIN_ACCESO}


def test_soporte_solo_lectura(api, datos):
    """Con acceso vigente el superadmin lee; cualquier escritura: 403 código."""
    _acceso_soporte_vigente(1)
    h = {**datos["headers"]["superadmin"], "X-Taller-Soporte": "1"}

    assert api.get("/api/v1/clientes", headers=h).status_code == 200
    r = api.post("/api/v1/clientes", headers=h, json={
        "nombre": "Nuevo", "apellido": "Cliente", "dni": "40000001",
    })
    assert r.status_code == 403
    assert r.json() == {"detail": MSG_SOPORTE, "codigo": SOPORTE_SOLO_LECTURA}


def test_todos_los_codigos_son_estables():
    """Los nombres de los códigos no cambian sin avisar (contrato Q4f)."""
    assert {
        SUSCRIPCION_SOLO_LECTURA, SUSCRIPCION_SUSPENDIDA, LIMITE_PERSONAL,
        PLAN_PERSONAL_EXCEDIDO, TALLER_SUSPENDIDO,
        SOPORTE_SIN_ACCESO, SOPORTE_SOLO_LECTURA,
    } == {
        "suscripcion_solo_lectura", "suscripcion_suspendida", "limite_personal",
        "plan_personal_excedido", "taller_suspendido",
        "soporte_sin_acceso", "soporte_solo_lectura",
    }
