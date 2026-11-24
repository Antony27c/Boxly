"""Pago registrado en el local (docs/Oferta.md, sección 4b, W2)."""

from datetime import date, timedelta
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.main import app
from app.models import Cliente, Orden, Taller, Usuario, Vehiculo
from app.models.pago import Pago
from app.models.usuario import RolUsuario


def _usuario(rol: RolUsuario, email: str, **extra) -> Usuario:
    return Usuario(nombre="N", apellido="A", email=email,
                   password_hash=hash_password("x"), rol=rol, **extra)


def _orden(cliente_id, vehiculo_id, creado_por_id, codigo, **extra) -> Orden:
    return Orden(cliente_id=cliente_id, vehiculo_id=vehiculo_id, creado_por_id=creado_por_id,
                 codigo=codigo, estado="listo", descripcion_ingreso="Cambio de frenos", **extra)


@pytest.fixture
def datos():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        admin = _usuario(RolUsuario.administrador, "admin@x.com")
        recepcion = _usuario(RolUsuario.recepcion, "recep@x.com")
        mecanico = _usuario(RolUsuario.mecanico, "mec@x.com")
        cliente = Cliente(nombre="Juan", apellido="Perez", dni="12345678", email="juan@x.com")
        db.add_all([admin, recepcion, mecanico, cliente])
        db.flush()
        cuenta = _usuario(RolUsuario.cliente, "cuenta@x.com", cliente_id=cliente.id)
        vehiculo = Vehiculo(cliente_id=cliente.id, patente="AB123CD", marca="Ford", modelo="Focus")
        db.add_all([cuenta, vehiculo])
        db.flush()
        con_cobro = _orden(cliente.id, vehiculo.id, admin.id, "OT-1",
                           costo_final=Decimal("1500.00"), cobro_estado="aprobado")
        sin_cobro = _orden(cliente.id, vehiculo.id, admin.id, "OT-2")
        db.add_all([con_cobro, sin_cobro])

        # Orden con cobro emitido en un segundo taller.
        otro = Taller(nombre="Otro taller")
        db.add(otro)
        db.flush()
        admin_b = _usuario(RolUsuario.administrador, "admin-b@x.com", taller_id=otro.id)
        cliente_b = Cliente(nombre="Ana", apellido="Gomez", dni="87654321", taller_id=otro.id)
        db.add_all([admin_b, cliente_b])
        db.flush()
        vehiculo_b = Vehiculo(cliente_id=cliente_b.id, patente="ZZ999ZZ", marca="Fiat",
                              modelo="Uno", taller_id=otro.id)
        db.add(vehiculo_b)
        db.flush()
        orden_b = _orden(cliente_b.id, vehiculo_b.id, admin_b.id, "OT-B1", taller_id=otro.id,
                         costo_final=Decimal("1500.00"), cobro_estado="aprobado")
        db.add(orden_b)
        db.commit()

        def token(u):
            return {"Authorization": "Bearer " + create_access_token(u.id)}

        return {
            "admin": token(admin), "recepcion": token(recepcion),
            "mecanico": token(mecanico), "cliente": token(cuenta),
            "con_cobro": con_cobro.id, "sin_cobro": sin_cobro.id, "orden_b": orden_b.id,
        }


@pytest.fixture
def api():
    with TestClient(app) as cliente:
        yield cliente


def _pagar(api, headers, orden_id, **cuerpo):
    body = {"medio": "efectivo", "monto": "1500.00", **cuerpo}
    return api.post(f"/api/v1/ordenes/{orden_id}/pago-local", headers=headers, json=body)


