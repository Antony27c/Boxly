"""Órdenes cerradas: no admiten edición de campos, solo comentario en el historial."""
import pytest
from fastapi.testclient import TestClient

from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models import Cliente, Orden, Usuario, Vehiculo
from app.models.usuario import RolUsuario
from app.main import app


@pytest.fixture
def datos():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        admin = Usuario(
            nombre="Admin", apellido="Taller", email="admin@x.com",
            password_hash=hash_password("x"), rol=RolUsuario.administrador,
        )
        cliente = Cliente(nombre="Juan", apellido="Perez", dni="30111222")
        db.add_all([admin, cliente])
        db.flush()
        vehiculo = Vehiculo(cliente_id=cliente.id, patente="ABC123", marca="VW", modelo="Gol")
        db.add(vehiculo)
        db.flush()
        orden = Orden(
            cliente_id=cliente.id, vehiculo_id=vehiculo.id, creado_por_id=admin.id,
            codigo="OT-CERRADA-1", estado="pendiente",
            descripcion_ingreso="Revisión de tren delantero",
        )
        db.add(orden)
        db.commit()
        return {
            "h": {"Authorization": "Bearer " + create_access_token(admin.id)},
            "orden": orden.id,
        }


@pytest.fixture
def api():
    with TestClient(app) as cliente:
        yield cliente


def _poner_estado(orden_id: int, estado: str) -> None:
    with SessionLocal() as db:
        db.get(Orden, orden_id).estado = estado
        db.commit()


def _patch(api, datos, payload):
    return api.patch(
        f"/api/v1/ordenes/{datos['orden']}", headers=datos["h"], json=payload
    )


def _historial(api, datos):
    return api.get(
        f"/api/v1/ordenes/{datos['orden']}/historial", headers=datos["h"]
    ).json()


def test_orden_entregada_rechaza_edicion_de_campos(api, datos):
    _poner_estado(datos["orden"], "entregado")
    r = _patch(api, datos, {"diagnostico": "no debería guardarse"})
    assert r.status_code == 400
    assert r.json()["detail"] == "Orden cerrada: no se puede modificar"


def test_orden_cancelada_rechaza_edicion_de_campos(api, datos):
    _poner_estado(datos["orden"], "cancelado")
    r = _patch(api, datos, {"descripcion_ingreso": "tampoco esto"})
    assert r.status_code == 400
    assert r.json()["detail"] == "Orden cerrada: no se puede modificar"


def test_orden_cerrada_rechaza_campo_aunque_venga_con_comentario(api, datos):
    _poner_estado(datos["orden"], "entregado")
    r = _patch(api, datos, {
        "diagnostico": "intento de cambio",
        "comentario_cambio": "solo un comentario",
    })
    assert r.status_code == 400
    assert r.json()["detail"] == "Orden cerrada: no se puede modificar"


def test_orden_cerrada_no_se_reabre(api, datos):
    _poner_estado(datos["orden"], "cancelado")
    r = _patch(api, datos, {
        "estado": "pendiente", "comentario_cambio": "queremos reabrirla",
    })
    assert r.status_code == 400
    assert r.json()["detail"] == "Orden cerrada: no se puede modificar"


def test_orden_cerrada_permite_comentario_en_historial(api, datos):
    _poner_estado(datos["orden"], "entregado")
    r = _patch(api, datos, {"comentario_cambio": "  Cliente confirmó la recepción  "})
    assert r.status_code == 200
    assert r.json()["estado"] == "entregado"
    comentarios = [h["comentario"] for h in _historial(api, datos)]
    assert "Cliente confirmó la recepción" in comentarios


def test_orden_cerrada_reenviar_mismo_estado_con_comentario(api, datos):
    _poner_estado(datos["orden"], "cancelado")
    r = _patch(api, datos, {
        "estado": "cancelado", "comentario_cambio": "Se reenvía la misma orden",
    })
    assert r.status_code == 200
    comentarios = [h["comentario"] for h in _historial(api, datos)]
    assert "Se reenvía la misma orden" in comentarios
