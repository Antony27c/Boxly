"""Flujo end-to-end del taller por la API (TestClient).

Recepción agenda y abre la orden, el mecánico la repara y la deja lista,
recepción emite el cobro y administración lo aprueba, el cliente paga desde
el portal (simulado en dev) y recepción entrega. Incluye la devolución de
stock al cancelar una orden con repuestos.
"""

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.main import app
from app.models import Usuario
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
            nombre="Rita", apellido="Mostrador", email="recepcion@x.com",
            password_hash=hash_password("x"), rol=RolUsuario.recepcion,
        )
        mecanico = Usuario(
            nombre="Memo", apellido="Mecanico", email="mecanico@x.com",
            password_hash=hash_password("x"), rol=RolUsuario.mecanico,
        )
        db.add_all([admin, recepcion, mecanico])
        db.commit()
        return {
            "admin": {"Authorization": "Bearer " + create_access_token(admin.id)},
            "recepcion": {"Authorization": "Bearer " + create_access_token(recepcion.id)},
            "mecanico": {"Authorization": "Bearer " + create_access_token(mecanico.id)},
            "mecanico_id": mecanico.id,
        }


@pytest.fixture
def api():
    with TestClient(app) as cliente:
        yield cliente


def _crear_cliente_y_vehiculo(api, headers):
    """Recepción da de alta cliente y vehículo; devuelve sus ids."""
    r = api.post("/api/v1/clientes", headers=headers, json={
        "nombre": "Juan", "apellido": "Perez", "dni": "30111222",
        "telefono": "3510000000",
    })
    assert r.status_code == 201, r.text
    cliente_id = r.json()["id"]

    r = api.post("/api/v1/vehiculos", headers=headers, json={
        "cliente_id": cliente_id, "patente": "ABC123",
        "marca": "VW", "modelo": "Gol", "anio": 2015,
    })
    assert r.status_code == 201, r.text
    return cliente_id, r.json()["id"]


def _crear_repuesto(api, headers, stock=10):
    r = api.post("/api/v1/repuestos", headers=headers, json={
        "codigo": "ACEITE5W30", "nombre": "Aceite 5W30",
        "precio": "1500.00", "stock": stock, "stock_minimo": 2,
    })
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _crear_usuario_portal(cliente_id: int) -> dict:
    """Usuario rol cliente vinculado al cliente (cuenta del portal)."""
    with SessionLocal() as db:
        usuario = Usuario(
            nombre="Juan", apellido="Perez", email="juan.portal@x.com",
            password_hash=hash_password("x"), rol=RolUsuario.cliente,
            cliente_id=cliente_id,
        )
        db.add(usuario)
        db.commit()
        return {"Authorization": "Bearer " + create_access_token(usuario.id)}


def _cambiar_estado(api, headers, orden_id, estado, comentario):
    return api.patch(
        f"/api/v1/ordenes/{orden_id}", headers=headers,
        json={"estado": estado, "comentario_cambio": comentario},
    )


