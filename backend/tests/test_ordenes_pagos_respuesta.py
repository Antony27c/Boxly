"""`orden.pagos` en la respuesta para el personal: administración y recepción
ven los pagos de la orden (estado, monto, medio, referencia, id de MP y
fecha); el mecánico no ve pagos ni montos. Los listados usan el mismo schema
y traen `tiene_pago_duplicado` sin consultas extra (pagos ya eager-loaded).
"""
from datetime import datetime, timezone
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

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
        db.add(vehiculo)
        db.flush()
        # La orden del mecánico: pagada en el local y con un cobro online
        # duplicado de Mercado Pago (el escenario del aviso de D1).
        orden = Orden(
            cliente_id=cliente.id, vehiculo_id=vehiculo.id,
            creado_por_id=admin.id, mecanico_id=mecanico.id,
            codigo="OT-PAGOS-1", estado="listo",
            descripcion_ingreso="Cambio de aceite y filtros",
            costo_final=Decimal("1500.00"), cobro_estado="aprobado",
        )
        # Una orden sin pagos, para el flag en false.
        orden2 = Orden(
            cliente_id=cliente.id, vehiculo_id=vehiculo.id,
            creado_por_id=admin.id, mecanico_id=mecanico.id,
            codigo="OT-PAGOS-2", estado="en_diagnostico",
            descripcion_ingreso="Revisión de tren delantero",
        )
        # Lista para cobrar: estado "listo" y todavía sin pagos.
        orden3 = Orden(
            cliente_id=cliente.id, vehiculo_id=vehiculo.id,
            creado_por_id=admin.id,
            codigo="OT-PAGOS-3", estado="listo",
            descripcion_ingreso="Pastillas de freno delanteras",
        )
        db.add_all([orden, orden2, orden3])
        db.flush()
        pago_local = Pago(
            orden_id=orden.id, monto=Decimal("1500.00"), estado="aprobado",
            medio="efectivo", referencia="OP-778899",
            fecha_pago=datetime.now(timezone.utc),
        )
        pago_duplicado = Pago(
            orden_id=orden.id, monto=Decimal("1500.00"), estado="duplicado",
            medio="mercadopago", payment_id="555777",
        )
        db.add_all([pago_local, pago_duplicado])
        db.commit()
        return {
            "admin": {"Authorization": "Bearer " + create_access_token(admin.id)},
            "recepcion": {"Authorization": "Bearer " + create_access_token(recepcion.id)},
            "mecanico": {"Authorization": "Bearer " + create_access_token(mecanico.id)},
            "vehiculo": vehiculo.id,
            "orden": orden.id,
            "orden2": orden2.id,
            "orden3": orden3.id,
        }


@pytest.fixture
def api():
    with TestClient(app) as cliente:
        yield cliente


def test_admin_ve_los_pagos_de_la_orden(api, datos):
    r = api.get(f"/api/v1/ordenes/{datos['orden']}", headers=datos["admin"])
    assert r.status_code == 200, r.text
    cuerpo = r.json()
    assert cuerpo["tiene_pago_duplicado"] is True
    assert len(cuerpo["pagos"]) == 2

    por_estado = {p["estado"]: p for p in cuerpo["pagos"]}
    local = por_estado["aprobado"]
    assert local["medio"] == "efectivo"
    assert local["referencia"] == "OP-778899"
    assert local["monto"] == "1500.00"
    assert local["fecha_pago"] is not None
    assert local["creado_en"] is not None

    duplicado = por_estado["duplicado"]
    assert duplicado["medio"] == "mercadopago"
    assert duplicado["payment_id"] == "555777"
    assert duplicado["referencia"] is None


def test_recepcion_tambien_ve_los_pagos(api, datos):
    r = api.get(f"/api/v1/ordenes/{datos['orden']}", headers=datos["recepcion"])
    assert r.status_code == 200
    assert len(r.json()["pagos"]) == 2
    assert r.json()["tiene_pago_duplicado"] is True


