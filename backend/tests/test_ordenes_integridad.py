"""Regla de cobro, códigos de orden y consultas de órdenes."""
from datetime import timedelta
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event, select

from app.api.v1.ordenes.repository import orden_repository
from app.api.v1.ordenes.service import orden_service
from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.main import app
from app.models import Cliente, Orden, Pago, Usuario, Vehiculo
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
        cliente = Cliente(nombre="Juan", apellido="Perez", dni="30111222")
        db.add_all([admin, cliente])
        db.flush()
        vehiculo = Vehiculo(cliente_id=cliente.id, patente="ABC123", marca="VW", modelo="Gol")
        db.add(vehiculo)
        db.flush()
        orden = Orden(
            cliente_id=cliente.id, vehiculo_id=vehiculo.id, creado_por_id=admin.id,
            codigo="OT-1001", estado="pendiente",
            descripcion_ingreso="Cambio de aceite y filtros",
        )
        db.add(orden)
        db.commit()
        return {
            "h": {"Authorization": "Bearer " + create_access_token(admin.id)},
            "orden": orden.id,
            "vehiculo": vehiculo.id,
            "cliente": cliente.id,
            "admin_id": admin.id,
        }


@pytest.fixture
def api():
    with TestClient(app) as cliente:
        yield cliente


def _poner_estado(orden_id: int, estado: str) -> None:
    with SessionLocal() as db:
        db.get(Orden, orden_id).estado = estado
        db.commit()


def _poner_pago(orden_id: int, estado: str) -> None:
    with SessionLocal() as db:
        db.add(Pago(orden_id=orden_id, monto=Decimal("5000.00"), estado=estado))
        db.commit()


def _editar(api, datos, payload):
    return api.patch(f"/api/v1/ordenes/{datos['orden']}", headers=datos["h"], json=payload)


def test_costo_final_solo_en_orden_lista_o_entregada(api, datos):
    r = _editar(api, datos, {"costo_final": 10000})
    assert r.status_code == 400

    _poner_estado(datos["orden"], "listo")
    r = _editar(api, datos, {"costo_final": 10000})
    assert r.status_code == 200
    with SessionLocal() as db:
        orden = db.get(Orden, datos["orden"])
        assert orden.costo_final == Decimal("10000")
        assert orden.cobro_estado == "aprobado"


def test_costo_final_con_pago_pendiente_da_409(api, datos):
    _poner_estado(datos["orden"], "listo")
    _poner_pago(datos["orden"], "pendiente")
    r = _editar(api, datos, {"costo_final": 12000})
    assert r.status_code == 409
    assert "pago" in r.json()["detail"].lower()
    with SessionLocal() as db:
        assert db.get(Orden, datos["orden"]).costo_final is None


def test_costo_final_con_pago_aprobado_da_409(api, datos):
    _poner_estado(datos["orden"], "listo")
    _poner_pago(datos["orden"], "aprobado")
    r = _editar(api, datos, {"costo_final": 12000})
    assert r.status_code == 409


def test_costo_final_con_pago_rechazado_se_permite(api, datos):
    _poner_estado(datos["orden"], "listo")
    _poner_pago(datos["orden"], "rechazado")
    r = _editar(api, datos, {"costo_final": 12000})
    assert r.status_code == 200


def test_cobro_aprobado_en_usa_hora_con_zona_utc():
    orden = Orden(
        cliente_id=1, vehiculo_id=1, creado_por_id=1, codigo="OT-TZ",
        estado="listo", descripcion_ingreso="Prueba de zona horaria",
    )
    orden_service._aprobar_cobro(orden, Decimal("1000.00"), usuario_id=1)
    assert orden.cobro_aprobado_en is not None
    assert orden.cobro_aprobado_en.utcoffset() == timedelta(0)


def test_siguiente_codigo_usa_el_maximo_codigo_no_el_id(api, datos):
    with SessionLocal() as db:
        db.add(Orden(
            cliente_id=datos["cliente"], vehiculo_id=datos["vehiculo"],
            creado_por_id=datos["admin_id"], codigo="OT-7777",
            estado="pendiente", descripcion_ingreso="Orden cargada a mano",
        ))
        db.commit()
    r = api.post(
        "/api/v1/ordenes", headers=datos["h"],
        json={"vehiculo_id": datos["vehiculo"], "descripcion_ingreso": "Orden nueva de prueba"},
    )
    assert r.status_code == 201
    assert r.json()["codigo"] == "OT-7778"


