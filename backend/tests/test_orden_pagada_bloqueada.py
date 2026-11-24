"""F4: una orden pagada no cambia sus líneas.

Agregar, cotizar o quitar líneas (y por lo tanto el total de algo ya cobrado)
responde 409 con ``codigo`` ``orden_pagada`` para todos los roles. Si la
operación hubiera pasado, el stock del repuesto tampoco se tendría que mover.
"""
from datetime import datetime, timezone
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.main import app
from app.models import Cliente, Orden, Pago, Repuesto, Usuario, Vehiculo
from app.models.detalle_orden import DetalleOrden
from app.models.usuario import RolUsuario

DETALLE_MENSAJE = "La orden ya está pagada; no se pueden cambiar sus líneas"


@pytest.fixture
def datos():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        admin = Usuario(
            nombre="Admin", apellido="Taller", email="admin@x.com",
            password_hash=hash_password("x"), rol=RolUsuario.administrador,
        )
        recepcion = Usuario(
            nombre="Recep", apellido="Taller", email="recep@x.com",
            password_hash=hash_password("x"), rol=RolUsuario.recepcion,
        )
        mecanico = Usuario(
            nombre="Mecanico", apellido="Taller", email="mec@x.com",
            password_hash=hash_password("x"), rol=RolUsuario.mecanico,
        )
        cliente = Cliente(
            nombre="Juan", apellido="Perez", dni="30111222", email="j@x.com"
        )
        db.add_all([admin, recepcion, mecanico, cliente])
        db.flush()
        vehiculo = Vehiculo(
            cliente_id=cliente.id, patente="ABC123", marca="VW", modelo="Gol"
        )
        repuesto = Repuesto(
            codigo="ACEITE5W30", nombre="Aceite 5W30", stock=10,
            precio=Decimal("1500.00"),
        )
        db.add_all([vehiculo, repuesto])
        db.flush()
        # Orden ya cobrada: cobro aprobado + pago local aprobado.
        pagada = Orden(
            cliente_id=cliente.id, vehiculo_id=vehiculo.id,
            creado_por_id=admin.id, mecanico_id=mecanico.id,
            codigo="OT-PAGADA-1", estado="listo",
            descripcion_ingreso="Cambio de aceite y filtros",
            costo_final=Decimal("23000.00"), cobro_estado="aprobado",
        )
        # Orden lista para cobrar pero todavía sin pagos (control).
        sin_pagar = Orden(
            cliente_id=cliente.id, vehiculo_id=vehiculo.id,
            creado_por_id=admin.id, mecanico_id=mecanico.id,
            codigo="OT-PAGADA-2", estado="listo",
            descripcion_ingreso="Pastillas de freno delanteras",
        )
        db.add_all([pagada, sin_pagar])
        db.flush()
        db.add_all([
            DetalleOrden(
                orden_id=pagada.id, repuesto_id=repuesto.id,
                descripcion="Aceite 5W30", cantidad=2,
                precio_unitario=Decimal("1500.00"),
            ),
            DetalleOrden(
                orden_id=pagada.id, descripcion="Mano de obra diagnosis",
                cantidad=1, precio_unitario=Decimal("8000.00"),
            ),
            Pago(
                orden_id=pagada.id, monto=Decimal("23000.00"),
                estado="aprobado", medio="efectivo", referencia="OP-1",
                fecha_pago=datetime.now(timezone.utc),
            ),
        ])
        db.commit()
        ids = {"pagada": pagada.id, "sin_pagar": sin_pagar.id, "repuesto": repuesto.id}
        # Los ids de las líneas se leen en una sesión nueva para no depender
        # de objetos detached.
        with SessionLocal() as db2:
            lineas = db2.query(DetalleOrden).filter_by(orden_id=pagada.id).all()
            ids["detalle_repuesto"] = next(d.id for d in lineas if d.repuesto_id)
            ids["detalle_mano_obra"] = next(d.id for d in lineas if not d.repuesto_id)
        return {
            "admin": {"Authorization": "Bearer " + create_access_token(admin.id)},
            "recepcion": {"Authorization": "Bearer " + create_access_token(recepcion.id)},
            "mecanico": {"Authorization": "Bearer " + create_access_token(mecanico.id)},
            **ids,
        }


@pytest.fixture
def api():
    with TestClient(app) as cliente:
        yield cliente


