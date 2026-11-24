"""Fin de la demo: 3 días de solo lectura, suspensión y encuesta (tarea C6).

Cubre docs/Oferta.md: la demo no tiene gracia (1-3 días solo lectura, desde el
4 suspendida), la encuesta opcional de una sola vez por taller y el listado
del superadmin en /plataforma/encuestas.
"""
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.security import create_access_token, hash_password
from app.core.suscripcion import estado_suscripcion
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.main import app
from app.models import Cliente, EncuestaDemo, Taller, Usuario, Vehiculo
from app.models.usuario import RolUsuario

PASSWORD = "Clave1234"
MSG_VENCIDA = "La suscripción del taller está vencida"
MSG_LECTURA = "El taller está en solo lectura por falta de pago de la suscripción"
ENCUESTA = "/api/v1/suscripcion/encuesta"
PLATAFORMA_ENCUESTAS = "/api/v1/plataforma/encuestas"


def _usuario(nombre, email, rol, taller_id=None, activo=True):
    return Usuario(
        nombre=nombre,
        apellido="Prueba",
        email=email,
        password_hash=hash_password(PASSWORD),
        rol=rol,
        taller_id=taller_id,
        activo=activo,
    )


def _acceso(taller_id: int, tipo: str, dias: int) -> None:
    """Fija tipo_acceso y vencimiento del taller (dias<0 = ya venció)."""
    with SessionLocal() as db:
        taller = db.get(Taller, taller_id)
        taller.tipo_acceso = tipo
        taller.suscripcion_vence_en = date.today() + timedelta(days=dias)
        db.commit()


@pytest.fixture
def datos():
    """Taller 1 y taller 2 (ambos demo vencidos hace 2 días), un taller pago y
    usuarios de cada rol más un superadmin."""
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    hoy = date.today()
    with SessionLocal() as db:
        taller1 = db.get(Taller, 1)
        taller1.tipo_acceso = "demo"
        taller1.plan_codigo = "pro"
        taller1.suscripcion_vence_en = hoy - timedelta(days=2)
        taller2 = Taller(
            nombre="Taller Dos", plan_codigo="pro", tipo_acceso="demo",
            suscripcion_vence_en=hoy - timedelta(days=2),
        )
        taller3 = Taller(
            nombre="Taller Pago", plan_codigo="esencial", tipo_acceso="pago",
            suscripcion_vence_en=hoy - timedelta(days=4),
        )
        db.add_all([taller2, taller3])
        db.flush()

        superadmin = _usuario("Super", "sa@x.com", RolUsuario.superadmin)
        admin = _usuario("Admin", "admin@x.com", RolUsuario.administrador)
        recepcion = _usuario("Recep", "recep@x.com", RolUsuario.recepcion)
        mecanico = _usuario("Mec", "mec@x.com", RolUsuario.mecanico)
        admin2 = _usuario("Admin2", "admin2@x.com", RolUsuario.administrador, taller2.id)
        recepcion2 = _usuario("Recep2", "recep2@x.com", RolUsuario.recepcion, taller2.id)
        admin3 = _usuario("Admin3", "admin3@x.com", RolUsuario.administrador, taller3.id)

        cliente = Cliente(nombre="Juan", apellido="Perez", dni="30000003",
                          email="juan@x.com")
        db.add_all([
            superadmin, admin, recepcion, mecanico,
            admin2, recepcion2, admin3, cliente,
        ])
        db.flush()
        vehiculo = Vehiculo(cliente_id=cliente.id, patente="BBB222",
                            marca="Ford", modelo="Focus")
        db.add(vehiculo)
        db.commit()

        usuarios = {
            "superadmin": superadmin, "admin": admin, "recepcion": recepcion,
            "mecanico": mecanico, "admin2": admin2, "recepcion2": recepcion2,
            "admin3": admin3,
        }
        return {
            "ids": {k: u.id for k, u in usuarios.items()},
            "taller2_id": taller2.id,
            "taller3_id": taller3.id,
            "vehiculo_id": vehiculo.id,
            "headers": {
                k: {"Authorization": "Bearer " + create_access_token(u.id)}
                for k, u in usuarios.items()
            },
        }


@pytest.fixture
def api():
    with TestClient(app) as cliente:
        yield cliente


