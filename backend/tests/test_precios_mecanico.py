"""El mecánico carga líneas sin precio; recepción o el admin las cotizan (S3)."""
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.main import app
from app.models.cliente import Cliente
from app.models.detalle_orden import DetalleOrden
from app.models.orden import Orden
from app.models.pago import Pago
from app.models.repuesto import Repuesto
from app.models.taller import Taller
from app.models.usuario import RolUsuario, Usuario
from app.models.vehiculo import Vehiculo


def _h(usuario: Usuario) -> dict:
    return {"Authorization": "Bearer " + create_access_token(usuario.id)}


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
        portal = Usuario(
            nombre="Juan", apellido="Perez", email="portal@x.com",
            password_hash=hash_password("x"), rol=RolUsuario.cliente,
            cliente_id=cliente.id,
        )
        db.add(portal)
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
        orden = Orden(
            cliente_id=cliente.id, vehiculo_id=vehiculo.id,
            creado_por_id=admin.id, mecanico_id=mecanico.id,
            codigo="OT-PRECIO-1", estado="listo",
            descripcion_ingreso="Cambio de aceite y filtros",
        )
        db.add(orden)
        db.flush()
        # Un segundo taller con su propia orden y línea a cotizar.
        taller2 = Taller(nombre="Taller Dos")
        db.add(taller2)
        db.flush()
        cliente2 = Cliente(
            taller_id=taller2.id, nombre="Ana", apellido="Lopez",
            dni="30999888", email="ana@x.com",
        )
        db.add(cliente2)
        db.flush()
        vehiculo2 = Vehiculo(
            taller_id=taller2.id, cliente_id=cliente2.id,
            patente="XYZ999", marca="Ford", modelo="Focus",
        )
        db.add(vehiculo2)
        db.flush()
        orden2 = Orden(
            taller_id=taller2.id, cliente_id=cliente2.id,
            vehiculo_id=vehiculo2.id, creado_por_id=admin.id,
            codigo="OT-OTRO-1", estado="listo",
            descripcion_ingreso="Revisión de otro taller",
        )
        db.add(orden2)
        db.flush()
        detalle2 = DetalleOrden(
            orden_id=orden2.id, descripcion="Mano de obra",
            cantidad=1, precio_unitario=None,
        )
        db.add(detalle2)
        db.commit()
        return {
            "admin": _h(admin),
            "recepcion": _h(recepcion),
            "mecanico": _h(mecanico),
            "portal": _h(portal),
            "orden": orden.id,
            "repuesto": repuesto.id,
            "orden2": orden2.id,
            "detalle2": detalle2.id,
        }


@pytest.fixture
def api():
    with TestClient(app) as cliente:
        yield cliente


def _post_detalle(api, headers, orden_id, payload):
    return api.post(
        f"/api/v1/ordenes/{orden_id}/detalles", headers=headers, json=payload
    )


def _mano_obra_mecanico(api, datos, cantidad=1):
    return _post_detalle(
        api, datos["mecanico"], datos["orden"],
        {"descripcion": "Diagnóstico del motor", "cantidad": cantidad},
    )


def test_mecanico_repuesto_usa_precio_inventario(api, datos):
    r = _post_detalle(
        api, datos["mecanico"], datos["orden"],
        {"repuesto_id": datos["repuesto"], "cantidad": 2},
    )
    assert r.status_code == 201, r.text
    linea = r.json()
    assert linea["precio_unitario"] == "1500.00"
    assert linea["a_cotizar"] is False
    assert linea["subtotal"] == "3000.00"
    with SessionLocal() as db:
        assert db.get(Repuesto, datos["repuesto"]).stock == 8


def test_mecanico_mano_obra_queda_a_cotizar(api, datos):
    r = _mano_obra_mecanico(api, datos)
    assert r.status_code == 201, r.text
    linea = r.json()
    assert linea["precio_unitario"] is None
    assert linea["a_cotizar"] is True
    assert linea["subtotal"] is None


def test_mecanico_con_precio_da_403(api, datos):
    r = _post_detalle(
        api, datos["mecanico"], datos["orden"],
        {"descripcion": "Mano de obra", "cantidad": 1, "precio_unitario": "5000"},
    )
    assert r.status_code == 403
    assert r.json()["detail"] == "El mecánico no carga precios"

    r = _post_detalle(
        api, datos["mecanico"], datos["orden"],
        {"repuesto_id": datos["repuesto"], "cantidad": 1,
         "precio_unitario": "1"},
    )
    assert r.status_code == 403
    assert r.json()["detail"] == "El mecánico no carga precios"


def test_la_orden_expone_las_lineas_a_cotizar(api, datos):
    _post_detalle(
        api, datos["mecanico"], datos["orden"],
        {"repuesto_id": datos["repuesto"], "cantidad": 1},
    )
    _mano_obra_mecanico(api, datos, cantidad=2)

    r = api.get(f"/api/v1/ordenes/{datos['orden']}", headers=datos["recepcion"])
    assert r.status_code == 200
    assert r.json()["lineas_a_cotizar"] == 1

    r = api.get(
        f"/api/v1/ordenes/{datos['orden']}/detalles", headers=datos["recepcion"]
    )
    assert r.status_code == 200
    a_cotizar = [d for d in r.json() if d["a_cotizar"]]
    assert len(a_cotizar) == 1
    assert a_cotizar[0]["precio_unitario"] is None
    assert a_cotizar[0]["subtotal"] is None


