"""Paginación opt-in de los listados (limit/offset + X-Total-Count).

El body sigue siendo un array JSON igual que antes (compatible con el
frontend); el total filtrado viaja en el header X-Total-Count.
"""

from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.main import app
from app.models import Cliente, Repuesto, Usuario, Vehiculo
from app.models.usuario import RolUsuario


@pytest.fixture
def datos():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        admin = Usuario(
            nombre="Admin", apellido="Root", email="admin@x.com",
            password_hash=hash_password("x"), rol=RolUsuario.administrador,
        )
        recepcion = Usuario(
            nombre="Rita", apellido="Mostrador", email="recepcion@x.com",
            password_hash=hash_password("x"), rol=RolUsuario.recepcion,
        )
        mecanico = Usuario(
            nombre="Memo", apellido="Mecanico", email="mecanico@x.com",
            password_hash=hash_password("x"), rol=RolUsuario.mecanico,
        )
        inactivo = Usuario(
            nombre="Ina", apellido="Activo", email="inactivo@x.com",
            password_hash=hash_password("x"), rol=RolUsuario.recepcion,
            activo=False,
        )
        db.add_all([admin, recepcion, mecanico, inactivo])
        db.flush()

        repuestos = [
            Repuesto(
                codigo=f"REP-{i:03d}", nombre=f"Repuesto {i:02d}",
                stock=5, stock_minimo=1, precio=Decimal("10.00"),
            )
            for i in range(5)
        ]
        repuestos.append(
            Repuesto(
                codigo="REP-999", nombre="Repuesto viejo",
                stock=0, stock_minimo=0, precio=Decimal("1.00"), activo=False,
            )
        )
        db.add_all(repuestos)

        cliente = Cliente(nombre="Juan", apellido="Perez", dni="30111222")
        otro_cliente = Cliente(nombre="Ana", apellido="Gomez", dni="30999888")
        db.add_all([cliente, otro_cliente])
        db.flush()
        vehiculos = [
            Vehiculo(
                cliente_id=cliente.id, patente=f"AAA00{i}",
                marca="VW", modelo=f"Gol {i}",
            )
            for i in range(1, 5)
        ]
        vehiculos.append(
            Vehiculo(
                cliente_id=otro_cliente.id, patente="ZZZ999",
                marca="Ford", modelo="Fiesta",
            )
        )
        db.add_all(vehiculos)
        db.commit()
        return {
            "admin": {"Authorization": "Bearer " + create_access_token(admin.id)},
            "recepcion": {"Authorization": "Bearer " + create_access_token(recepcion.id)},
            "mecanico": {"Authorization": "Bearer " + create_access_token(mecanico.id)},
            "cliente_id": cliente.id,
            "otro_cliente_id": otro_cliente.id,
        }


@pytest.fixture
def api():
    with TestClient(app) as cliente:
        yield cliente


def test_users_sin_params_devuelve_array_y_total(api, datos):
    r = api.get("/api/v1/users", headers=datos["admin"])
    assert r.status_code == 200
    body = r.json()
    assert isinstance(body, list)
    assert len(body) == 4
    assert r.headers["X-Total-Count"] == "4"


def test_users_limit_offset_pagina_sin_perder_total(api, datos):
    r = api.get("/api/v1/users", headers=datos["admin"], params={"limit": 2, "offset": 1})
    assert [u["id"] for u in r.json()] == [2, 3]
    assert r.headers["X-Total-Count"] == "4"

    r2 = api.get("/api/v1/users", headers=datos["admin"], params={"limit": 2, "offset": 3})
    assert [u["id"] for u in r2.json()] == [4]
    assert r2.headers["X-Total-Count"] == "4"


def test_users_filtros_cuentan_lo_filtrado(api, datos):
    r = api.get("/api/v1/users", headers=datos["admin"], params={"rol": "mecanico"})
    assert len(r.json()) == 1
    assert r.headers["X-Total-Count"] == "1"

    r = api.get("/api/v1/users", headers=datos["admin"], params={"solo_activos": "false"})
    assert len(r.json()) == 1
    assert r.json()[0]["email"] == "inactivo@x.com"
    assert r.headers["X-Total-Count"] == "1"


def test_repuestos_orden_estable_y_paginacion(api, datos):
    # Sin params: todos (incluye inactivo), orden por nombre e id como desempate.
    r = api.get("/api/v1/repuestos", headers=datos["admin"])
    assert [x["nombre"] for x in r.json()] == [
        "Repuesto 00", "Repuesto 01", "Repuesto 02",
        "Repuesto 03", "Repuesto 04", "Repuesto viejo",
    ]
    assert r.headers["X-Total-Count"] == "6"

    r = api.get("/api/v1/repuestos", headers=datos["admin"], params={"limit": 2, "offset": 4})
    assert [x["nombre"] for x in r.json()] == ["Repuesto 04", "Repuesto viejo"]
    assert r.headers["X-Total-Count"] == "6"


def test_repuestos_filtros_cuentan_lo_filtrado(api, datos):
    r = api.get("/api/v1/repuestos", headers=datos["admin"], params={"solo_activos": "true"})
    assert len(r.json()) == 5
    assert r.headers["X-Total-Count"] == "5"

    r = api.get("/api/v1/repuestos", headers=datos["admin"], params={"q": "Repuesto 0"})
    assert len(r.json()) == 5
    assert r.headers["X-Total-Count"] == "5"

    r = api.get(
        "/api/v1/repuestos", headers=datos["admin"],
        params={"q": "Repuesto 0", "limit": 2, "offset": 3},
    )
    assert len(r.json()) == 2
    assert r.headers["X-Total-Count"] == "5"


def test_vehiculos_paginacion_y_filtro_cliente(api, datos):
    r = api.get("/api/v1/vehiculos", headers=datos["admin"])
    assert len(r.json()) == 5
    assert r.headers["X-Total-Count"] == "5"

    r = api.get(
        "/api/v1/vehiculos", headers=datos["admin"],
        params={"cliente_id": datos["cliente_id"], "limit": 2, "offset": 2},
    )
    vehiculos = r.json()
    assert len(vehiculos) == 2
    assert all(v["cliente_id"] == datos["cliente_id"] for v in vehiculos)
    assert r.headers["X-Total-Count"] == "4"

    r = api.get("/api/v1/vehiculos", headers=datos["admin"], params={"q": "gol"})
    assert len(r.json()) == 4
    assert r.headers["X-Total-Count"] == "4"


def test_vehiculos_mecanico_sin_ordenes_ve_lista_vacia(api, datos):
    # El filtro por mecanico_id exige órdenes asignadas: sin ellas, total 0.
    r = api.get("/api/v1/vehiculos", headers=datos["mecanico"])
    assert r.json() == []
    assert r.headers["X-Total-Count"] == "0"


@pytest.mark.parametrize(
    "params",
    [{"limit": 0}, {"limit": 201}, {"limit": -1}, {"offset": -1}, {"limit": "abc"}],
)
def test_params_invalidos_dan_422(api, datos, params):
    for path in ("/api/v1/users", "/api/v1/repuestos", "/api/v1/vehiculos"):
        assert api.get(path, headers=datos["admin"], params=params).status_code == 422
