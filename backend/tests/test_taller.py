import pytest

from fastapi.testclient import TestClient

from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.main import app
from app.models import Cliente, ConfiguracionTaller, Usuario
from app.models.usuario import RolUsuario


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


def test_get_sin_fila_crea_con_valores_por_defecto(api, datos):
    r = api.get("/api/v1/taller", headers=datos["headers"]["administrador"])
    assert r.status_code == 200
    cuerpo = r.json()
    assert cuerpo["nombre"] == "Mi taller"
    assert cuerpo["hora_apertura"] == "08:00"
    assert cuerpo["hora_cierre"] == "18:00"
    assert cuerpo["dias_garantia"] == 90
    assert cuerpo["pago_online"] is True
    for campo in ("razon_social", "cuit", "direccion", "telefono", "email",
                  "sitio_web", "mensaje_portal", "pie_ticket", "actualizado_en"):
        assert cuerpo[campo] is None

    with SessionLocal() as db:
        config = db.query(ConfiguracionTaller).one()
        assert config.taller_id == 1


@pytest.mark.parametrize("rol", ["administrador", "recepcion", "mecanico", "cliente"])
def test_get_para_cualquier_usuario_del_taller(api, datos, rol):
    assert api.get("/api/v1/taller", headers=datos["headers"][rol]).status_code == 200


def test_get_superadmin_da_403(api, datos):
    # El superadmin no opera dentro de los talleres (docs/Plataforma.md, P3).
    assert api.get("/api/v1/taller", headers=datos["headers"]["superadmin"]).status_code == 403


def test_get_y_put_sin_token_dan_401(api):
    assert api.get("/api/v1/taller").status_code == 401
    assert api.put("/api/v1/taller", json={"nombre": "Otro"}).status_code == 401


def test_put_administrador_actualiza_solo_lo_enviado(api, datos):
    h = datos["headers"]["administrador"]
    api.get("/api/v1/taller", headers=h)  # asegura que exista la fila

    r = api.put("/api/v1/taller", headers=h,
                json={"telefono": "11-5555-0000", "dias_garantia": 30})
    assert r.status_code == 200
    cuerpo = r.json()
    assert cuerpo["telefono"] == "11-5555-0000"
    assert cuerpo["dias_garantia"] == 30
    # Lo que no se mandó queda como estaba.
    assert cuerpo["nombre"] == "Mi taller"
    assert cuerpo["hora_apertura"] == "08:00"
    assert cuerpo["actualizado_en"] is not None

    with SessionLocal() as db:
        taller = db.query(ConfiguracionTaller).one()
        assert taller.actualizado_por_id == datos["ids"]["administrador"]
        assert taller.actualizado_en is not None


@pytest.mark.parametrize("rol", ["superadmin", "recepcion", "mecanico", "cliente"])
def test_put_solo_para_el_administrador(api, datos, rol):
    r = api.put("/api/v1/taller", headers=datos["headers"][rol], json={"nombre": "Otro"})
    assert r.status_code == 403


@pytest.mark.parametrize(
    "cuerpo",
    [
        {"hora_apertura": "25:00"},                       # hora mal formada
        {"hora_apertura": "18:00", "hora_cierre": "08:00"},  # apertura >= cierre
        {"hora_apertura": "20:00"},                       # rompe el horario ya guardado
        {"cuit": "2012345678"},                           # 10 dígitos
        {"email": "no-es-un-mail"},                       # email inválido
        {"dias_garantia": -1},                            # negativo
        {"dias_garantia": 3651},                          # fuera de rango
        {"nombre": "A"},                                  # 1 carácter
        {"nombre": None},                                 # null en campo obligatorio
    ],
)
def test_put_validaciones_422(api, datos, cuerpo):
    r = api.put("/api/v1/taller", headers=datos["headers"]["administrador"], json=cuerpo)
    assert r.status_code == 422


def test_cuit_se_normaliza_con_o_sin_guiones(api, datos):
    h = datos["headers"]["administrador"]
    api.get("/api/v1/taller", headers=h)

    r = api.put("/api/v1/taller", headers=h, json={"cuit": "20123456789"})
    assert r.status_code == 200
    assert r.json()["cuit"] == "20-12345678-9"

    r = api.put("/api/v1/taller", headers=h, json={"cuit": "20-12345678-9"})
    assert r.status_code == 200
    assert r.json()["cuit"] == "20-12345678-9"


def test_strings_vacios_en_campos_opcionales_quedan_en_null(api, datos):
    h = datos["headers"]["administrador"]
    api.get("/api/v1/taller", headers=h)

    api.put("/api/v1/taller", headers=h, json={"telefono": "11-5555-0000", "sitio_web": " taller.com "})
    r = api.put("/api/v1/taller", headers=h, json={"telefono": "", "sitio_web": ""})
    assert r.status_code == 200
    cuerpo = r.json()
    assert cuerpo["telefono"] is None
    assert cuerpo["sitio_web"] is None
