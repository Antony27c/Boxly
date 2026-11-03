import pytest
from fastapi.testclient import TestClient

from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models import Cliente, Turno, Usuario
from app.models.usuario import RolUsuario
from main import app


@pytest.fixture
def datos():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        admin = Usuario(nombre="A", apellido="B", email="a@x.com", password_hash=hash_password("x"),
                        rol=RolUsuario.administrador)
        cliente = Cliente(nombre="Juan", apellido="Perez", dni="1", email="j@x.com")
        db.add_all([admin, cliente])
        db.commit()
        return {"h": {"Authorization": "Bearer " + create_access_token(admin.id)}, "cliente": cliente.id}


@pytest.fixture
def api():
    with TestClient(app) as cliente:
        yield cliente


def _crear(api, datos, hora):
    return api.post("/api/v1/turnos", headers=datos["h"],
                    json={"cliente_id": datos["cliente"], "fecha_hora": f"2030-01-07T{hora}"})


@pytest.mark.parametrize("hora", ["08:00:00", "10:00:00", "12:00:00", "14:00:00", "16:00:00"])
def test_acepta_la_grilla_de_2_horas(api, datos, hora):
    assert _crear(api, datos, hora).status_code == 201


@pytest.mark.parametrize("hora", ["08:30:00", "09:00:00", "11:00:00", "13:00:00", "17:00:00", "10:15:00"])
def test_rechaza_horarios_fuera_de_la_grilla(api, datos, hora):
    r = _crear(api, datos, hora)
    assert r.status_code == 422 and "cada 2 horas" in r.json()["detail"]


def test_mover_un_turno_a_hora_invalida_se_rechaza(api, datos):
    turno = _crear(api, datos, "08:00:00").json()
    r = api.put(f"/api/v1/turnos/{turno['id']}", headers=datos["h"], json={"fecha_hora": "2030-01-07T09:30:00"})
    assert r.status_code == 422


def test_turno_viejo_fuera_de_grilla_se_edita_si_no_cambia_la_hora(api, datos):
    from datetime import datetime
    with SessionLocal() as db:
        viejo = Turno(cliente_id=datos["cliente"], registrado_por_id=1, estado="pendiente",
                      fecha_hora=datetime(2030, 1, 8, 9, 30))
        db.add(viejo)
        db.commit()
        turno_id = viejo.id
    r = api.put(f"/api/v1/turnos/{turno_id}", headers=datos["h"],
                  json={"fecha_hora": "2030-01-08T09:30:00", "notas": "llamar antes"})
    assert r.status_code == 200
