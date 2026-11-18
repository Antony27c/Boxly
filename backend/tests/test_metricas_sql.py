"""Métricas calculadas con agregaciones SQL (GROUP BY / COUNT / SUM / AVG).

Compara los endpoints contra datos sembrados con valores conocidos.
"""

from datetime import datetime
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.main import app
from app.models import (
    Cliente,
    DetalleOrden,
    Orden,
    Pago,
    Repuesto,
    Usuario,
    Vehiculo,
)
from app.models.usuario import RolUsuario


def _dt(anio, mes, dia, hora=0, minuto=0):
    return datetime(anio, mes, dia, hora, minuto)


@pytest.fixture
def datos():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        admin = Usuario(
            nombre="Admin", apellido="Taller", email="admin@x.com",
            password_hash=hash_password("x"), rol=RolUsuario.administrador,
        )
        mec_a = Usuario(
            nombre="Ana", apellido="Mecanica", email="ana@x.com",
            password_hash=hash_password("x"), rol=RolUsuario.mecanico,
        )
        mec_b = Usuario(
            nombre="Beto", apellido="Mecanico", email="beto@x.com",
            password_hash=hash_password("x"), rol=RolUsuario.mecanico,
        )
        mec_inactivo = Usuario(
            nombre="Inac", apellido="Mecanico", email="inac@x.com",
            password_hash=hash_password("x"), rol=RolUsuario.mecanico,
            activo=False,
        )
        db.add_all([admin, mec_a, mec_b, mec_inactivo])
        db.flush()

        cliente = Cliente(nombre="Juan", apellido="Perez", dni="30111222")
        db.add(cliente)
        db.flush()
        vehiculo = Vehiculo(
            cliente_id=cliente.id, patente="ABC123", marca="VW", modelo="Gol"
        )
        rep_a = Repuesto(
            codigo="FILTRO", nombre="Filtro aceite",
            stock=10, stock_minimo=1, precio=Decimal("50.00"),
        )
        rep_b = Repuesto(
            codigo="PASTILLA", nombre="Pastillas",
            stock=10, stock_minimo=1, precio=Decimal("20.00"),
        )
        db.add_all([vehiculo, rep_a, rep_b])
        db.flush()

        def orden(codigo, estado, ingreso, entrega, costo, mecanico):
            o = Orden(
                cliente_id=cliente.id,
                vehiculo_id=vehiculo.id,
                creado_por_id=admin.id,
                mecanico_id=mecanico.id if mecanico else None,
                codigo=codigo,
                estado=estado,
                descripcion_ingreso="Trabajo " + codigo,
                costo_final=costo,
                fecha_ingreso=ingreso,
                fecha_entrega=entrega,
            )
            db.add(o)
            db.flush()
            return o

        # Mecánico A: dos entregadas en enero (12 h c/u) y una en febrero (4 h).
        o1 = orden("OT-1", "entregado", _dt(2026, 1, 10, 8), _dt(2026, 1, 10, 20), Decimal("1000.00"), mec_a)
        o2 = orden("OT-2", "entregado", _dt(2026, 1, 11, 8), _dt(2026, 1, 11, 20), Decimal("2000.00"), mec_a)
        o7 = orden("OT-7", "entregado", _dt(2026, 2, 10, 8), _dt(2026, 2, 10, 12), Decimal("900.00"), mec_a)

        # Mecánico B: una entregada (4 h), una en curso y una cancelada.
        o3 = orden("OT-3", "entregado", _dt(2026, 1, 15, 8), _dt(2026, 1, 15, 12), Decimal("500.00"), mec_b)
        o4 = orden("OT-4", "listo", _dt(2026, 1, 16, 8), None, None, mec_b)
        o5 = orden("OT-5", "cancelado", _dt(2026, 1, 17, 8), None, None, mec_b)

        # Entregada sin mecánico: suma a finanzas pero no a métricas por mecánico.
        o6 = orden("OT-6", "entregado", _dt(2026, 1, 20, 8), _dt(2026, 1, 20, 12), Decimal("700.00"), None)

        # Líneas de repuestos: egresos por mes de la orden (mano de obra y
        # órdenes no entregadas quedan afuera).
        db.add_all([
            DetalleOrden(orden_id=o1.id, repuesto_id=rep_a.id, descripcion="Filtro", cantidad=2, precio_unitario=Decimal("100.00")),
            DetalleOrden(orden_id=o1.id, repuesto_id=None, descripcion="Mano de obra", cantidad=1, precio_unitario=Decimal("999.00")),
            DetalleOrden(orden_id=o2.id, repuesto_id=rep_a.id, descripcion="Filtro", cantidad=1, precio_unitario=Decimal("50.00")),
            DetalleOrden(orden_id=o3.id, repuesto_id=rep_b.id, descripcion="Pastillas", cantidad=4, precio_unitario=Decimal("25.00")),
            DetalleOrden(orden_id=o6.id, repuesto_id=rep_b.id, descripcion="Pastillas", cantidad=3, precio_unitario=Decimal("10.00")),
            DetalleOrden(orden_id=o7.id, repuesto_id=rep_a.id, descripcion="Filtro", cantidad=5, precio_unitario=Decimal("20.00")),
            DetalleOrden(orden_id=o4.id, repuesto_id=rep_b.id, descripcion="No cuenta", cantidad=10, precio_unitario=Decimal("999.00")),
        ])

        # Pagos: aprobados dentro/fuera de rango y uno pendiente.
        db.add_all([
            Pago(orden_id=o1.id, monto=Decimal("800.00"), estado="aprobado", fecha_pago=_dt(2026, 1, 12, 10)),
            Pago(orden_id=o2.id, monto=Decimal("2000.00"), estado="aprobado", fecha_pago=_dt(2026, 1, 13, 10)),
            Pago(orden_id=o1.id, monto=Decimal("50.00"), estado="pendiente", fecha_pago=_dt(2026, 1, 12, 11)),
            Pago(orden_id=o2.id, monto=Decimal("9999.00"), estado="aprobado", fecha_pago=_dt(2025, 12, 31, 10)),
        ])
        db.commit()
        return {
            "h": {"Authorization": "Bearer " + create_access_token(admin.id)},
            "mec_a": mec_a.id,
            "mec_b": mec_b.id,
            "mec_inactivo": mec_inactivo.id,
        }


