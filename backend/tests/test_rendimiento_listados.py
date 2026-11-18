"""Regresión de rendimiento y paginación de los listados.

Los listados de clientes, turnos y portal no deben ejecutar una query por
fila (N+1): las relaciones que serializa la respuesta se cargan con
selectinload. Además se cubre el filtro por rango de fechas de turnos, la
paginación con limit/offset y el header X-Total-Count.
"""

from datetime import date, datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event

from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models import (
    Cliente,
    Orden,
    Pago,
    Turno,
    Usuario,
    Vehiculo,
)
from app.models.usuario import RolUsuario
from app.main import app

BASE = "/api/v1"


@pytest.fixture
def datos():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        admin = Usuario(
            nombre="Admin", apellido="Sistema", email="admin@x.com",
            password_hash=hash_password("x"), rol=RolUsuario.administrador,
        )
        portal_cliente = Cliente(
            nombre="Portal", apellido="Cliente", dni="90000001",
            email="portal@x.com",
        )
        db.add_all([admin, portal_cliente])
        db.flush()

        cuenta = Usuario(
            nombre="Portal", apellido="Cliente", email="cuenta@x.com",
            password_hash=hash_password("x"), rol=RolUsuario.cliente,
            cliente_id=portal_cliente.id,
        )
        db.add(cuenta)
        db.flush()

        clientes = [portal_cliente]
        vehiculos = []
        ordenes = []
        turnos = []
        estados = ["pendiente", "ingresado", "en_diagnostico", "listo", "entregado"]
        for i in range(1, 6):
            c = Cliente(
                nombre=f"Cliente{i}", apellido=f"Apellido{i}",
                dni=f"9000001{i}", email=f"c{i}@x.com",
            )
            db.add(c)
            db.flush()
            clientes.append(c)

            v = Vehiculo(
                cliente_id=portal_cliente.id, patente=f"PERF{i:02d}AA",
                marca="Ford", modelo=f"Modelo{i}",
            )
            db.add(v)
            db.flush()
            vehiculos.append(v)

            orden = Orden(
                cliente_id=portal_cliente.id, vehiculo_id=v.id,
                creado_por_id=admin.id, codigo=f"ORD-PERF-{i:03d}",
                estado=estados[i - 1], descripcion_ingreso=f"Trabajo {i}",
            )
            db.add(orden)
            ordenes.append(orden)

        db.flush()
        db.add(Pago(orden_id=ordenes[0].id, monto=100, estado="aprobado"))

        for i in range(5):
            turnos.append(Turno(
                cliente_id=clientes[i].id, registrado_por_id=admin.id,
                fecha_hora=datetime(2030, 1, 5 + i, 8, 0), estado="pendiente",
            ))
        db.add_all(turnos)
        db.commit()

        def header(usuario_id):
            return {"Authorization": "Bearer " + create_access_token(usuario_id)}

        return {
            "h_admin": header(admin.id),
            "h_portal": header(cuenta.id),
            "total_clientes": len(clientes),
            "total_turnos": len(turnos),
        }


@pytest.fixture
def api():
    with TestClient(app) as cliente:
        yield cliente


@pytest.fixture
def contador():
    """Junta las sentencias SQL ejecutadas mientras dura el test."""
    sentencias = []

    def escuchar(conn, cursor, statement, parameters, context, executemany):
        sentencias.append(statement)

    event.listen(engine, "before_cursor_execute", escuchar)
    yield sentencias
    event.remove(engine, "before_cursor_execute", escuchar)


def _get(api, path, headers, contador):
    contador.clear()
    respuesta = api.get(path, headers=headers)
    assert respuesta.status_code == 200
    return respuesta, len(contador)


# Los techos dejan margen para la autenticación y el COUNT, pero están muy
# por debajo de lo que generaría un N+1 con 5 registros (>= 10 queries).

def test_listado_clientes_no_multiplica_queries(api, datos, contador):
    respuesta, consultas = _get(api, f"{BASE}/clientes", datos["h_admin"], contador)
    assert len(respuesta.json()) == datos["total_clientes"]
    assert consultas <= 6, f"{consultas} queries: {contador}"


def test_listado_turnos_no_multiplica_queries(api, datos, contador):
    respuesta, consultas = _get(api, f"{BASE}/turnos", datos["h_admin"], contador)
    assert len(respuesta.json()) == datos["total_turnos"]
    assert consultas <= 5, f"{consultas} queries: {contador}"


def test_mis_ordenes_no_multiplica_queries(api, datos, contador):
    respuesta, consultas = _get(
        api, f"{BASE}/mis-ordenes", datos["h_portal"], contador
    )
    assert len(respuesta.json()) == 5
    assert consultas <= 6, f"{consultas} queries: {contador}"


def test_mis_vehiculos_no_multiplica_queries(api, datos, contador):
    respuesta, consultas = _get(
        api, f"{BASE}/mis-vehiculos", datos["h_portal"], contador
    )
    assert len(respuesta.json()) == 5
    assert consultas <= 6, f"{consultas} queries: {contador}"