def _nueva_orden(api, headers, vehiculo_id):
    return api.post("/api/v1/ordenes", headers=headers, json={
        "vehiculo_id": vehiculo_id, "descripcion_ingreso": "Service",
    })


def _encuestas(db):
    return list(db.scalars(select(EncuestaDemo).order_by(EncuestaDemo.id)))


# --- Estado de la suscripción según el tipo de acceso -------------------------


def test_estado_suscripcion_demo_dias_limite():
    """La demo no tiene gracia: 1-3 días solo lectura, desde el 4 suspendida."""
    hoy = date.today()
    for dias in range(0, 6):
        vence = hoy - timedelta(days=dias)
        assert estado_suscripcion(vence, hoy, "demo") == (
            "al_dia" if dias == 0
            else "solo_lectura" if dias <= 3
            else "suspendida"
        ), dias
    # Pago y piloto conservan la tabla de siempre.
    assert estado_suscripcion(hoy - timedelta(days=4), hoy, "pago") == "gracia"
    assert estado_suscripcion(hoy - timedelta(days=10), hoy, "piloto") == "solo_lectura"
    assert estado_suscripcion(hoy - timedelta(days=40), hoy, "piloto") == "suspendida"


def test_demo_vencida_2_dias_solo_lectura(api, datos):
    """Días 1-3 de la demo vencida: se lee pero no se escribe."""
    h = datos["headers"]["admin"]
    r = api.get("/api/v1/suscripcion", headers=h)
    assert r.status_code == 200
    assert r.json()["estado"] == "solo_lectura"

    r = _nueva_orden(api, h, datos["vehiculo_id"])
    assert r.status_code == 403
    assert r.json()["detail"] == MSG_LECTURA

    assert api.get("/api/v1/ordenes", headers=h).status_code == 200
    # La encuesta ya corresponde: demo vencida y sin responder.
    r = api.get(ENCUESTA, headers=h)
    assert r.status_code == 200
    assert r.json() == {"corresponde": True, "respondida": False}


def test_demo_vencida_4_dias_suspendida(api, datos):
    """Desde el día 4 la demo queda suspendida: nadie lee, solo el admin paga."""
    _acceso(1, "demo", -4)
    h_admin = datos["headers"]["admin"]
    h_recep = datos["headers"]["recepcion"]
    h_mec = datos["headers"]["mecanico"]

    for h in (h_admin, h_recep, h_mec):
        r = api.get("/api/v1/ordenes", headers=h)
        assert r.status_code == 403
        assert r.json()["detail"] == MSG_VENCIDA

    # El administrador sigue entrando a /suscripcion* (pago y encuesta).
    assert api.get("/api/v1/suscripcion", headers=h_admin).status_code == 200
    assert api.get(ENCUESTA, headers=h_admin).status_code == 200

    # /auth/* pasa para cualquier rol: sin esto el frontend desloguea al
    # personal en cada recarga (pedido del coordinador, prueba E1).
    for h in (h_admin, h_recep, h_mec):
        assert api.get("/api/v1/auth/me", headers=h).status_code == 200
    # Pero el resto de las rutas del taller sigue cerrada para recepción.
    assert api.get("/api/v1/suscripcion", headers=h_recep).status_code == 403


def test_taller_pago_vencido_4_dias_sigue_en_gracia(api, datos):
    """La demo no tiene gracia, pero el pago sí: a los 4 días sigue en gracia."""
    _acceso(1, "pago", -4)
    h = datos["headers"]["admin"]
    r = api.get("/api/v1/suscripcion", headers=h)
    assert r.status_code == 200
    assert r.json()["estado"] == "gracia"
    # En gracia se escribe normal y la encuesta no corresponde.
    assert _nueva_orden(api, h, datos["vehiculo_id"]).status_code == 201
    r = api.get(ENCUESTA, headers=h)
    assert r.json() == {"corresponde": False, "respondida": False}


def test_demo_que_todavia_no_vencio_no_tiene_encuesta(api, datos):
    _acceso(1, "demo", 5)
    h = datos["headers"]["admin"]
    assert api.get("/api/v1/suscripcion", headers=h).json()["estado"] == "al_dia"
    assert api.get(ENCUESTA, headers=h).json() == {
        "corresponde": False, "respondida": False,
    }