@pytest.fixture
def api():
    with TestClient(app) as cliente:
        yield cliente


def test_metricas_mecanicos_contra_datos_sembrados(api, datos):
    r = api.get(
        "/api/v1/metricas/mecanicos", headers=datos["h"],
        params={"desde": "2026-01-01", "hasta": "2026-01-31"},
    )
    assert r.status_code == 200
    por_id = {m["mecanico_id"]: m for m in r.json()}

    a = por_id[datos["mec_a"]]
    assert a["nombre"] == "Mecanica, Ana"
    assert a["ordenes_cerradas"] == 2
    assert a["ordenes_en_curso"] == 0
    assert a["tiempo_promedio_horas"] == 12.0
    assert a["facturado"] == "3000.00"

    b = por_id[datos["mec_b"]]
    assert b["ordenes_cerradas"] == 1
    assert b["ordenes_en_curso"] == 1
    assert b["tiempo_promedio_horas"] == 4.0
    assert b["facturado"] == "500.00"

    # Ni el mecánico inactivo ni la orden sin mecánico generan fila propia.
    assert datos["mec_inactivo"] not in por_id
    assert len(por_id) == 2


def test_finanzas_contra_datos_sembrados(api, datos):
    r = api.get(
        "/api/v1/metricas/finanzas", headers=datos["h"],
        params={"desde": "2026-01-01", "hasta": "2026-02-28"},
    )
    assert r.status_code == 200
    data = r.json()

    assert data["ingresos"] == "5100.00"        # 1000+2000+500+700+900
    assert data["cobrado_online"] == "2800.00"   # 800+2000 aprobados en rango
    assert data["egresos_repuestos"] == "480.00"  # 380 enero + 100 febrero
    assert data["balance"] == "4620.00"

    assert [m["mes"] for m in data["mensual"]] == ["2026-01", "2026-02"]
    enero, febrero = data["mensual"]
    assert enero["ingresos"] == "4200.00"
    assert enero["egresos"] == "380.00"
    assert enero["balance"] == "3820.00"
    assert febrero["ingresos"] == "900.00"
    assert febrero["egresos"] == "100.00"
    assert febrero["balance"] == "800.00"
    assert data["diario"] == []


