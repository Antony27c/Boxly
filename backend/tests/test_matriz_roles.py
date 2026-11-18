import pytest
from fastapi.testclient import TestClient

from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models import Cliente, Orden, Repuesto, Usuario, Vehiculo
from app.models.usuario import RolUsuario
from app.main import app

ROLES = ["administrador", "recepcion", "mecanico", "cliente", "sin_token"]

# Esperados por rol en el orden de ROLES: admin, recepcion, mecanico, cliente, sin token.
def _esp(admin, recepcion, mecanico, cliente, sin_token):
    return {
        "administrador": admin,
        "recepcion": recepcion,
        "mecanico": mecanico,
        "cliente": cliente,
        "sin_token": sin_token,
    }


@pytest.fixture
def datos():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        usuarios = {
            "administrador": Usuario(nombre="Admin", apellido="Taller", email="admin@x.com",
                                     password_hash=hash_password("x"), rol=RolUsuario.administrador),
            "recepcion": Usuario(nombre="Recep", apellido="Taller", email="recep@x.com",
                                 password_hash=hash_password("x"), rol=RolUsuario.recepcion),
            "mecanico": Usuario(nombre="Mec", apellido="Uno", email="mec1@x.com",
                                password_hash=hash_password("x"), rol=RolUsuario.mecanico),
            "otro_mecanico": Usuario(nombre="Mec", apellido="Dos", email="mec2@x.com",
                                     password_hash=hash_password("x"), rol=RolUsuario.mecanico),
        }
        cliente = Cliente(nombre="Juan", apellido="Perez", dni="10000001", email="juan@x.com")
        db.add_all([*usuarios.values(), cliente])
        db.flush()
        cuenta_cliente = Usuario(nombre="Juan", apellido="Perez", email="cuenta@x.com",
                                 password_hash=hash_password("x"), rol=RolUsuario.cliente,
                                 cliente_id=cliente.id)
        db.add(cuenta_cliente)
        vehiculo = Vehiculo(cliente_id=cliente.id, patente="AAA111", marca="VW", modelo="Gol")
        repuesto = Repuesto(codigo="ACE-01", nombre="Aceite motor", stock=10,
                            stock_minimo=2, precio=150)
        db.add_all([vehiculo, repuesto])
        db.flush()
        orden = Orden(cliente_id=cliente.id, vehiculo_id=vehiculo.id,
                      creado_por_id=usuarios["administrador"].id,
                      mecanico_id=usuarios["mecanico"].id,
                      codigo="OT-1001", estado="pendiente",
                      descripcion_ingreso="Cambio de aceite y filtros")
        db.add(orden)
        db.commit()
        ids = {"vehiculo_id": vehiculo.id, "orden_id": orden.id,
               "repuesto_id": repuesto.id, "cliente_id": cliente.id,
               "mecanico_id": usuarios["mecanico"].id,
               "otro_mecanico_id": usuarios["otro_mecanico"].id}
        headers = {rol: {"Authorization": "Bearer " + create_access_token(u.id)}
                   for rol, u in usuarios.items()}
        headers["cliente"] = {"Authorization": "Bearer " + create_access_token(cuenta_cliente.id)}
        return {"headers": headers, "ids": ids}


@pytest.fixture
def api():
    with TestClient(app) as cliente:
        yield cliente


def _resolver(valor, ids):
    """Reemplaza "{clave}" por el id numérico correspondiente."""
    if isinstance(valor, str) and valor.startswith("{") and valor.endswith("}"):
        return ids[valor[1:-1]]
    if isinstance(valor, dict):
        return {k: _resolver(v, ids) for k, v in valor.items()}
    if isinstance(valor, list):
        return [_resolver(v, ids) for v in valor]
    return valor


