"""Filtros por fecha en días argentinos (America/Argentina/Buenos_Aires, UTC-3).

Los timestamps se guardan en UTC, pero quien filtra "del 20 al 20" piensa en el
día argentino: lo que pasó a las 22:30 del 20 en Argentina (01:30 UTC del 21)
es del 20. Cubre /plataforma/encuestas y /metricas/finanzas y /metricas/mecanicos.
"""
from datetime import date, datetime, timezone
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

from app.api.v1.metricas.service import _limites
from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.main import app
from app.models import Cliente, EncuestaDemo, Orden, Pago, Taller, Usuario, Vehiculo
from app.models.usuario import RolUsuario

PLATAFORMA_ENCUESTAS = "/api/v1/plataforma/encuestas"
FINANZAS = "/api/v1/metricas/finanzas"
MECANICOS = "/api/v1/metricas/mecanicos"

# 2026-01-31 23:30 en Argentina = 2026-02-01 02:30 UTC (naive UTC, como se guarda).
FIN_DE_ENERO_ART = datetime(2026, 2, 1, 2, 30)


def _usuario(nombre, email, rol, taller_id=None):
    return Usuario(
        nombre=nombre, apellido="Prueba", email=email,
        password_hash=hash_password("x"), rol=rol, taller_id=taller_id,
    )


@pytest.fixture
def api():
    with TestClient(app) as cliente:
        yield cliente


@pytest.fixture
def datos():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        superadmin = _usuario("Super", "sa@x.com", RolUsuario.superadmin)
        admin = _usuario("Admin", "admin@x.com", RolUsuario.administrador)
        mecanico = _usuario("Mec", "mec@x.com", RolUsuario.mecanico)
        db.add_all([superadmin, admin, mecanico])
        db.flush()

        # Encuesta del taller 1 creada el 2026-11-20 22:30 ART (01:30 UTC del 21).
        db.add(EncuestaDemo(
            taller_id=db.get(Taller, 1).id, respondida_por_id=admin.id,
            puntaje=4, intencion="tal_vez",
            creado_en=datetime(2026, 11, 21, 1, 30, tzinfo=timezone.utc),
        ))

        cliente = Cliente(nombre="Juan", apellido="Perez", dni="30111222")
        db.add(cliente)
        db.flush()
        vehiculo = Vehiculo(cliente_id=cliente.id, patente="ABC123", marca="VW", modelo="Gol")
        db.add(vehiculo)
        db.flush()
        orden = Orden(
            cliente_id=cliente.id, vehiculo_id=vehiculo.id, creado_por_id=admin.id,
            mecanico_id=mecanico.id, codigo="OT-1", estado="entregado",
            descripcion_ingreso="Service", costo_final=Decimal("1000.00"),
            fecha_ingreso=datetime(2026, 1, 31, 20, 0), fecha_entrega=FIN_DE_ENERO_ART,
        )
        db.add(orden)
        db.flush()
        db.add(Pago(
            orden_id=orden.id, monto=Decimal("1000.00"), estado="aprobado",
            medio="efectivo", fecha_pago=FIN_DE_ENERO_ART,
        ))
        db.commit()
        return {
            "hs": {"Authorization": "Bearer " + create_access_token(superadmin.id)},
            "ha": {"Authorization": "Bearer " + create_access_token(admin.id)},
            "mecanico_id": mecanico.id,
        }


# --- /plataforma/encuestas ------------------------------------------------------


def test_encuesta_se_filtra_por_el_dia_argentino(api, datos):
    r = api.get(PLATAFORMA_ENCUESTAS, headers=datos["hs"],
                params={"desde": "2026-11-20", "hasta": "2026-11-20"})
    assert r.status_code == 200, r.text
    assert len(r.json()) == 1
    assert r.headers["X-Total-Count"] == "1"

    r = api.get(PLATAFORMA_ENCUESTAS, headers=datos["hs"],
                params={"desde": "2026-11-21", "hasta": "2026-11-21"})
    assert r.json() == []
    assert r.headers["X-Total-Count"] == "0"


def test_encuesta_limites_abiertos_en_dias_argentinos(api, datos):
    # Solo "hasta" el 20 la incluye; solo "desde" el 21 la deja afuera.
    r = api.get(PLATAFORMA_ENCUESTAS, headers=datos["hs"], params={"hasta": "2026-11-20"})
    assert len(r.json()) == 1
    r = api.get(PLATAFORMA_ENCUESTAS, headers=datos["hs"], params={"desde": "2026-11-21"})
    assert r.json() == []


# --- /metricas ------------------------------------------------------------------


def test_limites_son_dias_argentinos_en_utc():
    inicio, fin = _limites(date(2026, 1, 31), date(2026, 1, 31))
    assert inicio == datetime(2026, 1, 31, 3, 0)
    assert fin == datetime(2026, 2, 1, 3, 0)


def test_pago_y_entrega_a_las_2330_cuentan_en_enero(api, datos):
    r = api.get(FINANZAS, headers=datos["ha"],
                params={"desde": "2026-01-01", "hasta": "2026-02-28"})
    assert r.status_code == 200, r.text
    data = r.json()
    enero, febrero = data["mensual"]
    assert enero["mes"] == "2026-01"
    assert enero["ingresos"] == "1000.00"
    assert febrero["ingresos"] == "0.00"

    r = api.get(FINANZAS, headers=datos["ha"],
                params={"desde": "2026-01-01", "hasta": "2026-01-31"})
    assert r.json()["cobrado"] == "1000.00"
    assert r.json()["ingresos"] == "1000.00"

    r = api.get(FINANZAS, headers=datos["ha"],
                params={"desde": "2026-02-01", "hasta": "2026-02-28"})
    assert r.json()["cobrado"] == "0.00"
    assert r.json()["ingresos"] == "0.00"


def test_pago_y_entrega_a_las_2330_cuentan_el_31_en_el_diario(api, datos):
    r = api.get(FINANZAS, headers=datos["ha"],
                params={"desde": "2026-01-31", "hasta": "2026-02-01", "agrupar": "dia"})
    assert r.status_code == 200, r.text
    por_fecha = {d["fecha"]: d["ingresos"] for d in r.json()["diario"]}
    assert por_fecha == {"2026-01-31": "1000.00", "2026-02-01": "0.00"}

    r = api.get(FINANZAS, headers=datos["ha"],
                params={"desde": "2026-01-31", "hasta": "2026-01-31", "agrupar": "dia"})
    assert r.json()["cobrado"] == "1000.00"
    assert r.json()["diario"] == [{"fecha": "2026-01-31", "ingresos": "1000.00"}]


def test_mecanicos_cuentan_la_entrega_en_el_dia_argentino(api, datos):
    r = api.get(MECANICOS, headers=datos["ha"],
                params={"desde": "2026-01-31", "hasta": "2026-01-31"})
    assert r.status_code == 200, r.text
    (fila,) = r.json()
    assert fila["mecanico_id"] == datos["mecanico_id"]
    assert fila["ordenes_cerradas"] == 1

    r = api.get(MECANICOS, headers=datos["ha"],
                params={"desde": "2026-02-01", "hasta": "2026-02-01"})
    assert r.json()[0]["ordenes_cerradas"] == 0
