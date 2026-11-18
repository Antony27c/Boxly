import pytest
from fastapi.testclient import TestClient

from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models import Cliente, Usuario
from app.models.usuario import RolUsuario
from app.main import app


@pytest.fixture
def datos():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        admin = Usuario(
            nombre="Admin", apellido="Uno", email="admin@x.com",
            password_hash=hash_password("x"), rol=RolUsuario.administrador,
        )
        mec1 = Usuario(
            nombre="Mec", apellido="Uno", email="mec1@x.com",
            password_hash=hash_password("x"), rol=RolUsuario.mecanico,
        )
        mec2 = Usuario(
            nombre="Mec", apellido="Dos", email="mec2@x.com",
            password_hash=hash_password("x"), rol=RolUsuario.mecanico,
        )
        cliente = Cliente(nombre="Juan", apellido="Perez", dni="1", email="j@x.com")
        db.add_all([admin, mec1, mec2, cliente])
        db.commit()
        return {
            "h": {"Authorization": "Bearer " + create_access_token(admin.id)},
            "cliente": cliente.id,
            "mec1": mec1.id,
            "mec2": mec2.id,
        }


@pytest.fixture
def api():
    with TestClient(app) as cliente:
        yield cliente


def _post(api, datos, fecha_hora, mecanico_id=None):
    cuerpo = {"cliente_id": datos["cliente"], "fecha_hora": fecha_hora}
    if mecanico_id is not None:
        cuerpo["mecanico_id"] = mecanico_id
    return api.post("/api/v1/turnos", headers=datos["h"], json=cuerpo)


def _estado(api, datos, turno_id, estado):
    return api.put(
        f"/api/v1/turnos/{turno_id}/estado",
        headers=datos["h"],
        json={"estado": estado},
    )


# --- Superposición -------------------------------------------------------


def test_turno_sin_mecanico_ocupa_el_slot_del_taller(api, datos):
    assert _post(api, datos, "2030-01-07T08:00:00").status_code == 201
    # Sin mecánico, cualquier turno no cancelado en el slot lo ocupa.
    assert _post(api, datos, "2030-01-07T08:00:00").status_code == 409
    # Un turno con mecánico sí puede coexistir: solo mira su propia agenda.
    assert _post(api, datos, "2030-01-07T08:00:00", datos["mec1"]).status_code == 201
    # Y un turno sin mecánico nuevo sigue bloqueado por los que ya hay.
    assert _post(api, datos, "2030-01-07T08:00:00").status_code == 409


def test_mecanico_solo_choca_con_su_propia_agenda(api, datos):
    assert _post(api, datos, "2030-01-07T08:00:00", datos["mec1"]).status_code == 201
    # Otro mecánico puede tener turno en el mismo horario.
    assert _post(api, datos, "2030-01-07T08:00:00", datos["mec2"]).status_code == 201
    # El mismo mecánico no.
    assert _post(api, datos, "2030-01-07T08:00:00", datos["mec1"]).status_code == 409
    assert _post(api, datos, "2030-01-07T08:00:00", datos["mec2"]).status_code == 409
    # Para ese mecánico el resto de la grilla sigue libre.
    assert _post(api, datos, "2030-01-07T10:00:00", datos["mec1"]).status_code == 201


def test_editar_a_slot_ocupado_se_rechaza(api, datos):
    t1 = _post(api, datos, "2030-01-07T08:00:00", datos["mec1"]).json()["id"]
    t2 = _post(api, datos, "2030-01-07T10:00:00", datos["mec1"]).json()["id"]

    r = api.put(
        f"/api/v1/turnos/{t2}", headers=datos["h"],
        json={"fecha_hora": "2030-01-07T08:00:00"},
    )
    assert r.status_code == 409

    r = api.put(
        f"/api/v1/turnos/{t2}", headers=datos["h"],
        json={"fecha_hora": "2030-01-07T12:00:00"},
    )
    assert r.status_code == 200
    assert t1 != t2


def test_reasignar_mecanico_a_slot_ya_ocupado(api, datos):
    _post(api, datos, "2030-01-07T08:00:00", datos["mec1"])
    t2 = _post(api, datos, "2030-01-07T08:00:00", datos["mec2"]).json()["id"]
    t3 = _post(api, datos, "2030-01-07T10:00:00", datos["mec2"]).json()["id"]

    # mec2 pasa a mec1, que ya tiene turno a esa hora -> 409.
    r = api.put(
        f"/api/v1/turnos/{t2}", headers=datos["h"],
        json={"mecanico_id": datos["mec1"]},
    )
    assert r.status_code == 409

    # A las 10 mec1 está libre -> 200.
    r = api.put(
        f"/api/v1/turnos/{t3}", headers=datos["h"],
        json={"mecanico_id": datos["mec1"]},
    )
    assert r.status_code == 200
    assert r.json()["mecanico_id"] == datos["mec1"]


