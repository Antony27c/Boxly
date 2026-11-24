"""Integridad del stock de repuestos en las órdenes de trabajo."""
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.main import app
from app.models import Cliente, Orden, Repuesto, Usuario, Vehiculo
from app.models.usuario import RolUsuario


@pytest.fixture
def datos():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        admin = Usuario(
            nombre="Admin", apellido="Taller", email="admin@x.com",
            password_hash=hash_password("x"), rol=RolUsuario.administrador,
        )
        cliente = Cliente(nombre="Juan", apellido="Perez", dni="30111222", email="j@x.com")
        db.add_all([admin, cliente])
        db.flush()
        vehiculo = Vehiculo(cliente_id=cliente.id, patente="ABC123", marca="VW", modelo="Gol")
        repuesto = Repuesto(
            codigo="ACEITE5W30", nombre="Aceite 5W30", stock=5, precio=Decimal("1500.00")
        )
        db.add_all([vehiculo, repuesto])
        db.flush()
        orden = Orden(
            cliente_id=cliente.id, vehiculo_id=vehiculo.id, creado_por_id=admin.id,
            codigo="OT-STOCK-1", estado="pendiente",
            descripcion_ingreso="Cambio de aceite y filtros",
        )
        db.add(orden)
        db.commit()
        return {
            "h": {"Authorization": "Bearer " + create_access_token(admin.id)},
            "orden": orden.id,
            "repuesto": repuesto.id,
        }


@pytest.fixture
def api():
    with TestClient(app) as cliente:
        yield cliente


def _stock(repuesto_id: int) -> int:
    with SessionLocal() as db:
        return db.get(Repuesto, repuesto_id).stock


def _agregar(api, datos, payload):
    return api.post(
        f"/api/v1/ordenes/{datos['orden']}/detalles", headers=datos["h"], json=payload
    )


def _agregar_repuesto(api, datos, cantidad):
    return _agregar(api, datos, {"repuesto_id": datos["repuesto"], "cantidad": cantidad})


def test_agregar_linea_descuenta_stock(api, datos):
    r = _agregar_repuesto(api, datos, 2)
    assert r.status_code == 201
    assert _stock(datos["repuesto"]) == 3


def test_stock_insuficiente_da_409_sin_tocar_el_stock(api, datos):
    r = _agregar_repuesto(api, datos, 10)
    assert r.status_code == 409
    assert "Stock insuficiente" in r.json()["detail"]
    assert _stock(datos["repuesto"]) == 5
    detalles = api.get(f"/api/v1/ordenes/{datos['orden']}/detalles", headers=datos["h"]).json()
    assert detalles == []


def test_quitar_linea_devuelve_stock(api, datos):
    detalle = _agregar_repuesto(api, datos, 2).json()
    assert _stock(datos["repuesto"]) == 3
    r = api.delete(
        f"/api/v1/ordenes/{datos['orden']}/detalles/{detalle['id']}", headers=datos["h"]
    )
    assert r.status_code == 200
    assert _stock(datos["repuesto"]) == 5


def test_linea_de_mano_de_obra_no_toca_stock(api, datos):
    r = _agregar(api, datos, {"descripcion": "Mano de obra", "cantidad": 1, "precio_unitario": 5000})
    assert r.status_code == 201
    assert _stock(datos["repuesto"]) == 5


def test_cancelar_orden_devuelve_stock_y_deja_historial(api, datos):
    _agregar_repuesto(api, datos, 2)
    assert _stock(datos["repuesto"]) == 3
    r = api.patch(
        f"/api/v1/ordenes/{datos['orden']}", headers=datos["h"],
        json={"estado": "cancelado", "comentario_cambio": "El cliente se arrepintió"},
    )
    assert r.status_code == 200
    assert _stock(datos["repuesto"]) == 5
    historial = api.get(f"/api/v1/ordenes/{datos['orden']}/historial", headers=datos["h"]).json()
    assert "Stock devuelto por cancelación" in [h["comentario"] for h in historial]


def test_cancelar_dos_veces_no_duplica_la_devolucion(api, datos):
    _agregar_repuesto(api, datos, 2)
    for _ in range(2):
        r = api.patch(
            f"/api/v1/ordenes/{datos['orden']}", headers=datos["h"],
            json={"estado": "cancelado", "comentario_cambio": "Se cancela"},
        )
        assert r.status_code == 200
    assert _stock(datos["repuesto"]) == 5


def test_eliminar_orden_pendiente_devuelve_stock(api, datos):
    _agregar_repuesto(api, datos, 2)
    assert _stock(datos["repuesto"]) == 3
    r = api.delete(f"/api/v1/ordenes/{datos['orden']}", headers=datos["h"])
    assert r.status_code == 200
    assert _stock(datos["repuesto"]) == 5
