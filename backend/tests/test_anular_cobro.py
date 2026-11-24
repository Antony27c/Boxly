"""F4b: con el cobro emitido las líneas se bloquean (409 ``cobro_emitido``) y
``POST /ordenes/{id}/cobro/anular`` limpia el cobro para poder editar. Un pago
online que Mercado Pago apruebe después de anular queda 'duplicado' para
devolución manual: la orden no se marca pagada.
"""
from datetime import datetime, timezone
from decimal import Decimal
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.api.v1.pagos import mercadopago
from app.api.v1.pagos import service as pagos_service
from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.main import app
from app.models import Cliente, Orden, Pago, Repuesto, Taller, Usuario, Vehiculo
from app.models.detalle_orden import DetalleOrden
from app.models.usuario import RolUsuario

MENSAJE_COBRO = "El cobro ya está emitido; anulalo para cambiar las líneas"


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
        cuenta = Usuario(
            nombre="Juan", apellido="Perez", email="cuenta@x.com",
            password_hash=hash_password("x"), rol=RolUsuario.cliente,
        )
        cliente = Cliente(
            nombre="Juan", apellido="Perez", dni="30111222", email="j@x.com"
        )
        otro = Taller(nombre="Otro taller")
        db.add_all([admin, recepcion, mecanico, cuenta, cliente, otro])
        db.flush()
        cuenta.cliente_id = cliente.id
        admin2 = Usuario(
            nombre="Admin", apellido="B", email="admin-b@x.com",
            password_hash=hash_password("x"), rol=RolUsuario.administrador,
            taller_id=otro.id,
        )
        db.add(admin2)
        vehiculo = Vehiculo(
            cliente_id=cliente.id, patente="ABC123", marca="VW", modelo="Gol"
        )
        repuesto = Repuesto(
            codigo="ACEITE5W30", nombre="Aceite 5W30", stock=10,
            precio=Decimal("1500.00"),
        )
        db.add_all([vehiculo, repuesto])
        db.flush()

        def orden(codigo, **extra):
            return Orden(
                cliente_id=cliente.id, vehiculo_id=vehiculo.id,
                creado_por_id=admin.id, mecanico_id=mecanico.id,
                codigo=codigo, estado="listo",
                descripcion_ingreso="Cambio de aceite y filtros", **extra,
            )

        # Cobro emitido y todavía sin pagar: el escenario de F4b.
        con_cobro = orden(
            "OT-COBRO-1", costo_final=Decimal("11000.00"),
            cobro_estado="aprobado", cobro_aprobado_por_id=admin.id,
            cobro_aprobado_en=datetime.now(timezone.utc),
        )
        # Ya paga: anularla tiene que dar 409.
        pagada = orden(
            "OT-COBRO-2", costo_final=Decimal("3000.00"),
            cobro_estado="aprobado",
        )
        # Lista para cobrar pero sin cobro emitido.
        sin_cobro = orden("OT-COBRO-3")
        db.add_all([con_cobro, pagada, sin_cobro])
        db.flush()
        db.add_all([
            DetalleOrden(
                orden_id=con_cobro.id, repuesto_id=repuesto.id,
                descripcion="Aceite 5W30", cantidad=2,
                precio_unitario=Decimal("1500.00"),
            ),
            DetalleOrden(
                orden_id=con_cobro.id, descripcion="Mano de obra diagnosis",
                cantidad=1, precio_unitario=Decimal("8000.00"),
            ),
            # El link de pago online que el cliente ya pudo haber abierto.
            Pago(
                orden_id=con_cobro.id, monto=Decimal("11000.00"),
                estado="pendiente", medio="mercadopago",
            ),
            Pago(
                orden_id=pagada.id, monto=Decimal("3000.00"),
                estado="aprobado", medio="efectivo", referencia="OP-9",
                fecha_pago=datetime.now(timezone.utc),
            ),
        ])
        db.commit()

        def token(u):
            return {"Authorization": "Bearer " + create_access_token(u.id)}

        with SessionLocal() as db2:
            lineas = db2.query(DetalleOrden).filter_by(orden_id=con_cobro.id).all()
            ids = {
                "detalle_repuesto": next(d.id for d in lineas if d.repuesto_id),
                "detalle_mo": next(d.id for d in lineas if not d.repuesto_id),
                "pago_pendiente": db2.query(Pago).filter_by(
                    orden_id=con_cobro.id, estado="pendiente"
                ).one().id,
            }
        return {
            "admin": token(admin), "recepcion": token(recepcion),
            "mecanico": token(mecanico), "cliente": token(cuenta),
            "admin2": token(admin2),
            "con_cobro": con_cobro.id, "pagada": pagada.id,
            "sin_cobro": sin_cobro.id, "repuesto": repuesto.id, **ids,
        }


