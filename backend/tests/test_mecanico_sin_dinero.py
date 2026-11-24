"""El mecánico no recibe precios ni montos en ninguna respuesta del servidor.

Recorre las rutas que el rol mecánico puede llamar dentro de órdenes e
historial del vehículo y verifica que ninguna clave de dinero aparezca con un
valor real: precios, subtotales, totales, costos, presupuesto, montos de cobro,
pagos ni datos del pago. Administración y recepción siguen viendo todo.
"""
import re
from datetime import datetime, timezone
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
from app.models.usuario import RolUsuario, Usuario
from app.models.vehiculo import Vehiculo

PATRON_DINERO = re.compile(
    r"precio|monto|total|subtotal|costo|presupuesto|cobrado|cobro|pago", re.I
)
# Estados de trabajo que no son montos y la pantalla del mecánico necesita.
CLAVES_SIN_DINERO = {"cobro_estado", "pago_online"}


def _dinero_visible(obj, ruta=""):
    """Claves con pinta de dinero que llegan con un valor real (no null/vacío)."""
    hallazgos = []
    if isinstance(obj, dict):
        for clave, valor in obj.items():
            if (
                PATRON_DINERO.search(clave)
                and clave not in CLAVES_SIN_DINERO
                and valor not in (None, False, "", [], {})
            ):
                hallazgos.append(f"{ruta}{clave}={valor!r}")
            hallazgos += _dinero_visible(valor, f"{ruta}{clave}.")
    elif isinstance(obj, list):
        for i, valor in enumerate(obj):
            hallazgos += _dinero_visible(valor, f"{ruta}{i}.")
    return hallazgos


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
        vehiculo = Vehiculo(
            cliente_id=cliente.id, patente="ABC123", marca="VW", modelo="Gol"
        )
        repuesto = Repuesto(
            codigo="FILTRO", nombre="Filtro de aceite", stock=10,
            precio=Decimal("800.00"),
        )
        db.add_all([vehiculo, repuesto])
        db.flush()
        # Orden lista para entregar, con presupuesto, cobro aprobado y pagos:
        # el peor caso de exposición de dinero para el mecánico.
        orden = Orden(
            cliente_id=cliente.id, vehiculo_id=vehiculo.id,
            creado_por_id=admin.id, mecanico_id=mecanico.id,
            codigo="OT-SINDIN-1", estado="listo",
            descripcion_ingreso="Cambio de aceite y filtros",
            costo_estimado=Decimal("12000.00"), costo_final=Decimal("20000.00"),
            cobro_estado="aprobado", cobro_aprobado_por_id=admin.id,
            cobro_aprobado_en=datetime.now(timezone.utc),
        )
        db.add(orden)
        db.flush()
        detalle = DetalleOrden(
            orden_id=orden.id, repuesto_id=repuesto.id,
            descripcion="Filtro de aceite", cantidad=2,
            precio_unitario=Decimal("800.00"),
        )
        db.add(detalle)
        db.flush()
        db.add_all([
            Pago(
                orden_id=orden.id, monto=Decimal("20000.00"),
                estado="aprobado", medio="efectivo",
                fecha_pago=datetime.now(timezone.utc),
            ),
            Pago(
                orden_id=orden.id, monto=Decimal("20000.00"),
                estado="duplicado", medio="mercadopago", payment_id="777",
            ),
        ])
        # Orden abierta (sin cobro ni pagos) para las pruebas de escritura:
        # con F4/F4b una orden pagada o con cobro emitido no cambia líneas.
        abierta = Orden(
            cliente_id=cliente.id, vehiculo_id=vehiculo.id,
            creado_por_id=admin.id, mecanico_id=mecanico.id,
            codigo="OT-SINDIN-2", estado="listo",
            descripcion_ingreso="Revision de suspension",
        )
        db.add(abierta)
        db.commit()
        return {
            "admin": _h(admin),
            "recepcion": _h(recepcion),
            "mecanico": _h(mecanico),
            "vehiculo": vehiculo.id,
            "orden": orden.id,
            "abierta": abierta.id,
            "detalle": detalle.id,
        }


@pytest.fixture
def api():
    with TestClient(app) as cliente:
        yield cliente


def _rutas_mecanico(api, datos):
    """Todas las respuestas que el mecánico puede pedir de la orden."""
    oid = datos["orden"]
    return {
        "lista": api.get("/api/v1/ordenes", headers=datos["mecanico"]),
        "detalle": api.get(f"/api/v1/ordenes/{oid}", headers=datos["mecanico"]),
        "detalles": api.get(
            f"/api/v1/ordenes/{oid}/detalles", headers=datos["mecanico"]
        ),
        "historial": api.get(
            f"/api/v1/ordenes/{oid}/historial", headers=datos["mecanico"]
        ),
        "notificaciones": api.get(
            f"/api/v1/ordenes/{oid}/notificaciones", headers=datos["mecanico"]
        ),
        "vehiculo_ordenes": api.get(
            f"/api/v1/vehiculos/{datos['vehiculo']}/ordenes",
            headers=datos["mecanico"],
        ),
    }


