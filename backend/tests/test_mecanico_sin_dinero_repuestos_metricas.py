"""El mecánico no recibe dinero en repuestos, /mecanicos/* ni métricas (MC1b).

Decisión del dueño: el mecánico solo hace sus tareas y avisa qué repuestos usó
de cada stock. En repuestos ve nombre, código y stock, pero no el precio; en
su calendario y en las métricas no aparece ningún dato de dinero. Administración
y recepción siguen viendo los precios.
"""
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.main import app
from app.models import Cliente, Orden, Repuesto, Usuario, Vehiculo
from app.models.usuario import RolUsuario

# Claves que llevan plata en alguna respuesta del backend.
CLAVES_DINERO = {
    "precio", "precio_unitario", "subtotal", "total", "monto", "monto_propuesto",
    "costo", "costo_estimado", "costo_final", "facturado", "ingresos", "egresos",
    "balance", "cobrado", "cobrado_por_medio", "importe",
}


def _claves_de_dinero(valor, ruta="") -> list[str]:
    """Rutas de las claves de dinero con valor (no null) dentro de un JSON."""
    encontradas = []
    if isinstance(valor, dict):
        for clave, hijo in valor.items():
            if clave in CLAVES_DINERO and hijo is not None:
                encontradas.append(f"{ruta}.{clave}")
            encontradas += _claves_de_dinero(hijo, f"{ruta}.{clave}")
    elif isinstance(valor, list):
        for i, hijo in enumerate(valor):
            encontradas += _claves_de_dinero(hijo, f"{ruta}[{i}]")
    return encontradas


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
        cliente = Cliente(nombre="Juan", apellido="Perez", dni="30111222", email="j@x.com")
        db.add_all([admin, recepcion, mecanico, cliente])
        db.flush()
        vehiculo = Vehiculo(cliente_id=cliente.id, patente="ABC123", marca="VW", modelo="Gol")
        repuesto = Repuesto(codigo="ACEITE", nombre="Aceite 5W30", stock=2, stock_minimo=5,
                            precio=Decimal("1500.00"))
        db.add_all([vehiculo, repuesto])
        db.flush()
        db.add(Orden(cliente_id=cliente.id, vehiculo_id=vehiculo.id, creado_por_id=admin.id,
                     mecanico_id=mecanico.id, codigo="OT-1", estado="en_diagnostico",
                     descripcion_ingreso="Service", costo_estimado=Decimal("50000")))
        db.commit()
        return {
            "repuesto_id": repuesto.id,
            "mecanico_id": mecanico.id,
            "h": {
                u.rol.value: {"Authorization": "Bearer " + create_access_token(u.id)}
                for u in (admin, recepcion, mecanico)
            },
        }


@pytest.fixture
def api():
    with TestClient(app) as cliente:
        yield cliente


def _get(api, datos, rol, url):
    r = api.get(url, headers=datos["h"][rol])
    assert r.status_code == 200, r.text
    return r.json()


def _rutas_repuestos(datos) -> list[str]:
    return [
        "/api/v1/repuestos",
        "/api/v1/repuestos?solo_activos=true&q=aceite",
        "/api/v1/repuestos/stock-bajo",
        f"/api/v1/repuestos/{datos['repuesto_id']}",
    ]


# --- Repuestos -------------------------------------------------------------------


def test_mecanico_ve_nombre_codigo_y_stock_pero_no_el_precio(api, datos):
    for url in _rutas_repuestos(datos):
        cuerpo = _get(api, datos, "mecanico", url)
        repuestos = cuerpo if isinstance(cuerpo, list) else [cuerpo]
        assert repuestos, url
        for repuesto in repuestos:
            assert repuesto.get("precio") is None, url
            assert (repuesto["codigo"], repuesto["nombre"], repuesto["stock"]) == (
                "ACEITE", "Aceite 5W30", 2,
            ), url
            assert repuesto["stock_bajo"] is True, url


@pytest.mark.parametrize("rol", ["administrador", "recepcion"])
def test_administracion_y_recepcion_siguen_viendo_el_precio(api, datos, rol):
    for url in _rutas_repuestos(datos):
        cuerpo = _get(api, datos, rol, url)
        repuestos = cuerpo if isinstance(cuerpo, list) else [cuerpo]
        assert [Decimal(str(r["precio"])) for r in repuestos] == [Decimal("1500.00")], url


def test_el_mecanico_sigue_sin_poder_cambiar_repuestos(api, datos):
    h = datos["h"]["mecanico"]
    url = f"/api/v1/repuestos/{datos['repuesto_id']}"
    assert api.put(url, headers=h, json={"precio": "1"}).status_code == 403
    assert api.post(f"{url}/ingresos", headers=h, json={"cantidad": 1}).status_code == 403


# --- /mecanicos/* ----------------------------------------------------------------


def test_calendario_y_horarios_del_mecanico_sin_dinero(api, datos):
    base = f"/api/v1/mecanicos/{datos['mecanico_id']}"
    calendario = _get(api, datos, "mecanico", f"{base}/calendario")
    assert [o["codigo"] for o in calendario["ordenes"]] == ["OT-1"]
    assert _claves_de_dinero(calendario) == []
    assert _claves_de_dinero(_get(api, datos, "mecanico", f"{base}/horarios")) == []


# --- Métricas --------------------------------------------------------------------


@pytest.mark.parametrize(
    "url",
    ["/api/v1/metricas/mecanicos", "/api/v1/metricas/finanzas", "/api/v1/metricas/mejor-mecanico"],
)
def test_el_mecanico_no_recibe_metricas_con_dinero(api, datos, url):
    r = api.get(url, headers=datos["h"]["mecanico"])
    assert r.status_code == 403
    assert _claves_de_dinero(r.json()) == []