@pytest.fixture
def api():
    with TestClient(app) as cliente:
        yield cliente


def _assert_cobro_emitido(r):
    assert r.status_code == 409, r.text
    cuerpo = r.json()
    assert cuerpo["codigo"] == "cobro_emitido"
    assert cuerpo["detail"] == MENSAJE_COBRO


# ---------------------------------------------------------------------------
# Líneas bloqueadas con el cobro emitido (todos los roles)
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("rol", ["admin", "recepcion", "mecanico"])
def test_agregar_repuesto_bloqueado_con_cobro(api, datos, rol):
    r = api.post(
        f"/api/v1/ordenes/{datos['con_cobro']}/detalles",
        headers=datos[rol],
        json={"repuesto_id": datos["repuesto"], "cantidad": 1},
    )
    _assert_cobro_emitido(r)


@pytest.mark.parametrize("rol", ["admin", "recepcion", "mecanico"])
def test_agregar_mano_de_obra_bloqueada_con_cobro(api, datos, rol):
    cuerpo = {"descripcion": "Alineación y balanceo", "cantidad": 1}
    if rol != "mecanico":
        cuerpo["precio_unitario"] = "5000.00"
    r = api.post(
        f"/api/v1/ordenes/{datos['con_cobro']}/detalles",
        headers=datos[rol], json=cuerpo,
    )
    _assert_cobro_emitido(r)


@pytest.mark.parametrize("rol", ["admin", "recepcion"])
def test_cotizar_linea_bloqueada_con_cobro(api, datos, rol):
    r = api.patch(
        f"/api/v1/ordenes/{datos['con_cobro']}/detalles/{datos['detalle_mo']}",
        headers=datos[rol], json={"precio_unitario": "9000.00"},
    )
    _assert_cobro_emitido(r)


def test_cotizar_linea_el_mecanico_sigue_sin_permiso(api, datos):
    r = api.patch(
        f"/api/v1/ordenes/{datos['con_cobro']}/detalles/{datos['detalle_mo']}",
        headers=datos["mecanico"], json={"precio_unitario": "9000.00"},
    )
    assert r.status_code == 403, r.text


@pytest.mark.parametrize("rol", ["admin", "recepcion", "mecanico"])
def test_quitar_lineas_bloqueadas_con_cobro(api, datos, rol):
    for detalle_id in (datos["detalle_repuesto"], datos["detalle_mo"]):
        r = api.delete(
            f"/api/v1/ordenes/{datos['con_cobro']}/detalles/{detalle_id}",
            headers=datos[rol],
        )
        _assert_cobro_emitido(r)


def test_el_stock_no_se_mueve_con_el_cobro_emitido(api, datos):
    with SessionLocal() as db:
        assert db.get(Repuesto, datos["repuesto"]).stock == 10
        assert db.query(DetalleOrden).filter_by(orden_id=datos["con_cobro"]).count() == 2


# ---------------------------------------------------------------------------
# Anular el cobro
# ---------------------------------------------------------------------------


def test_anular_limpia_el_cobro_y_registra_historial(api, datos):
    r = api.post(
        f"/api/v1/ordenes/{datos['con_cobro']}/cobro/anular",
        headers=datos["recepcion"],
    )
    assert r.status_code == 200, r.text
    cuerpo = r.json()
    assert cuerpo["costo_final"] is None
    assert cuerpo["cobro_estado"] is None
    assert cuerpo["cobro_aprobado_por_nombre"] is None
    assert cuerpo["cobro_aprobado_en"] is None

    with SessionLocal() as db:
        orden = db.get(Orden, datos["con_cobro"])
        assert orden.costo_final is None
        assert orden.cobro_estado is None
        assert orden.cobro_aprobado_por_id is None
        assert orden.cobro_aprobado_en is None
        # El pago online pendiente queda rechazado: el link viejo no acredita.
        pago = db.get(Pago, datos["pago_pendiente"])
        assert pago.estado == "rechazado"

    historial = api.get(
        f"/api/v1/ordenes/{datos['con_cobro']}/historial", headers=datos["admin"]
    )
    assert historial.status_code == 200, historial.text
    assert any("Cobro anulado por" in h["comentario"] for h in historial.json())