def test_mecanico_no_recibe_dinero_en_ninguna_ruta(api, datos):
    for nombre, respuesta in _rutas_mecanico(api, datos).items():
        assert respuesta.status_code == 200, f"{nombre}: {respuesta.text}"
        dinero = _dinero_visible(respuesta.json())
        assert dinero == [], f"{nombre}: {dinero}"


def test_mecanico_tampoco_ve_dinero_en_escritura(api, datos):
    # La orden abierta sigue editable: el mecánico agrega una línea y cambia
    # la etapa (la pagada ya no admite cambios de líneas, ver F4).
    r = api.post(
        f"/api/v1/ordenes/{datos['abierta']}/detalles",
        headers=datos["mecanico"],
        json={"descripcion": "Mano de obra final", "cantidad": 1},
    )
    assert r.status_code == 201, r.text
    assert _dinero_visible(r.json()) == []

    r = api.patch(
        f"/api/v1/ordenes/{datos['abierta']}",
        headers=datos["mecanico"],
        json={"estado": "entregado", "comentario_cambio": "Cliente retiró"},
    )
    assert r.status_code == 200, r.text
    assert _dinero_visible(r.json()) == []


def test_mecanico_no_puede_fijar_costo_estimado(api, datos):
    """El presupuesto estimado es dinero: el PATCH del mecánico que lo incluye
    se rechaza con 403 (como el monto final a cobrar)."""
    r = api.patch(
        f"/api/v1/ordenes/{datos['orden']}",
        headers=datos["mecanico"],
        json={"costo_estimado": "99999.00"},
    )
    assert r.status_code == 403
    with SessionLocal() as db:
        assert db.get(Orden, datos["orden"]).costo_estimado == Decimal("12000.00")


def test_admin_y_recepcion_siguen_viendo_dinero(api, datos):
    for headers in (datos["admin"], datos["recepcion"]):
        r = api.get(f"/api/v1/ordenes/{datos['orden']}", headers=headers)
        assert r.status_code == 200
        cuerpo = r.json()
        assert cuerpo["costo_estimado"] == "12000.00"
        assert cuerpo["costo_final"] == "20000.00"
        assert cuerpo["pagada"] is True
        assert cuerpo["pago_medio"] == "efectivo"
        assert len(cuerpo["pagos"]) == 2
        assert cuerpo["tiene_pago_duplicado"] is True

        r = api.get(
            f"/api/v1/ordenes/{datos['orden']}/detalles", headers=headers
        )
        detalle = next(d for d in r.json() if d["id"] == datos["detalle"])
        assert detalle["precio_unitario"] == "800.00"
        assert detalle["subtotal"] == "1600.00"


def test_historial_enmascara_montos_para_el_mecanico(api, datos):
    # Recepción cotiza una línea sin precio en la orden abierta: el comentario
    # del historial guarda el monto ("a $X") para administración y recepción.
    linea = api.post(
        f"/api/v1/ordenes/{datos['abierta']}/detalles",
        headers=datos["recepcion"],
        json={"descripcion": "Mano de obra", "cantidad": 1,
              "precio_unitario": "4500"},
    ).json()
    api.patch(
        f"/api/v1/ordenes/{datos['abierta']}/detalles/{linea['id']}",
        headers=datos["recepcion"], json={"precio_unitario": "4500"},
    )

    r = api.get(
        f"/api/v1/ordenes/{datos['abierta']}/historial",
        headers=datos["mecanico"],
    )
    assert r.status_code == 200, r.text
    comentarios = [h["comentario"] or "" for h in r.json()]
    assert any("cotizada" in c for c in comentarios)
    for comentario in comentarios:
        assert "4500" not in comentario
        assert not re.search(r"\$\s*\d", comentario)

    # Recepción sigue viendo el monto en el mismo historial.
    r = api.get(
        f"/api/v1/ordenes/{datos['abierta']}/historial", headers=datos["recepcion"]
    )
    assert any("4500" in (h["comentario"] or "") for h in r.json())


def test_cobro_como_mecanico_sigue_dando_403(api, datos):
    r = api.post(
        f"/api/v1/ordenes/{datos['orden']}/cobro",
        headers=datos["mecanico"], json={"monto": "20000"},
    )
    assert r.status_code == 403