def test_recepcion_cotiza_y_corrige_con_patch(api, datos):
    linea = _mano_obra_mecanico(api, datos, cantidad=2).json()

    r = api.patch(
        f"/api/v1/ordenes/{datos['orden']}/detalles/{linea['id']}",
        headers=datos["recepcion"], json={"precio_unitario": "8000"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["precio_unitario"] == "8000.00"
    assert r.json()["a_cotizar"] is False
    assert r.json()["subtotal"] == "16000.00"

    # El administrador también corrige el precio.
    r = api.patch(
        f"/api/v1/ordenes/{datos['orden']}/detalles/{linea['id']}",
        headers=datos["admin"], json={"precio_unitario": "9000"},
    )
    assert r.status_code == 200
    assert r.json()["subtotal"] == "18000.00"

    r = api.get(f"/api/v1/ordenes/{datos['orden']}", headers=datos["recepcion"])
    assert r.json()["lineas_a_cotizar"] == 0


def test_mecanico_no_puede_cotizar(api, datos):
    linea = _mano_obra_mecanico(api, datos).json()
    r = api.patch(
        f"/api/v1/ordenes/{datos['orden']}/detalles/{linea['id']}",
        headers=datos["mecanico"], json={"precio_unitario": "100"},
    )
    assert r.status_code == 403


def test_detalle_de_otro_taller_da_404(api, datos):
    r = api.patch(
        f"/api/v1/ordenes/{datos['orden2']}/detalles/{datos['detalle2']}",
        headers=datos["recepcion"], json={"precio_unitario": "100"},
    )
    assert r.status_code == 404

    r = _post_detalle(
        api, datos["recepcion"], datos["orden2"],
        {"descripcion": "Mano de obra", "cantidad": 1,
         "precio_unitario": "10"},
    )
    assert r.status_code == 404


def test_recepcion_mano_obra_sin_precio_sigue_dando_422(api, datos):
    r = _post_detalle(
        api, datos["recepcion"], datos["orden"],
        {"descripcion": "Mano de obra", "cantidad": 1},
    )
    assert r.status_code == 422

    r = _post_detalle(
        api, datos["recepcion"], datos["orden"],
        {"descripcion": "Mano de obra", "cantidad": 1,
         "precio_unitario": "3000"},
    )
    assert r.status_code == 201
    assert r.json()["a_cotizar"] is False
    assert r.json()["subtotal"] == "3000.00"


def test_cobro_con_lineas_a_cotizar_da_409(api, datos):
    _mano_obra_mecanico(api, datos)
    r = api.post(
        f"/api/v1/ordenes/{datos['orden']}/cobro",
        headers=datos["recepcion"], json={"monto": "20000"},
    )
    assert r.status_code == 409
    assert r.json()["detail"] == "Hay trabajos sin cotizar"


def test_cobro_como_mecanico_da_403(api, datos):
    r = api.post(
        f"/api/v1/ordenes/{datos['orden']}/cobro",
        headers=datos["mecanico"], json={"monto": "20000"},
    )
    assert r.status_code == 403


def test_cobro_sale_despues_de_cotizar(api, datos):
    linea = _mano_obra_mecanico(api, datos).json()
    r = api.post(
        f"/api/v1/ordenes/{datos['orden']}/cobro",
        headers=datos["recepcion"], json={"monto": "20000"},
    )
    assert r.status_code == 409

    api.patch(
        f"/api/v1/ordenes/{datos['orden']}/detalles/{linea['id']}",
        headers=datos["recepcion"], json={"precio_unitario": "5000"},
    )
    r = api.post(
        f"/api/v1/ordenes/{datos['orden']}/cobro",
        headers=datos["recepcion"], json={"monto": "20000"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["costo_final"] == "20000.00"
    assert r.json()["cobro_estado"] == "aprobado"


def test_portal_muestra_a_cotizar_sin_sumar_al_total(api, datos):
    _post_detalle(
        api, datos["mecanico"], datos["orden"],
        {"repuesto_id": datos["repuesto"], "cantidad": 1},
    )
    _mano_obra_mecanico(api, datos)

    r = api.get(f"/api/v1/mis-ordenes/{datos['orden']}", headers=datos["portal"])
    assert r.status_code == 200, r.text
    cuerpo = r.json()
    assert cuerpo["lineas_a_cotizar"] == 1
    assert cuerpo["total_parcial"] is True
    assert cuerpo["total"] == "1500.00"

    a_cotizar = [d for d in cuerpo["detalles"] if d["a_cotizar"]]
    assert len(a_cotizar) == 1
    assert a_cotizar[0]["precio_unitario"] is None
    assert a_cotizar[0]["subtotal"] is None


def test_metricas_no_falla_con_precios_nulos(api, datos):
    _mano_obra_mecanico(api, datos)
    r = api.get("/api/v1/metricas/finanzas", headers=datos["admin"])
    assert r.status_code == 200, r.text


def test_mecanico_no_ve_pagos_ni_sus_montos(api, datos):
    """La orden no expone `pagos` al mecánico: montos y datos del cobro son
    del mostrador (administración y recepción sí los ven)."""
    with SessionLocal() as db:
        db.add(
            Pago(
                orden_id=datos["orden"], monto=Decimal("1500.00"),
                estado="duplicado", medio="mercadopago", payment_id="999888",
            )
        )
        db.commit()

    r = api.get(f"/api/v1/ordenes/{datos['orden']}", headers=datos["mecanico"])
    assert r.status_code == 200, r.text
    assert r.json()["pagos"] == []
    assert r.json()["tiene_pago_duplicado"] is False

    # Recepción sí los ve, con el estado 'duplicado' incluido.
    r = api.get(f"/api/v1/ordenes/{datos['orden']}", headers=datos["recepcion"])
    assert r.status_code == 200
    assert r.json()["pagos"][0]["estado"] == "duplicado"
    assert r.json()["tiene_pago_duplicado"] is True