def _assert_bloqueada(r):
    assert r.status_code == 409, r.text
    cuerpo = r.json()
    assert cuerpo["codigo"] == "orden_pagada"
    assert cuerpo["detail"] == DETALLE_MENSAJE


# ---------------------------------------------------------------------------
# Agregar líneas
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("rol", ["admin", "recepcion", "mecanico"])
def test_agregar_repuesto_bloqueado_en_orden_pagada(api, datos, rol):
    r = api.post(
        f"/api/v1/ordenes/{datos['pagada']}/detalles",
        headers=datos[rol],
        json={"repuesto_id": datos["repuesto"], "cantidad": 1},
    )
    _assert_bloqueada(r)


@pytest.mark.parametrize("rol", ["admin", "recepcion", "mecanico"])
def test_agregar_mano_de_obra_bloqueada_en_orden_pagada(api, datos, rol):
    # El mecánico la cargaría "a cotizar" (sin precio); para el resto va con
    # precio. En los tres casos la orden pagada corta antes.
    cuerpo = {"descripcion": "Alineación y balanceo", "cantidad": 1}
    if rol != "mecanico":
        cuerpo["precio_unitario"] = "5000.00"
    r = api.post(
        f"/api/v1/ordenes/{datos['pagada']}/detalles",
        headers=datos[rol], json=cuerpo,
    )
    _assert_bloqueada(r)


# ---------------------------------------------------------------------------
# Cotizar el precio de una línea (solo administración y recepción llegan;
# el mecánico ya está bloqueado por rol en el router).
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("rol", ["admin", "recepcion"])
def test_cotizar_linea_bloqueado_en_orden_pagada(api, datos, rol):
    r = api.patch(
        f"/api/v1/ordenes/{datos['pagada']}/detalles/{datos['detalle_mano_obra']}",
        headers=datos[rol], json={"precio_unitario": "9000.00"},
    )
    _assert_bloqueada(r)


def test_cotizar_linea_el_mecanico_sigue_sin_permiso(api, datos):
    # El PATCH de precio es solo de administración/recepción: al mecánico lo
    # frena el rol (403) antes de llegar a la validación de orden pagada.
    r = api.patch(
        f"/api/v1/ordenes/{datos['pagada']}/detalles/{datos['detalle_mano_obra']}",
        headers=datos["mecanico"], json={"precio_unitario": "9000.00"},
    )
    assert r.status_code == 403, r.text


# ---------------------------------------------------------------------------
# Quitar líneas: bloqueado y el stock no se mueve.
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("rol", ["admin", "recepcion", "mecanico"])
def test_quitar_linea_repuesto_bloqueada_en_orden_pagada(api, datos, rol):
    r = api.delete(
        f"/api/v1/ordenes/{datos['pagada']}/detalles/{datos['detalle_repuesto']}",
        headers=datos[rol],
    )
    _assert_bloqueada(r)


@pytest.mark.parametrize("rol", ["admin", "recepcion", "mecanico"])
def test_quitar_linea_mano_de_obra_bloqueada_en_orden_pagada(api, datos, rol):
    r = api.delete(
        f"/api/v1/ordenes/{datos['pagada']}/detalles/{datos['detalle_mano_obra']}",
        headers=datos[rol],
    )
    _assert_bloqueada(r)


def test_el_stock_no_se_mueve_al_rechazar_las_bajas(api, datos):
    """Los DELETE de arriba no tienen que devolver stock ni borrar líneas."""
    with SessionLocal() as db:
        repuesto = db.get(Repuesto, datos["repuesto"])
        assert repuesto.stock == 10
        lineas = db.query(DetalleOrden).filter_by(orden_id=datos["pagada"]).count()
        assert lineas == 2


# ---------------------------------------------------------------------------
# Control: una orden sin pagar sigue aceptando líneas.
# ---------------------------------------------------------------------------


def test_orden_sin_pagar_sigue_aceptando_lineas(api, datos):
    r = api.post(
        f"/api/v1/ordenes/{datos['sin_pagar']}/detalles",
        headers=datos["recepcion"],
        json={"descripcion": "Lavado de inyectores", "cantidad": 1,
              "precio_unitario": "6000.00"},
    )
    assert r.status_code == 201, r.text
    detalle_id = r.json()["id"]

    r = api.delete(
        f"/api/v1/ordenes/{datos['sin_pagar']}/detalles/{detalle_id}",
        headers=datos["recepcion"],
    )
    assert r.status_code == 200, r.text