# --- Rango de fechas en turnos -------------------------------------------


def test_turnos_filtra_por_rango_de_fechas(api, datos):
    # Turnos creados: 2030-01-05 a 2030-01-09, todos a las 08:00.
    r = api.get(
        f"{BASE}/turnos",
        headers=datos["h_admin"],
        params={"desde": "2030-01-06", "hasta": "2030-01-08"},
    )
    assert r.status_code == 200
    dias = sorted(t["fecha_hora"][:10] for t in r.json())
    assert dias == ["2030-01-06", "2030-01-07", "2030-01-08"]


def test_turnos_hasta_date_incluye_el_dia_completo(api, datos):
    r = api.get(
        f"{BASE}/turnos",
        headers=datos["h_admin"],
        params={"desde": "2030-01-05", "hasta": "2030-01-05"},
    )
    assert r.status_code == 200
    assert len(r.json()) == 1
    assert r.json()[0]["fecha_hora"].startswith("2030-01-05")


def test_turnos_acepta_desde_y_hasta_datetime(api, datos):
    r = api.get(
        f"{BASE}/turnos",
        headers=datos["h_admin"],
        params={
            "desde": "2030-01-06T00:00:00",
            "hasta": "2030-01-07T23:59:59",
        },
    )
    assert r.status_code == 200
    dias = sorted(t["fecha_hora"][:10] for t in r.json())
    assert dias == ["2030-01-06", "2030-01-07"]


def test_turnos_sin_rango_devuelve_todos(api, datos):
    r = api.get(f"{BASE}/turnos", headers=datos["h_admin"])
    assert r.status_code == 200
    assert len(r.json()) == datos["total_turnos"]


# --- Paginación y X-Total-Count ------------------------------------------


def test_clientes_pagina_y_cuenta_total(api, datos):
    r = api.get(
        f"{BASE}/clientes",
        headers=datos["h_admin"],
        params={"limit": 2, "offset": 1},
    )
    assert r.status_code == 200
    assert len(r.json()) == 2
    assert r.headers["X-Total-Count"] == str(datos["total_clientes"])


def test_clientes_sin_limit_devuelve_todos_con_total(api, datos):
    r = api.get(f"{BASE}/clientes", headers=datos["h_admin"])
    assert r.status_code == 200
    assert len(r.json()) == datos["total_clientes"]
    assert r.headers["X-Total-Count"] == str(datos["total_clientes"])


def test_clientes_offset_mayor_al_total_devuelve_vacio(api, datos):
    r = api.get(
        f"{BASE}/clientes",
        headers=datos["h_admin"],
        params={"offset": 999},
    )
    assert r.status_code == 200
    assert r.json() == []
    assert r.headers["X-Total-Count"] == str(datos["total_clientes"])


@pytest.mark.parametrize("params", [
    {"limit": 0},
    {"limit": 201},
    {"limit": -1},
    {"offset": -1},
])
def test_clientes_paginacion_invalida_da_422(api, datos, params):
    r = api.get(f"{BASE}/clientes", headers=datos["h_admin"], params=params)
    assert r.status_code == 422


def test_turnos_pagina_cuenta_y_filtra(api, datos):
    r = api.get(
        f"{BASE}/turnos",
        headers=datos["h_admin"],
        params={"estado": "pendiente", "limit": 3, "offset": 0},
    )
    assert r.status_code == 200
    assert len(r.json()) == 3
    assert r.headers["X-Total-Count"] == str(datos["total_turnos"])
    assert all(t["estado"] == "pendiente" for t in r.json())


def test_turnos_total_respeta_filtros_y_rango(api, datos):
    r = api.get(
        f"{BASE}/turnos",
        headers=datos["h_admin"],
        params={"desde": "2030-01-06", "hasta": "2030-01-07"},
    )
    assert r.status_code == 200
    assert len(r.json()) == 2
    assert r.headers["X-Total-Count"] == "2"


@pytest.mark.parametrize("params", [
    {"limit": 0},
    {"limit": 201},
    {"offset": -5},
])
def test_turnos_paginacion_invalida_da_422(api, datos, params):
    r = api.get(f"{BASE}/turnos", headers=datos["h_admin"], params=params)
    assert r.status_code == 422


def test_paginacion_ordena_de_forma_estable(api, datos):
    # Con limit=1 y offset creciente hay que recorrer todos los registros
    # sin repetidos ni salteados: el orden es determinístico.
    vistos = []
    for offset in range(datos["total_clientes"]):
        r = api.get(
            f"{BASE}/clientes",
            headers=datos["h_admin"],
            params={"limit": 1, "offset": offset},
        )
        assert r.status_code == 200
        vistos.extend(c["id"] for c in r.json())
    assert sorted(vistos) == sorted(set(vistos))
    assert len(vistos) == datos["total_clientes"]