def test_quitar_mecanico_a_un_slot_compartido_se_rechaza(api, datos):
    _post(api, datos, "2030-01-07T08:00:00", datos["mec1"])
    t2 = _post(api, datos, "2030-01-07T08:00:00", datos["mec2"]).json()["id"]

    # Sin mecánico el turno ocupa el slot del taller, que ya tiene uno.
    r = api.put(
        f"/api/v1/turnos/{t2}", headers=datos["h"], json={"mecanico_id": None}
    )
    assert r.status_code == 409


# --- Zona horaria ---------------------------------------------------------


def test_fecha_con_zona_se_guarda_en_hora_del_taller(api, datos):
    r = _post(api, datos, "2030-01-07T08:00:00-03:00")
    assert r.status_code == 201
    assert r.json()["fecha_hora"].startswith("2030-01-07T08:00")


def test_mismo_instante_con_otro_offset_no_esquiva_la_grilla(api, datos):
    # 11:00 UTC = 08:00 en el taller: entra en la grilla.
    assert _post(api, datos, "2030-01-07T11:00:00+00:00").status_code == 201
    # 08:00 UTC = 05:00 en el taller: fuera de la grilla, no 08:00.
    r = _post(api, datos, "2030-01-07T08:00:00+00:00")
    assert r.status_code == 422


def test_superposicion_no_se_esquiva_con_otro_offset(api, datos):
    assert _post(api, datos, "2030-01-07T08:00:00-03:00", datos["mec1"]).status_code == 201
    # El mismo instante en UTC cae en el mismo slot local.
    assert _post(api, datos, "2030-01-07T11:00:00+00:00", datos["mec1"]).status_code == 409
    assert _post(api, datos, "2030-01-07T08:00:00", datos["mec1"]).status_code == 409


def test_editar_con_zona_normaliza_la_hora(api, datos):
    turno = _post(api, datos, "2030-01-07T08:00:00").json()
    r = api.put(
        f"/api/v1/turnos/{turno['id']}", headers=datos["h"],
        json={"fecha_hora": "2030-01-08T10:00:00-03:00"},
    )
    assert r.status_code == 200
    assert r.json()["fecha_hora"].startswith("2030-01-08T10:00")


# --- Transiciones de estado -----------------------------------------------


def test_camino_valido_hasta_completado(api, datos):
    turno = _post(api, datos, "2030-01-07T08:00:00").json()["id"]
    for estado in ("confirmado", "asistio", "en_taller", "completado"):
        assert _estado(api, datos, turno, estado).status_code == 200, estado


def test_transiciones_invalidas_dan_400(api, datos):
    turno = _post(api, datos, "2030-01-07T08:00:00").json()["id"]
    # Desde pendiente solo se puede confirmar o cancelar.
    for estado in ("asistio", "en_taller", "completado"):
        r = _estado(api, datos, turno, estado)
        assert r.status_code == 400, estado
        assert "Transición inválida" in r.json()["detail"]

    # El mismo estado es un no-op permitido.
    assert _estado(api, datos, turno, "pendiente").status_code == 200

    # Cancelado es terminal.
    assert _estado(api, datos, turno, "cancelado").status_code == 200
    assert _estado(api, datos, turno, "confirmado").status_code == 400


def test_completado_tambien_es_terminal(api, datos):
    turno = _post(api, datos, "2030-01-07T08:00:00").json()["id"]
    for estado in ("confirmado", "en_taller", "completado"):
        assert _estado(api, datos, turno, estado).status_code == 200
    assert _estado(api, datos, turno, "pendiente").status_code == 400
    assert _estado(api, datos, turno, "cancelado").status_code == 400


def test_put_completo_tambien_valida_la_transicion(api, datos):
    turno = _post(api, datos, "2030-01-07T08:00:00").json()["id"]
    r = api.put(
        f"/api/v1/turnos/{turno}", headers=datos["h"], json={"estado": "completado"}
    )
    assert r.status_code == 400
    r = api.put(
        f"/api/v1/turnos/{turno}", headers=datos["h"], json={"estado": "confirmado"}
    )
    assert r.status_code == 200


def test_turno_cancelado_libera_el_slot(api, datos):
    turno = _post(api, datos, "2030-01-07T08:00:00").json()["id"]
    assert _estado(api, datos, turno, "cancelado").status_code == 200
    assert _post(api, datos, "2030-01-07T08:00:00").status_code == 201
