import pytest
from fastapi.testclient import TestClient

from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.main import app
from app.models import Cliente, Orden, Usuario, Vehiculo
from app.models.usuario import RolUsuario


@pytest.fixture
def datos():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        admin = Usuario(nombre="Admin", apellido="Taller", email="admin@x.com",
                        password_hash=hash_password("x"), rol=RolUsuario.administrador)
        cliente = Cliente(nombre="Juan", apellido="Perez", dni="10000001")
        db.add_all([admin, cliente])
        db.flush()
        vehiculo = Vehiculo(cliente_id=cliente.id, patente="AAA111", marca="VW", modelo="Gol")
        db.add(vehiculo)
        db.flush()
        orden = Orden(cliente_id=cliente.id, vehiculo_id=vehiculo.id,
                      creado_por_id=admin.id, mecanico_id=None,
                      codigo="OT-1001", estado="pendiente",
                      descripcion_ingreso="Cambio de aceite y filtros")
        db.add(orden)
        db.commit()
        return {
            "admin": {"Authorization": "Bearer " + create_access_token(admin.id)},
            "orden": orden.id,
        }


@pytest.fixture
def api():
    with TestClient(app) as cliente:
        yield cliente


def _parche(api, datos, orden_id, cuerpo):
    return api.patch(f"/api/v1/ordenes/{orden_id}", headers=datos["admin"], json=cuerpo)


def _mover(api, datos, orden_id, estado, comentario="Avance del trabajo"):
    return _parche(api, datos, orden_id,
                   {"estado": estado, "comentario_cambio": comentario})


def _llevar_a(api, datos, orden_id, camino):
    """Recorre el camino de estados desde 'pendiente'; cada salto debe dar 200."""
    for destino in camino:
        r = _mover(api, datos, orden_id, destino)
        assert r.status_code == 200, f"no se pudo llegar a {destino}: {r.status_code} {r.text}"
    return camino[-1] if camino else "pendiente"


# Cada arista válida de TRANSICIONES_VALIDAS, una sola vez.
CASOS_VALIDOS = [
    ([], "ingresado"),
    ([], "cancelado"),
    (["ingresado"], "en_diagnostico"),
    (["ingresado"], "cancelado"),
    (["ingresado", "en_diagnostico"], "esperando_repuestos"),
    (["ingresado", "en_diagnostico"], "listo"),
    (["ingresado", "en_diagnostico"], "cancelado"),
    (["ingresado", "en_diagnostico", "esperando_repuestos"], "listo"),
    (["ingresado", "en_diagnostico", "esperando_repuestos"], "cancelado"),
    (["ingresado", "en_diagnostico", "listo"], "entregado"),
]


@pytest.mark.parametrize("camino,destino", CASOS_VALIDOS)
def test_transicion_valida_pasa(api, datos, camino, destino):
    _llevar_a(api, datos, datos["orden"], camino)
    r = _mover(api, datos, datos["orden"], destino)
    assert r.status_code == 200
    assert r.json()["estado"] == destino


# Saltos que la máquina no permite, desde cada estado alcanzable.
CASOS_INVALIDOS = [
    ([], "listo"),
    ([], "entregado"),
    ([], "en_diagnostico"),
    ([], "esperando_repuestos"),
    (["ingresado"], "pendiente"),
    (["ingresado"], "listo"),
    (["ingresado"], "entregado"),
    (["ingresado"], "esperando_repuestos"),
    (["ingresado", "en_diagnostico"], "ingresado"),
    (["ingresado", "en_diagnostico"], "pendiente"),
    (["ingresado", "en_diagnostico"], "entregado"),
    (["ingresado", "en_diagnostico", "esperando_repuestos"], "en_diagnostico"),
    (["ingresado", "en_diagnostico", "esperando_repuestos"], "entregado"),
    (["ingresado", "en_diagnostico", "listo"], "cancelado"),
    (["ingresado", "en_diagnostico", "listo"], "esperando_repuestos"),
    (["cancelado"], "pendiente"),
    (["cancelado"], "ingresado"),
    (["ingresado", "en_diagnostico", "listo", "entregado"], "cancelado"),
    (["ingresado", "en_diagnostico", "listo", "entregado"], "listo"),
]


@pytest.mark.parametrize("camino,destino", CASOS_INVALIDOS)
def test_transicion_invalida_da_400(api, datos, camino, destino):
    _llevar_a(api, datos, datos["orden"], camino)
    r = _mover(api, datos, datos["orden"], destino)
    assert r.status_code == 400


def test_cambiar_estado_sin_comentario_da_422(api, datos):
    for cuerpo in (
        {"estado": "ingresado"},
        {"estado": "ingresado", "comentario_cambio": ""},
        {"estado": "ingresado", "comentario_cambio": "   "},
    ):
        r = _parche(api, datos, datos["orden"], cuerpo)
        assert r.status_code == 422, cuerpo


def test_estado_desconocido_da_422(api, datos):
    r = _parche(api, datos, datos["orden"],
                {"estado": "volando", "comentario_cambio": "prueba"})
    assert r.status_code == 422


def test_entregado_registra_fecha_entrega(api, datos):
    _llevar_a(api, datos, datos["orden"], ["ingresado", "en_diagnostico", "listo"])
    r = _mover(api, datos, datos["orden"], "entregado")
    assert r.status_code == 200
    fecha = r.json()["fecha_entrega"]
    assert fecha is not None
    with SessionLocal() as db:
        assert db.get(Orden, datos["orden"]).fecha_entrega is not None


def test_una_orden_entregada_no_cambia_de_estado(api, datos):
    _llevar_a(api, datos, datos["orden"], ["ingresado", "en_diagnostico", "listo", "entregado"])
    for destino in ("cancelado", "listo", "pendiente"):
        r = _mover(api, datos, datos["orden"], destino)
        assert r.status_code == 400, destino


def test_una_orden_cancelada_no_cambia_de_estado(api, datos):
    _llevar_a(api, datos, datos["orden"], ["ingresado", "cancelado"])
    for destino in ("pendiente", "ingresado", "listo"):
        r = _mover(api, datos, datos["orden"], destino)
        assert r.status_code == 400, destino


def test_el_historial_registra_cada_cambio(api, datos):
    _llevar_a(api, datos, datos["orden"], ["ingresado"])
    _mover(api, datos, datos["orden"], "cancelado")
    r = api.get(f"/api/v1/ordenes/{datos['orden']}/historial", headers=datos["admin"])
    assert r.status_code == 200
    filas = r.json()
    # La orden del fixture se insertó directo en la base: el historial arranca
    # con el primer cambio de estado (no hay fila "Orden creada").
    assert [h["estado_nuevo"] for h in filas] == ["ingresado", "cancelado"]
    assert [h["estado_anterior"] for h in filas] == ["pendiente", "ingresado"]
    assert all(h["comentario"] == "Avance del trabajo" for h in filas)