def test_despues_de_anular_se_vuelven_a_tocar_las_lineas(api, datos):
    api.post(
        f"/api/v1/ordenes/{datos['con_cobro']}/cobro/anular",
        headers=datos["admin"],
    )
    r = api.patch(
        f"/api/v1/ordenes/{datos['con_cobro']}/detalles/{datos['detalle_mo']}",
        headers=datos["recepcion"], json={"precio_unitario": "9000.00"},
    )
    assert r.status_code == 200, r.text
    r = api.post(
        f"/api/v1/ordenes/{datos['con_cobro']}/detalles",
        headers=datos["recepcion"],
        json={"descripcion": "Alineación", "cantidad": 1,
              "precio_unitario": "5000.00"},
    )
    assert r.status_code == 201, r.text


def test_anular_sin_cobro_emitido_da_409(api, datos):
    r = api.post(
        f"/api/v1/ordenes/{datos['sin_cobro']}/cobro/anular",
        headers=datos["admin"],
    )
    assert r.status_code == 409, r.text
    assert "no tiene un cobro emitido" in r.json()["detail"]


def test_anular_orden_pagada_da_409(api, datos):
    r = api.post(
        f"/api/v1/ordenes/{datos['pagada']}/cobro/anular",
        headers=datos["admin"],
    )
    assert r.status_code == 409, r.text
    assert r.json()["codigo"] == "orden_pagada"


@pytest.mark.parametrize("rol", ["mecanico", "cliente"])
def test_anular_solo_administracion_y_recepcion(api, datos, rol):
    r = api.post(
        f"/api/v1/ordenes/{datos['con_cobro']}/cobro/anular",
        headers=datos[rol],
    )
    assert r.status_code == 403, r.text


def test_anular_orden_de_otro_taller_da_404(api, datos):
    r = api.post(
        f"/api/v1/ordenes/{datos['con_cobro']}/cobro/anular",
        headers=datos["admin2"],
    )
    assert r.status_code == 404, r.text


# ---------------------------------------------------------------------------
# Webhook de MP después de anular: el pago queda 'duplicado', no paga la orden
# ---------------------------------------------------------------------------


def _settings_mp(monkeypatch):
    fake = SimpleNamespace(
        debug=True, environment="dev",
        mp_access_token="token", mp_webhook_secret=None,
        frontend_url="http://front.test", backend_public_url=None,
    )
    monkeypatch.setattr(pagos_service, "get_settings", lambda: fake)


def test_webhook_aprobado_tras_anular_no_paga_la_orden(api, datos, monkeypatch):
    # Primero se anula el cobro por la API: el pendiente queda rechazado.
    r = api.post(
        f"/api/v1/ordenes/{datos['con_cobro']}/cobro/anular",
        headers=datos["recepcion"],
    )
    assert r.status_code == 200, r.text

    _settings_mp(monkeypatch)
    monkeypatch.setattr(
        mercadopago, "obtener_pago",
        lambda *a, **k: {
            "id": "555000",
            "status": "approved",
            "transaction_amount": "11000.00",
            "external_reference": str(datos["pago_pendiente"]),
        },
    )
    r = api.post(
        "/api/v1/pagos/webhook",
        json={"type": "payment", "data": {"id": "555000"}},
    )
    assert r.status_code == 200, r.text

    with SessionLocal() as db:
        pago = db.get(Pago, datos["pago_pendiente"])
        # La plata quedó en MP pero la orden ya no tiene cobro vigente:
        # 'duplicado' para devolución manual y la orden NO queda pagada.
        assert pago.estado == "duplicado"
        assert pago.payment_id == "555000"
        orden = db.get(Orden, datos["con_cobro"])
        assert orden.pagada is False
        assert orden.cobro_estado is None