def test_finanzas_diario_un_elemento_por_dia(api, datos):
    r = api.get(
        "/api/v1/metricas/finanzas", headers=datos["h"],
        params={"desde": "2026-01-01", "hasta": "2026-01-31", "agrupar": "dia"},
    )
    assert r.status_code == 200
    data = r.json()

    # Un elemento por cada día del rango, en orden, con ceros los días vacíos.
    assert len(data["diario"]) == 31
    assert data["diario"][0]["fecha"] == "2026-01-01"
    assert data["diario"][-1]["fecha"] == "2026-01-31"
    por_fecha = {d["fecha"]: d["ingresos"] for d in data["diario"]}
    assert por_fecha["2026-01-01"] == "0.00"
    assert por_fecha["2026-01-10"] == "1000.00"
    assert por_fecha["2026-01-11"] == "2000.00"
    assert por_fecha["2026-01-15"] == "500.00"
    assert por_fecha["2026-01-20"] == "700.00"
    assert por_fecha["2026-01-31"] == "0.00"

    # La suma del diario es igual al total de ingresos, misma definición que mensual.
    assert sum(Decimal(d["ingresos"]) for d in data["diario"]) == Decimal(data["ingresos"])
    assert data["ingresos"] == "4200.00"
    assert [m["mes"] for m in data["mensual"]] == ["2026-01"]


def test_finanzas_diario_cubre_rango_con_varios_meses(api, datos):
    r = api.get(
        "/api/v1/metricas/finanzas", headers=datos["h"],
        params={"desde": "2026-01-01", "hasta": "2026-02-28", "agrupar": "dia"},
    )
    assert r.status_code == 200
    data = r.json()

    assert len(data["diario"]) == 59  # 31 de enero + 28 de febrero
    por_fecha = {d["fecha"]: d["ingresos"] for d in data["diario"]}
    assert por_fecha["2026-02-10"] == "900.00"
    assert por_fecha["2026-02-11"] == "0.00"
    assert data["diario"][-1]["fecha"] == "2026-02-28"
    suma_diario = sum(Decimal(d["ingresos"]) for d in data["diario"])
    assert suma_diario == Decimal(data["ingresos"]) == Decimal("5100.00")


def test_finanzas_agrupar_invalido_devuelve_422(api, datos):
    r = api.get(
        "/api/v1/metricas/finanzas", headers=datos["h"],
        params={"desde": "2026-01-01", "hasta": "2026-01-31", "agrupar": "semana"},
    )
    assert r.status_code == 422


def test_finanzas_diario_rango_mayor_92_dias_422(api, datos):
    r = api.get(
        "/api/v1/metricas/finanzas", headers=datos["h"],
        params={"desde": "2026-01-01", "hasta": "2026-04-03", "agrupar": "dia"},
    )
    assert r.status_code == 422
    assert "92" in r.json()["detail"]

    # Exactamente 92 días inclusive sí está permitido.
    r = api.get(
        "/api/v1/metricas/finanzas", headers=datos["h"],
        params={"desde": "2026-01-01", "hasta": "2026-04-02", "agrupar": "dia"},
    )
    assert r.status_code == 200
    assert len(r.json()["diario"]) == 92


def test_finanzas_sin_agrupar_o_mes_diario_vacio(api, datos):
    for params in (
        {"desde": "2026-01-01", "hasta": "2026-02-28"},
        {"desde": "2026-01-01", "hasta": "2026-02-28", "agrupar": "mes"},
    ):
        r = api.get("/api/v1/metricas/finanzas", headers=datos["h"], params=params)
        assert r.status_code == 200
        data = r.json()
        assert data["diario"] == []
        assert data["ingresos"] == "5100.00"
        assert [m["mes"] for m in data["mensual"]] == ["2026-01", "2026-02"]


def test_finanzas_diario_no_admin_403(api, datos):
    h = {"Authorization": "Bearer " + create_access_token(datos["mec_a"])}
    r = api.get(
        "/api/v1/metricas/finanzas", headers=h,
        params={"desde": "2026-01-01", "hasta": "2026-01-31", "agrupar": "dia"},
    )
    assert r.status_code == 403


def test_mejor_mecanico_ordena_por_cerradas(api, datos):
    r = api.get(
        "/api/v1/metricas/mejor-mecanico", headers=datos["h"],
        params={"trimestre": "2026-Q1"},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["trimestre"] == "2026-Q1"
    assert data["mecanico"]["mecanico_id"] == datos["mec_a"]
    assert data["mecanico"]["ordenes_cerradas"] == 3  # OT-1, OT-2, OT-7
    assert data["mecanico"]["facturado"] == "3900.00"  # 1000+2000+900
    assert data["mecanico"]["tiempo_promedio_horas"] == 9.3  # (12+12+4)/3
