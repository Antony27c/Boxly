"""Historial del vehículo sin dinero para el mecánico (MC1h).

``GET /vehiculos/{id}/ordenes`` le devuelve al mecánico sus órdenes del
vehículo con los estados de trabajo pero sin montos, cobro ni pagos.
Administración y recepción ven la orden completa.
"""
from datetime import datetime, timezone
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.main import app
from app.models import Cliente, Orden, Usuario, Vehiculo
from app.models.pago import Pago
from app.models.usuario import RolUsuario

CAMPOS_DINERO = (
    "costo_estimado", "costo_final", "monto_propuesto", "cobro_propuesto_por_nombre",
    "cobro_aprobado_por_nombre", "cobro_aprobado_en", "pago_medio", "pago_fecha",
)


def _usuario(rol: RolUsuario, email: str) -> Usuario:
    return Usuario(nombre=rol.value.title(), apellido="Prueba", email=email,
                   password_hash=hash_password("x"), rol=rol, activo=True)


@pytest.fixture
def datos():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        admin = _usuario(RolUsuario.administrador, "admin@x.com")
        recepcion = _usuario(RolUsuario.recepcion, "recep@x.com")
        mecanico = _usuario(RolUsuario.mecanico, "mec@x.com")
        otro_mecanico = _usuario(RolUsuario.mecanico, "mec2@x.com")
        cliente = Cliente(nombre="Juan", apellido="Perez", dni="30111222", email="j@x.com")
        db.add_all([admin, recepcion, mecanico, otro_mecanico, cliente])
        db.flush()
        vehiculo = Vehiculo(cliente_id=cliente.id, patente="ABC123", marca="VW", modelo="Gol")
        db.add(vehiculo)
        db.flush()
        cobrada = Orden(
            cliente_id=cliente.id, vehiculo_id=vehiculo.id, creado_por_id=admin.id,
            mecanico_id=mecanico.id, codigo="OT-1", estado="entregado",
            descripcion_ingreso="Service completo", costo_estimado=Decimal("50000"),
            costo_final=Decimal("62000"), cobro_estado="aprobado",
            monto_propuesto=Decimal("62000"), cobro_propuesto_por_id=mecanico.id,
            cobro_aprobado_por_id=admin.id, cobro_aprobado_en=datetime.now(timezone.utc),
            fecha_entrega=datetime.now(timezone.utc),
        )
        ajena = Orden(
            cliente_id=cliente.id, vehiculo_id=vehiculo.id, creado_por_id=admin.id,
            mecanico_id=otro_mecanico.id, codigo="OT-2", estado="pendiente",
            descripcion_ingreso="Revisión de frenos", costo_estimado=Decimal("9000"),
        )
        db.add_all([cobrada, ajena])
        db.flush()
        db.add(Pago(orden_id=cobrada.id, monto=Decimal("62000"), estado="aprobado",
                    medio="efectivo", fecha_pago=datetime.now(timezone.utc)))
        db.commit()
        return {
            "url": f"/api/v1/vehiculos/{vehiculo.id}/ordenes",
            "h": {
                u.rol.value: {"Authorization": "Bearer " + create_access_token(u.id)}
                for u in (admin, recepcion, mecanico)
            },
        }


@pytest.fixture
def api():
    with TestClient(app) as cliente:
        yield cliente


def _historial(api, datos, rol) -> dict[str, dict]:
    r = api.get(datos["url"], headers=datos["h"][rol])
    assert r.status_code == 200, r.text
    return {o["codigo"]: o for o in r.json()}


def test_el_mecanico_ve_su_historial_sin_dinero(api, datos):
    ordenes = _historial(api, datos, "mecanico")
    assert list(ordenes) == ["OT-1"]  # solo sus órdenes
    orden = ordenes["OT-1"]
    assert {c: orden[c] for c in CAMPOS_DINERO} == dict.fromkeys(CAMPOS_DINERO)
    assert orden["pagos"] == []
    assert orden["tiene_pago_duplicado"] is False
    # Los estados de trabajo siguen visibles.
    assert (orden["estado"], orden["pagada"], orden["cobro_estado"]) == (
        "entregado", True, "aprobado",
    )
    assert "sin_dinero" not in orden


@pytest.mark.parametrize("rol", ["administrador", "recepcion"])
def test_administracion_y_recepcion_ven_el_historial_completo(api, datos, rol):
    ordenes = _historial(api, datos, rol)
    assert sorted(ordenes) == ["OT-1", "OT-2"]
    orden = ordenes["OT-1"]
    assert Decimal(str(orden["costo_final"])) == Decimal("62000")
    assert Decimal(str(orden["monto_propuesto"])) == Decimal("62000")
    assert orden["pago_medio"] == "efectivo"
    assert [Decimal(str(p["monto"])) for p in orden["pagos"]] == [Decimal("62000")]
    assert Decimal(str(ordenes["OT-2"]["costo_estimado"])) == Decimal("9000")