# --- La encuesta ----------------------------------------------------------------


def test_encuesta_se_responde_una_sola_vez(api, datos):
    h = datos["headers"]["admin"]
    cuerpo = {
        "gusto": "La gestión del taller",
        "mejoras": "Más reportes",
        "sugerencias": "Exportar a Excel",
        "puntaje": 5,
        "intencion": "contratar",
    }
    r = api.post(ENCUESTA, headers=h, json=cuerpo)
    assert r.status_code == 201, r.text
    assert r.json()["salteada"] is False
    assert r.json()["taller_nombre"] == "Taller principal"

    # La segunda respuesta da 409 y el estado queda cerrada.
    r = api.post(ENCUESTA, headers=h, json={"salteada": True})
    assert r.status_code == 409
    r = api.get(ENCUESTA, headers=h)
    assert r.json() == {"corresponde": False, "respondida": True}

    with SessionLocal() as db:
        encuestas = _encuestas(db)
        assert len(encuestas) == 1
        assert encuestas[0].taller_id == 1
        assert encuestas[0].gusto == "La gestión del taller"
        assert encuestas[0].puntaje == 5
        assert encuestas[0].intencion == "contratar"
        assert encuestas[0].respondida_por_id == datos["ids"]["admin"]


def test_encuesta_se_puede_saltear(api, datos):
    h = datos["headers"]["admin"]
    r = api.post(ENCUESTA, headers=h, json={"salteada": True})
    assert r.status_code == 201, r.text
    assert r.json()["salteada"] is True

    # Salteada también cuenta como respondida: no se puede volver a enviar.
    r = api.post(ENCUESTA, headers=h, json={"gusto": "Ahora sí"})
    assert r.status_code == 409
    assert api.get(ENCUESTA, headers=h).json()["respondida"] is True


def test_encuesta_validaciones(api, datos):
    h = datos["headers"]["admin"]
    assert api.post(ENCUESTA, headers=h, json={"puntaje": 6}).status_code == 422
    assert api.post(ENCUESTA, headers=h, json={"puntaje": 0}).status_code == 422
    assert api.post(ENCUESTA, headers=h, json={"intencion": "quizás"}).status_code == 422
    assert api.post(ENCUESTA, headers=h, json={"gusto": "x" * 1001}).status_code == 422


def test_encuesta_solo_administrador(api, datos):
    for rol in ("recepcion", "mecanico"):
        h = datos["headers"][rol]
        assert api.get(ENCUESTA, headers=h).status_code == 403
        assert api.post(ENCUESTA, headers=h, json={"salteada": True}).status_code == 403
    # Y un admin de otro taller responde por el suyo (el taller 2 también es
    # demo vencida, así que le corresponde): la fila queda en su taller.
    r = api.post(ENCUESTA, headers=datos["headers"]["admin2"], json={"salteada": True})
    assert r.status_code == 201
    with SessionLocal() as db:
        filas = {e.taller_id for e in _encuestas(db)}
        assert filas == {datos["taller2_id"]}


def test_otro_taller_no_ve_la_encuesta_ajena(api, datos):
    """La encuesta del taller 1 no aparece en el estado del taller 2 ni el
    admin del taller 2 puede listar las de plataforma."""
    h1 = datos["headers"]["admin"]
    h2 = datos["headers"]["admin2"]
    assert api.post(ENCUESTA, headers=h1, json={
        "gusto": "Secreto del taller 1", "intencion": "no",
    }).status_code == 201

    # El estado del taller 2 solo habla de su propio taller.
    r = api.get(ENCUESTA, headers=h2)
    assert r.status_code == 200
    assert r.json() == {"corresponde": True, "respondida": False}
    # Y la ruta de plataforma es solo del superadmin.
    assert api.get(PLATAFORMA_ENCUESTAS, headers=h2).status_code == 403