# (metodo, ruta, cuerpo, esperados). Las rutas/cuerpos usan {vehiculo_id}, {orden_id},
# {repuesto_id}, {cliente_id} y {mecanico_id} que se resuelven con los ids del fixture.
CASOS = [
    # --- vehiculos ---
    ("GET", "/api/v1/vehiculos", None,
     _esp(200, 200, 200, 403, 401)),
    ("GET", "/api/v1/vehiculos/{vehiculo_id}", None,
     _esp(200, 200, 200, 403, 401)),
    ("POST", "/api/v1/vehiculos",
     {"cliente_id": "{cliente_id}", "patente": "ZZZ999", "marca": "Fiat", "modelo": "Uno"},
     _esp(201, 201, 403, 403, 401)),
    ("PUT", "/api/v1/vehiculos/{vehiculo_id}", {"color": "Rojo"},
     _esp(200, 200, 403, 403, 401)),
    # --- repuestos ---
    ("GET", "/api/v1/repuestos", None,
     _esp(200, 200, 200, 403, 401)),
    ("GET", "/api/v1/repuestos/stock-bajo", None,
     _esp(200, 200, 200, 403, 401)),
    ("GET", "/api/v1/repuestos/{repuesto_id}", None,
     _esp(200, 200, 200, 403, 401)),
    ("POST", "/api/v1/repuestos",
     {"codigo": "FIL-01", "nombre": "Filtro aceite", "precio": 80, "stock": 5},
     _esp(201, 201, 403, 403, 401)),
    ("PUT", "/api/v1/repuestos/{repuesto_id}", {"nombre": "Aceite nuevo"},
     _esp(200, 200, 403, 403, 401)),
    # --- ordenes ---
    ("GET", "/api/v1/ordenes", None,
     _esp(200, 200, 200, 403, 401)),
    ("POST", "/api/v1/ordenes",
     {"vehiculo_id": "{vehiculo_id}", "descripcion_ingreso": "Cambio de pastillas"},
     _esp(201, 201, 403, 403, 401)),
    ("GET", "/api/v1/ordenes/estados", None,
     _esp(200, 200, 200, 200, 401)),
    ("GET", "/api/v1/ordenes/{orden_id}", None,
     _esp(200, 200, 200, 403, 401)),
    ("PATCH", "/api/v1/ordenes/{orden_id}", {"diagnostico": "Freno gastado"},
     _esp(200, 200, 200, 403, 401)),
    ("DELETE", "/api/v1/ordenes/{orden_id}", None,
     _esp(200, 200, 403, 403, 401)),
    ("POST", "/api/v1/ordenes/{orden_id}/notificaciones", None,
     _esp(201, 403, 403, 403, 401)),
    # --- users ---
    ("GET", "/api/v1/users", None,
     _esp(200, 403, 403, 403, 401)),
    ("POST", "/api/v1/users",
     {"nombre": "Nuevo", "apellido": "User", "email": "nuevo@x.com",
      "password": "Clave1234", "rol": "recepcion"},
     _esp(201, 403, 403, 403, 401)),
    ("GET", "/api/v1/users/mecanicos", None,
     _esp(200, 200, 403, 403, 401)),
    # --- catalogo (cualquier usuario logueado) ---
    ("GET", "/api/v1/catalogo/marcas", None,
     _esp(200, 200, 200, 200, 401)),
    ("GET", "/api/v1/catalogo/modelos", None,
     _esp(200, 200, 200, 200, 401)),
    # --- metricas (admin y recepcion) ---
    ("GET", "/api/v1/metricas/mecanicos", None,
     _esp(200, 200, 403, 403, 401)),
    ("GET", "/api/v1/metricas/finanzas", None,
     _esp(200, 200, 403, 403, 401)),
    ("GET", "/api/v1/metricas/mejor-mecanico", None,
     _esp(200, 200, 403, 403, 401)),
    # --- mecanicos (horarios) ---
    ("GET", "/api/v1/mecanicos/{mecanico_id}/horarios", None,
     _esp(200, 200, 200, 403, 401)),
    ("GET", "/api/v1/mecanicos/{mecanico_id}/calendario", None,
     _esp(200, 200, 200, 403, 401)),
    ("POST", "/api/v1/mecanicos/{mecanico_id}/horarios",
     {"dia_semana": 0, "hora_desde": "08:00", "hora_hasta": "12:00"},
     _esp(201, 403, 403, 403, 401)),
]


@pytest.mark.parametrize("rol", ROLES)
@pytest.mark.parametrize("metodo,ruta,cuerpo,esperados", CASOS)
def test_matriz_de_roles(api, datos, rol, metodo, ruta, cuerpo, esperados):
    ids = datos["ids"]
    path = ruta.format(**ids)
    body = _resolver(cuerpo, ids) if cuerpo is not None else None
    headers = datos["headers"].get(rol)
    r = api.request(metodo, path, headers=headers, json=body)
    assert r.status_code == esperados[rol], (
        f"{metodo} {path} como {rol}: esperado {esperados[rol]}, "
        f"salió {r.status_code} -> {r.text[:200]}"
    )


def test_mecanico_no_ve_los_horarios_de_otro_mecanico(api, datos):
    otro = datos["ids"]["otro_mecanico_id"]
    r = api.get(f"/api/v1/mecanicos/{otro}/horarios", headers=datos["headers"]["mecanico"])
    assert r.status_code == 403
    propio = datos["ids"]["mecanico_id"]
    r = api.get(f"/api/v1/mecanicos/{propio}/horarios", headers=datos["headers"]["mecanico"])
    assert r.status_code == 200