def test_efectivo_deja_la_orden_pagada_y_el_portal_la_muestra(api, datos):
    r = _pagar(api, datos["recepcion"], datos["con_cobro"], referencia="  Caja 1  ")
    assert r.status_code == 200, r.text
    orden = r.json()
    assert orden["pagada"] is True
    assert orden["pago_medio"] == "efectivo"
    assert orden["pago_fecha"] is not None

    detalle = api.get(f"/api/v1/ordenes/{datos['con_cobro']}", headers=datos["admin"]).json()
    assert detalle["pagada"] is True and detalle["pago_medio"] == "efectivo"

    portal = api.get(f"/api/v1/mis-ordenes/{datos['con_cobro']}", headers=datos["cliente"])
    assert portal.status_code == 200, portal.text
    portal = portal.json()
    assert portal["pagada"] is True
    assert portal["puede_pagar"] is False
    assert portal["pago"]["medio"] == "efectivo"
    assert portal["pago"]["estado"] == "aprobado"
    assert portal["pago"]["fecha_pago"] is not None

    with SessionLocal() as db:
        pago = db.query(Pago).filter_by(orden_id=datos["con_cobro"]).one()
        assert pago.referencia == "Caja 1"
        assert pago.monto == Decimal("1500.00")


@pytest.mark.parametrize("medio", ["tarjeta", "transferencia", "otro"])
def test_admin_registra_con_cualquier_medio_local(api, datos, medio):
    r = _pagar(api, datos["admin"], datos["con_cobro"], medio=medio)
    assert r.status_code == 200, r.text
    assert r.json()["pago_medio"] == medio


def test_mercadopago_no_es_un_medio_local(api, datos):
    assert _pagar(api, datos["admin"], datos["con_cobro"], medio="mercadopago").status_code == 422


def test_sin_cobro_emitido_409(api, datos):
    r = _pagar(api, datos["admin"], datos["sin_cobro"])
    assert r.status_code == 409
    assert "cobro emitido" in r.json()["detail"]


def test_monto_distinto_422_con_explicacion(api, datos):
    r = _pagar(api, datos["admin"], datos["con_cobro"], monto="1000.00")
    assert r.status_code == 422
    assert "1,500.00" in r.json()["detail"]


def test_mecanico_y_cliente_reciben_403(api, datos):
    assert _pagar(api, datos["mecanico"], datos["con_cobro"]).status_code == 403
    assert _pagar(api, datos["cliente"], datos["con_cobro"]).status_code == 403


def test_orden_de_otro_taller_404(api, datos):
    assert _pagar(api, datos["admin"], datos["orden_b"]).status_code == 404
    with SessionLocal() as db:
        assert db.query(Pago).count() == 0


def test_no_se_puede_pagar_dos_veces(api, datos):
    assert _pagar(api, datos["admin"], datos["con_cobro"]).status_code == 200
    r = _pagar(api, datos["recepcion"], datos["con_cobro"], medio="tarjeta")
    assert r.status_code == 409
    assert r.json()["detail"] == "La orden ya está pagada"
    with SessionLocal() as db:
        assert db.query(Pago).filter_by(estado="aprobado").count() == 1


def test_anula_el_intento_online_pendiente(api, datos):
    with SessionLocal() as db:
        db.add(Pago(orden_id=datos["con_cobro"], monto=Decimal("1500.00"), estado="pendiente"))
        db.commit()
    assert _pagar(api, datos["admin"], datos["con_cobro"]).status_code == 200
    with SessionLocal() as db:
        estados = {p.medio: p.estado for p in db.query(Pago).all()}
    assert estados == {"mercadopago": "rechazado", "efectivo": "aprobado"}


def test_las_metricas_cuentan_el_ingreso(api, datos):
    assert _pagar(api, datos["admin"], datos["con_cobro"]).status_code == 200
    hoy = date.today()
    r = api.get(
        "/api/v1/metricas/finanzas", headers=datos["admin"],
        params={"desde": str(hoy - timedelta(days=1)), "hasta": str(hoy + timedelta(days=1))},
    )
    assert r.status_code == 200, r.text
    assert r.json()["cobrado"] == "1500.00"
    assert r.json()["cobrado_por_medio"]["efectivo"] == "1500.00"
    assert r.json()["cobrado_por_medio"]["mercadopago"] == "0.00"
