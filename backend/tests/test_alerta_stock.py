"""Aviso interno de stock mínimo (docs/Oferta.md 4b, tarea W3).

Cuando un movimiento de stock deja un repuesto en `stock <= stock_minimo` se
crea una NotificacionInterna para administración y recepción del taller, una
sola vez por cruce del umbral; se rearma cuando el stock vuelve a superarlo.
"""
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine, fijar_taller
from app.main import app
from app.models import Cliente, Orden, Repuesto, Taller, Usuario, Vehiculo
from app.models.notificacion import NotificacionInterna
from app.models.usuario import RolUsuario


@pytest.fixture
def datos():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        pw = hash_password("x")
        admin = Usuario(
            nombre="Admin", apellido="Taller", email="admin@x.com",
            password_hash=pw, rol=RolUsuario.administrador,
        )
        recepcion = Usuario(
            nombre="Recepcion", apellido="Taller", email="recep@x.com",
            password_hash=pw, rol=RolUsuario.recepcion,
        )
        mecanico = Usuario(
            nombre="Mecanico", apellido="Taller", email="mec@x.com",
            password_hash=pw, rol=RolUsuario.mecanico,
        )
        cliente = Cliente(nombre="Juan", apellido="Perez", dni="30111222", email="j@x.com")
        db.add_all([admin, recepcion, mecanico, cliente])
        db.flush()
        vehiculo = Vehiculo(cliente_id=cliente.id, patente="ABC123", marca="VW", modelo="Gol")
        # stock 6, mínimo 5: entran y salen del umbral con movimientos chicos.
        repuesto = Repuesto(
            codigo="ACEITE5W30", nombre="Aceite 5W30", stock=6, stock_minimo=5,
            precio=Decimal("1500.00"),
        )
        db.add_all([vehiculo, repuesto])
        db.flush()
        orden = Orden(
            cliente_id=cliente.id, vehiculo_id=vehiculo.id, creado_por_id=admin.id,
            codigo="OT-AVISO-1", estado="pendiente",
            descripcion_ingreso="Cambio de aceite",
        )
        db.add(orden)
        db.commit()
        return {
            "h": {"Authorization": "Bearer " + create_access_token(admin.id)},
            "hr": {"Authorization": "Bearer " + create_access_token(recepcion.id)},
            "hm": {"Authorization": "Bearer " + create_access_token(mecanico.id)},
            "orden": orden.id,
            "vehiculo": vehiculo.id,
            "repuesto": repuesto.id,
        }


@pytest.fixture
def api():
    with TestClient(app) as cliente:
        yield cliente


def _avisos(taller_id: int = 1) -> list[NotificacionInterna]:
    with SessionLocal() as db:
        fijar_taller(db, taller_id)
        return list(
            db.scalars(select(NotificacionInterna).order_by(NotificacionInterna.id)).all()
        )


def _agregar(api, datos, cantidad):
    return api.post(
        f"/api/v1/ordenes/{datos['orden']}/detalles",
        headers=datos["h"],
        json={"repuesto_id": datos["repuesto"], "cantidad": cantidad},
    )


def test_cruce_de_umbral_crea_un_solo_aviso(api, datos):
    r = _agregar(api, datos, 2)  # stock 6 -> 4, mínimo 5
    assert r.status_code == 201
    avisos = _avisos()
    assert len(avisos) == 1
    aviso = avisos[0]
    assert aviso.tipo == "stock_bajo"
    assert aviso.taller_id == 1
    assert aviso.repuesto_id == datos["repuesto"]
    assert "ACEITE5W30" in aviso.mensaje and "quedó en 4" in aviso.mensaje
    assert "mínimo 5" in aviso.mensaje


def test_admin_y_recepcion_ven_el_aviso(api, datos):
    _agregar(api, datos, 2)
    for headers in (datos["h"], datos["hr"]):
        r = api.get("/api/v1/repuestos/avisos", headers=headers)
        assert r.status_code == 200
        assert len(r.json()) == 1
        assert r.json()[0]["mensaje"].startswith("Stock bajo:")
        assert r.json()[0]["leida_en"] is None


def test_no_repite_mientras_siga_bajo(api, datos):
    _agregar(api, datos, 2)  # 4: aviso
    _agregar(api, datos, 1)  # 3: sigue bajo, no hay nuevo aviso
    assert len(_avisos()) == 1


def test_ingreso_rearma_y_el_proximo_cruce_avisa(api, datos):
    _agregar(api, datos, 2)  # 4: aviso 1
    r = api.post(
        f"/api/v1/repuestos/{datos['repuesto']}/ingresos",
        headers=datos["h"], json={"cantidad": 5},
    )
    assert r.status_code == 200  # stock 9: rearma
    _agregar(api, datos, 4)  # 5: cruza de nuevo (5 <= 5)
    assert len(_avisos()) == 2


def test_quitar_linea_devuelve_stock_y_rearma(api, datos):
    detalle = _agregar(api, datos, 2).json()  # 4: aviso 1
    r = api.delete(
        f"/api/v1/ordenes/{datos['orden']}/detalles/{detalle['id']}",
        headers=datos["h"],
    )
    assert r.status_code == 200  # 6: rearma
    _agregar(api, datos, 2)  # 4: aviso 2
    assert len(_avisos()) == 2