def test_flujo_completo_del_taller(api, datos, monkeypatch):
    h_admin = datos["admin"]
    h_recep = datos["recepcion"]
    h_mec = datos["mecanico"]

    # 1) Recepción crea cliente y vehículo, y agenda un turno con el mecánico.
    cliente_id, vehiculo_id = _crear_cliente_y_vehiculo(api, h_recep)
    r = api.post("/api/v1/turnos", headers=h_recep, json={
        "cliente_id": cliente_id, "vehiculo_id": vehiculo_id,
        "mecanico_id": datos["mecanico_id"],
        "fecha_hora": "2026-03-10T10:00:00",
        "motivo": "Cambio de aceite y revisión general",
    })
    assert r.status_code == 201, r.text

    # El cliente del portal (rol cliente vinculado al cliente_id).
    h_cliente = _crear_usuario_portal(cliente_id)

    # 2) Recepción abre la orden asignada al mecánico.
    r = api.post("/api/v1/ordenes", headers=h_recep, json={
        "vehiculo_id": vehiculo_id,
        "mecanico_id": datos["mecanico_id"],
        "descripcion_ingreso": "Ruido en el motor, revisar filtros",
    })
    assert r.status_code == 201, r.text
    orden = r.json()
    orden_id = orden["id"]
    assert orden["estado"] == "pendiente"
    assert orden["mecanico_id"] == datos["mecanico_id"]

    # 3) El mecánico agrega repuesto (descuenta stock) y mano de obra,
    #    y pasa la orden por ingresado -> en_diagnostico -> listo.
    repuesto_id = _crear_repuesto(api, h_recep, stock=10)

    r = api.post(f"/api/v1/ordenes/{orden_id}/detalles", headers=h_mec, json={
        "repuesto_id": repuesto_id, "cantidad": 2,
    })
    assert r.status_code == 201, r.text
    assert r.json()["precio_unitario"] == "1500.00"  # precio del catálogo

    r = api.get(f"/api/v1/repuestos/{repuesto_id}", headers=h_recep)
    assert r.json()["stock"] == 8  # 10 - 2

    r = api.post(f"/api/v1/ordenes/{orden_id}/detalles", headers=h_mec, json={
        "descripcion": "Mano de obra diagnosis", "cantidad": 1,
        "precio_unitario": "8000.00",
    })
    assert r.status_code == 201, r.text

    for estado, comentario in [
        ("ingresado", "Vehículo recibido en el taller"),
        ("en_diagnostico", "Revisando motor y filtros"),
        ("listo", "Trabajo terminado, se retira mañana"),
    ]:
        r = _cambiar_estado(api, h_mec, orden_id, estado, comentario)
        assert r.status_code == 200, r.text
        assert r.json()["estado"] == estado

    r = api.get(f"/api/v1/ordenes/{orden_id}/historial", headers=h_recep)
    assert r.status_code == 200
    estados_historial = {h["estado_nuevo"] for h in r.json()}
    assert {"ingresado", "en_diagnostico", "listo"} <= estados_historial

    # 4) Recepción emite el cobro y administración lo aprueba.
    r = api.post(f"/api/v1/ordenes/{orden_id}/cobro", headers=h_recep,
                 json={"monto": "11000.00"})
    assert r.status_code == 200, r.text
    assert r.json()["costo_final"] == "11000.00"
    assert r.json()["cobro_estado"] == "aprobado"

    r = api.post(f"/api/v1/ordenes/{orden_id}/cobro/aprobar", headers=h_admin,
                 json={"monto": "11000.00"})
    assert r.status_code == 200, r.text

    # 5) El cliente ve la orden en el portal, crea el pago y el admin lo
    #    simula aprobado (solo en dev+debug): la orden queda pagada.
    r = api.get("/api/v1/mis-ordenes", headers=h_cliente)
    assert r.status_code == 200
    assert any(o["id"] == orden_id for o in r.json())

    r = api.get(f"/api/v1/mis-ordenes/{orden_id}", headers=h_cliente)
    assert r.status_code == 200
    assert r.json()["puede_pagar"] is True
    assert r.json()["pagada"] is False

    monkeypatch.setenv("ENVIRONMENT", "dev")
    monkeypatch.setenv("DEBUG", "true")
    get_settings.cache_clear()

    r = api.post(f"/api/v1/pagos/ordenes/{orden_id}", headers=h_cliente)
    assert r.status_code == 201, r.text
    pago_id = r.json()["pago_id"]

    r = api.post(f"/api/v1/pagos/{pago_id}/simular", headers=h_admin,
                 json={"estado": "aprobado"})
    assert r.status_code == 200, r.text
    assert r.json()["estado"] == "aprobado"

    r = api.get(f"/api/v1/ordenes/{orden_id}", headers=h_recep)
    assert r.json()["pagada"] is True

    # 6) Recepción la pasa a entregado (fecha_entrega se setea sola) y la
    #    orden queda cerrada: ya no admite otro cambio de estado.
    r = _cambiar_estado(api, h_recep, orden_id, "entregado",
                        "Cliente retira el vehículo")
    assert r.status_code == 200, r.text
    assert r.json()["estado"] == "entregado"
    assert r.json()["fecha_entrega"] is not None

    r = _cambiar_estado(api, h_recep, orden_id, "cancelado", "Intento")
    assert r.status_code == 400

    get_settings.cache_clear()


def test_cancelar_orden_con_repuestos_devuelve_stock(api, datos):
    h_recep = datos["recepcion"]

    _, vehiculo_id = _crear_cliente_y_vehiculo(api, h_recep)
    repuesto_id = _crear_repuesto(api, h_recep, stock=5)

    r = api.post("/api/v1/ordenes", headers=h_recep, json={
        "vehiculo_id": vehiculo_id,
        "descripcion_ingreso": "Falla de arranque intermitente",
    })
    assert r.status_code == 201, r.text
    orden_id = r.json()["id"]

    r = api.post(f"/api/v1/ordenes/{orden_id}/detalles", headers=h_recep, json={
        "repuesto_id": repuesto_id, "cantidad": 2,
    })
    assert r.status_code == 201, r.text

    r = api.get(f"/api/v1/repuestos/{repuesto_id}", headers=h_recep)
    assert r.json()["stock"] == 3

    r = _cambiar_estado(api, h_recep, orden_id, "cancelado",
                        "El cliente se arrepintió")
    assert r.status_code == 200, r.text
    assert r.json()["estado"] == "cancelado"

    r = api.get(f"/api/v1/repuestos/{repuesto_id}", headers=h_recep)
    assert r.json()["stock"] == 5  # 3 + 2 devueltos


def test_orden_cancelada_no_admite_edicion_de_campos(api, datos):
    h_recep = datos["recepcion"]
    _, vehiculo_id = _crear_cliente_y_vehiculo(api, h_recep)

    r = api.post("/api/v1/ordenes", headers=h_recep, json={
        "vehiculo_id": vehiculo_id,
        "descripcion_ingreso": "Revisión de tren delantero",
    })
    assert r.status_code == 201, r.text
    orden_id = r.json()["id"]

    r = _cambiar_estado(api, h_recep, orden_id, "cancelado", "Cliente desistió")
    assert r.status_code == 200, r.text

    # Una orden cerrada no debería aceptar cambios de datos.
    r = api.patch(f"/api/v1/ordenes/{orden_id}", headers=h_recep,
                  json={"diagnostico": "no debería guardarse"})
    assert r.status_code == 400