def test_superadmin_lista_y_filtra_encuestas(api, datos):
    h1 = datos["headers"]["admin"]
    h2 = datos["headers"]["admin2"]
    h3 = datos["headers"]["admin3"]
    hs = datos["headers"]["superadmin"]

    # Taller 1 responde completo; taller 2 saltea; taller 3 (pago) no puede.
    assert api.post(ENCUESTA, headers=h1, json={
        "gusto": "Me gustó", "puntaje": 5, "intencion": "contratar",
    }).status_code == 201
    assert api.post(ENCUESTA, headers=h2, json={"salteada": True}).status_code == 201
    # El taller pago vencido no es demo: la encuesta no le corresponde (403).
    assert api.post(ENCUESTA, headers=h3, json={"salteada": True}).status_code == 403

    r = api.get(PLATAFORMA_ENCUESTAS, headers=hs)
    assert r.status_code == 200, r.text
    assert r.headers["X-Total-Count"] == "2"
    items = r.json()
    assert len(items) == 2
    por_taller = {i["taller_id"]: i for i in items}
    e1 = por_taller[1]
    assert e1["taller_nombre"] == "Taller principal"
    assert e1["gusto"] == "Me gustó"
    assert e1["puntaje"] == 5
    assert e1["intencion"] == "contratar"
    assert e1["salteada"] is False
    assert e1["respondida_por"] == "Admin Prueba"
    assert e1["creado_en"] is not None
    e2 = por_taller[datos["taller2_id"]]
    assert e2["taller_nombre"] == "Taller Dos"
    assert e2["salteada"] is True

    # Filtros del contrato más los del coordinador.
    r = api.get(PLATAFORMA_ENCUESTAS, headers=hs, params={"intencion": "contratar"})
    assert [i["taller_id"] for i in r.json()] == [1]
    r = api.get(PLATAFORMA_ENCUESTAS, headers=hs,
                params={"taller_id": datos["taller2_id"]})
    assert [i["taller_id"] for i in r.json()] == [datos["taller2_id"]]
    r = api.get(PLATAFORMA_ENCUESTAS, headers=hs, params={"puntaje_min": 4})
    assert [i["taller_id"] for i in r.json()] == [1]
    # desde/hasta filtran por día (en UTC, como se guardan las fechas).
    ayer = (date.today() - timedelta(days=1)).isoformat()
    manana = (date.today() + timedelta(days=1)).isoformat()
    r = api.get(PLATAFORMA_ENCUESTAS, headers=hs,
                params={"desde": ayer, "hasta": manana})
    assert len(r.json()) == 2
    r = api.get(PLATAFORMA_ENCUESTAS, headers=hs,
                params={"desde": "2000-01-01", "hasta": "2000-01-02"})
    assert r.json() == []
    assert r.headers["X-Total-Count"] == "0"
    # Paginación opt-in como el resto de los listados.
    r = api.get(PLATAFORMA_ENCUESTAS, headers=hs, params={"limit": 1})
    assert len(r.json()) == 1
    assert r.headers["X-Total-Count"] == "2"


def test_encuesta_en_taller_suspendido_se_responde(api, datos):
    """Suspendida la demo (día 4+), el admin igual entra a /suscripcion* y
    responde o saltea la encuesta."""
    _acceso(1, "demo", -10)
    h = datos["headers"]["admin"]
    assert api.get("/api/v1/ordenes", headers=h).status_code == 403
    r = api.post(ENCUESTA, headers=h, json={"salteada": True})
    assert r.status_code == 201, r.text


def test_pagar_plan_saca_al_taller_de_la_demo(api, datos):
    """Un pago aprobado pasa el taller a 'pago' al instante (docs/Oferta.md);
    la conversión la implementa C2 en el registro de pagos."""
    _acceso(1, "demo", -10)  # suspendida
    h = datos["headers"]["admin"]
    hs = datos["headers"]["superadmin"]
    assert api.get("/api/v1/ordenes", headers=h).status_code == 403

    r = api.post("/api/v1/plataforma/talleres/1/pagos", headers=hs, json={
        "monto": "79000.00", "meses": 1, "referencia": "pago demo",
    })
    assert r.status_code == 201, r.text

    with SessionLocal() as db:
        taller = db.get(Taller, 1)
        assert taller.tipo_acceso == "pago"
        assert taller.suscripcion_vence_en > date.today()

    # Ya puede escribir y la suscripción queda al día.
    r = api.get("/api/v1/suscripcion", headers=h)
    assert r.status_code == 200
    assert r.json()["estado"] == "al_dia"
    assert _nueva_orden(api, h, datos["vehiculo_id"]).status_code == 201