def test_ajuste_de_stock_por_put_dispara_y_rearma(api, datos):
    r = api.put(
        f"/api/v1/repuestos/{datos['repuesto']}",
        headers=datos["h"], json={"stock": 4},
    )
    assert r.status_code == 200
    assert len(_avisos()) == 1
    r = api.put(
        f"/api/v1/repuestos/{datos['repuesto']}",
        headers=datos["h"], json={"stock": 9},
    )
    assert r.status_code == 200
    r = api.put(
        f"/api/v1/repuestos/{datos['repuesto']}",
        headers=datos["h"], json={"stock": 4},
    )
    assert r.status_code == 200
    assert len(_avisos()) == 2


def test_creado_ya_bajo_no_avisa_hasta_recuperar(api, datos):
    r = api.post(
        "/api/v1/repuestos", headers=datos["h"],
        json={"codigo": "FILTRO-AIR", "nombre": "Filtro de aire", "stock": 2,
              "stock_minimo": 5, "precio": "800.00"},
    )
    assert r.status_code == 201
    assert _avisos() == []
    repuesto_id = r.json()["id"]
    # Un descuento con el stock ya bajo no es un cruce: no avisa.
    orden = api.post(
        "/api/v1/ordenes", headers=datos["h"],
        json={"vehiculo_id": datos["vehiculo"], "descripcion_ingreso": "Service"},
    )
    assert orden.status_code == 201
    detalle = api.post(
        f"/api/v1/ordenes/{orden.json()['id']}/detalles",
        headers=datos["h"],
        json={"repuesto_id": repuesto_id, "cantidad": 1},
    )
    assert detalle.status_code == 201
    assert _avisos() == []
    # Al superar el mínimo y volver a cruzarlo, ahí sí avisa.
    api.post(
        f"/api/v1/repuestos/{repuesto_id}/ingresos",
        headers=datos["h"], json={"cantidad": 5},
    )
    api.post(
        f"/api/v1/ordenes/{orden.json()['id']}/detalles",
        headers=datos["h"],
        json={"repuesto_id": repuesto_id, "cantidad": 2},
    )
    avisos = _avisos()
    assert len(avisos) == 1
    assert avisos[0].repuesto_id == repuesto_id


def test_avisos_no_se_mezclan_entre_talleres(api, datos):
    with SessionLocal() as db:
        taller_b = Taller(nombre="TallerBravo", estado="activo")
        db.add(taller_b)
        db.flush()
        admin_b = Usuario(
            nombre="AdminB", apellido="Taller", email="admin.b@x.com",
            password_hash=hash_password("x"), rol=RolUsuario.administrador,
            taller_id=taller_b.id,
        )
        repuesto_b = Repuesto(
            codigo="REP-B-1", nombre="RepuestoB", stock=6, stock_minimo=5,
            precio=Decimal("100.00"), taller_id=taller_b.id,
        )
        db.add_all([admin_b, repuesto_b])
        db.commit()
        taller_b_id, repuesto_b_id = taller_b.id, repuesto_b.id
        token_b = create_access_token(admin_b.id)

    hb = {"Authorization": f"Bearer {token_b}"}
    r = api.put(
        f"/api/v1/repuestos/{repuesto_b_id}", headers=hb, json={"stock": 4},
    )
    assert r.status_code == 200
    # El taller A no ve el aviso de B; el taller B sí, y solo el suyo.
    r = api.get("/api/v1/repuestos/avisos", headers=datos["h"])
    assert r.status_code == 200
    assert r.json() == []
    r = api.get("/api/v1/repuestos/avisos", headers=hb)
    assert r.status_code == 200
    assert len(r.json()) == 1
    assert "RepuestoB" in r.json()[0]["mensaje"]
    avisos_b = _avisos(taller_b_id)
    assert len(avisos_b) == 1 and avisos_b[0].taller_id == taller_b_id


def test_mecanico_no_ve_avisos(api, datos):
    _agregar(api, datos, 2)
    r = api.get("/api/v1/repuestos/avisos", headers=datos["hm"])
    assert r.status_code == 403


def test_marcar_aviso_leido_y_filtro(api, datos):
    _agregar(api, datos, 2)
    aviso = _avisos()[0]
    r = api.post(f"/api/v1/repuestos/avisos/{aviso.id}/leer", headers=datos["h"])
    assert r.status_code == 200
    assert _avisos()[0].leida_en is not None
    r = api.get("/api/v1/repuestos/avisos?solo_no_leidas=true", headers=datos["h"])
    assert r.json() == []
    r = api.get("/api/v1/repuestos/avisos", headers=datos["h"])
    assert len(r.json()) == 1 and r.json()[0]["leida_en"] is not None


def test_stock_minimo_cero_no_avisa(api, datos):
    with SessionLocal() as db:
        rep = db.get(Repuesto, datos["repuesto"])
        rep.stock_minimo = 0
        db.commit()
    _agregar(api, datos, 6)  # stock 0, mínimo 0: sin umbral configurado
    assert _avisos() == []