def test_lista_trae_pagos_y_flag_sin_consultas_extra(api, datos):
    r = api.get("/api/v1/ordenes", headers=datos["admin"])
    assert r.status_code == 200
    por_id = {o["id"]: o for o in r.json()}
    assert por_id[datos["orden"]]["tiene_pago_duplicado"] is True
    assert len(por_id[datos["orden"]]["pagos"]) == 2
    assert por_id[datos["orden2"]]["tiene_pago_duplicado"] is False
    assert por_id[datos["orden2"]]["pagos"] == []


def test_mecanico_no_ve_pagos_ni_montos(api, datos):
    """El mecánico trabaja la orden pero no ve pagos: la lista va vacía y el
    flag de duplicado no lo delata."""
    r = api.get(f"/api/v1/ordenes/{datos['orden']}", headers=datos["mecanico"])
    assert r.status_code == 200, r.text
    cuerpo = r.json()
    assert cuerpo["pagos"] == []
    assert cuerpo["tiene_pago_duplicado"] is False
    assert "monto" not in str(cuerpo["pagos"])

    r = api.get("/api/v1/ordenes", headers=datos["mecanico"])
    assert r.status_code == 200
    for orden in r.json():
        assert orden["pagos"] == []
        assert orden["tiene_pago_duplicado"] is False


def test_mecanico_tampoco_ve_pagos_en_el_patch(api, datos):
    with SessionLocal() as db:
        db.add(Pago(
            orden_id=datos["orden2"], monto=Decimal("800.00"),
            estado="pendiente", medio="mercadopago",
        ))
        db.commit()

    # El administrador sí ve el pago en su PATCH.
    r = api.patch(
        f"/api/v1/ordenes/{datos['orden2']}",
        headers=datos["admin"],
        json={"diagnostico": "Falta revisar la suspensión"},
    )
    assert r.status_code == 200, r.text
    assert len(r.json()["pagos"]) == 1
    assert r.json()["pagos"][0]["estado"] == "pendiente"

    # El mecánico, en su PATCH, recibe la lista vacía.
    r = api.patch(
        f"/api/v1/ordenes/{datos['orden2']}",
        headers=datos["mecanico"],
        json={"estado": "cancelado", "comentario_cambio": "No se puede hacer"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["pagos"] == []
    assert r.json()["tiene_pago_duplicado"] is False


def test_pago_local_responde_con_el_pago_registrado(api, datos):
    """El cobro ya está emitido (costo_final + cobro_estado): el pago local
    responde con el pago recién creado en `pagos`."""
    api.post(
        f"/api/v1/ordenes/{datos['orden3']}/cobro",
        headers=datos["admin"], json={"monto": "900.00"},
    )
    r = api.post(
        f"/api/v1/ordenes/{datos['orden3']}/pago-local",
        headers=datos["recepcion"],
        json={"medio": "transferencia", "monto": "900.00",
              "referencia": "TRF-1"},
    )
    assert r.status_code == 200, r.text
    pagos = r.json()["pagos"]
    assert len(pagos) == 1
    assert pagos[0]["estado"] == "aprobado"
    assert pagos[0]["medio"] == "transferencia"
    assert pagos[0]["referencia"] == "TRF-1"
    assert pagos[0]["monto"] == "900.00"


def test_historial_del_vehiculo_no_expone_pagos(api, datos):
    """`/vehiculos/{id}/ordenes` serializa OrdenResponse sin la marca de
    visibilidad: queda como antes, sin `pagos` (el mecánico no los ve por
    ningún camino)."""
    r = api.get(
        f"/api/v1/vehiculos/{datos['vehiculo']}/ordenes",
        headers=datos["mecanico"],
    )
    assert r.status_code == 200, r.text
    assert r.json(), "el mecánico tiene que ver sus órdenes del vehículo"
    for orden in r.json():
        assert orden["pagos"] == []
        assert orden["tiene_pago_duplicado"] is False