def test_crear_orden_reintenta_si_el_codigo_colisiona(api, datos, monkeypatch):
    original = orden_repository.siguiente_codigo
    llamadas = []

    def falso_codigo(db):
        llamadas.append(db)
        return "OT-1001" if len(llamadas) == 1 else original(db)

    monkeypatch.setattr(orden_repository, "siguiente_codigo", falso_codigo)
    r = api.post(
        "/api/v1/ordenes", headers=datos["h"],
        json={"vehiculo_id": datos["vehiculo"], "descripcion_ingreso": "Orden con reintento"},
    )
    assert r.status_code == 201
    assert len(llamadas) == 2
    assert r.json()["codigo"] == "OT-1002"


@pytest.fixture
def datos_lista():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        creador = Usuario(
            nombre="Admin", apellido="Taller", email="admin@n1.com",
            password_hash=hash_password("x"), rol=RolUsuario.administrador,
        )
        db.add(creador)
        db.flush()
        for i in range(5):
            cliente = Cliente(nombre=f"Cliente{i}", apellido="Prueba", dni=f"9000000{i}")
            mecanico = Usuario(
                nombre=f"Mec{i}", apellido="Prueba", email=f"mec{i}@x.com",
                password_hash=hash_password("x"), rol=RolUsuario.mecanico,
            )
            cobrador = Usuario(
                nombre=f"Rec{i}", apellido="Prueba", email=f"rec{i}@x.com",
                password_hash=hash_password("x"), rol=RolUsuario.recepcion,
            )
            db.add_all([cliente, mecanico, cobrador])
            db.flush()
            vehiculo = Vehiculo(
                cliente_id=cliente.id, patente=f"PAT{i:03d}", marca="VW", modelo="Gol"
            )
            db.add(vehiculo)
            db.flush()
            orden = Orden(
                cliente_id=cliente.id, vehiculo_id=vehiculo.id, creado_por_id=creador.id,
                mecanico_id=mecanico.id,
                cobro_propuesto_por_id=cobrador.id, cobro_aprobado_por_id=cobrador.id,
                codigo=f"OT-{3000 + i}", estado="listo",
                descripcion_ingreso=f"Reparación número {i}",
                costo_final=Decimal("10000.00"),
            )
            db.add(orden)
            db.flush()
            db.add(Pago(orden_id=orden.id, monto=Decimal("10000.00"), estado="aprobado"))
        db.commit()


def _contar_selects(fn) -> int:
    total = 0

    def _listener(conn, cursor, statement, parameters, context, executemany):
        nonlocal total
        if statement.lstrip().upper().startswith("SELECT"):
            total += 1

    event.listen(engine, "before_cursor_execute", _listener)
    try:
        fn()
    finally:
        event.remove(engine, "before_cursor_execute", _listener)
    return total


def _tocar_propiedades(orden):
    return (
        orden.cliente_nombre, orden.vehiculo_patente, orden.vehiculo_marca,
        orden.vehiculo_modelo, orden.mecanico_nombre,
        orden.cobro_propuesto_por_nombre, orden.cobro_aprobado_por_nombre,
        orden.pagada,
    )


def test_listado_de_ordenes_no_hace_n_mas_1(datos_lista):
    def antes():
        with SessionLocal() as db:
            ordenes = list(db.scalars(select(Orden).order_by(Orden.fecha_ingreso.desc())))
            for orden in ordenes:
                _tocar_propiedades(orden)

    def despues():
        with SessionLocal() as db:
            for orden in orden_repository.obtener_ordenes(db):
                _tocar_propiedades(orden)

    consultas_antes = _contar_selects(antes)
    consultas_despues = _contar_selects(despues)
    assert consultas_despues < consultas_antes
    assert consultas_despues <= 10


def test_detalle_de_orden_no_hace_n_mas_1(datos_lista):
    with SessionLocal() as db:
        orden_id = db.scalar(select(Orden.id).order_by(Orden.id).limit(1))

    def antes():
        with SessionLocal() as db:
            _tocar_propiedades(db.get(Orden, orden_id))

    def despues():
        with SessionLocal() as db:
            _tocar_propiedades(orden_repository.obtener_por_id(db, orden_id))

    consultas_antes = _contar_selects(antes)
    consultas_despues = _contar_selects(despues)
    assert consultas_despues < consultas_antes
    assert consultas_despues <= 4
