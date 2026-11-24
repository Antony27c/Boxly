"""P3: servicios por taller (docs/Plataforma.md).

Dos talleres activos y uno suspendido, con datos propios en cada uno. Se
verifica que avisos, webhook de Mercado Pago, numeración de OT, datos del
taller, respaldo, auditoría y salud de plataforma respeten el taller y los
roles: el superadmin no entra a las rutas del taller y el administrador del
taller no entra a las de plataforma.
"""

import io
import zipfile
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.api.v1.pagos import mercadopago
from app.api.v1.pagos import service as pagos_service
from app.core.email import ResultadoEnvio
from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.main import app
from app.models import (
    Auditoria,
    Cliente,
    ConfiguracionTaller,
    Notificacion,
    Orden,
    Pago,
    Taller,
    Usuario,
    Vehiculo,
)
from app.models.usuario import RolUsuario

PW = hash_password("Clave1234")


def _sembrar_taller(db, taller_id: int, tag: str):
    """Datos mínimos de un taller. tag='b' usa valores centinela únicos."""
    t = tag.upper()
    admin = Usuario(
        nombre=f"Admin{t}", apellido="Taller", email=f"admin.{tag}@demo.com",
        password_hash=PW, rol=RolUsuario.administrador, taller_id=taller_id,
    )
    recepcion = Usuario(
        nombre=f"Recep{t}", apellido="Taller", email=f"recepcion.{tag}@demo.com",
        password_hash=PW, rol=RolUsuario.recepcion, taller_id=taller_id,
    )
    mecanico = Usuario(
        nombre=f"Mec{t}", apellido="Taller", email=f"mecanico.{tag}@demo.com",
        password_hash=PW, rol=RolUsuario.mecanico, taller_id=taller_id,
    )
    cliente = Cliente(
        nombre=f"Cliente{t}", apellido="Demo", dni=f"DNI-{t}-001",
        email=f"cliente.{tag}@demo.com", taller_id=taller_id,
    )
    db.add_all([admin, recepcion, mecanico, cliente])
    db.flush()
    cuenta = Usuario(
        nombre=f"Cliente{t}", apellido="Demo", email=f"cuenta.{tag}@demo.com",
        password_hash=PW, rol=RolUsuario.cliente, cliente_id=cliente.id,
        taller_id=taller_id,
    )
    vehiculo = Vehiculo(
        cliente_id=cliente.id, patente=f"PAT-{t}-001", marca=f"Marca{t}",
        modelo=f"Modelo{t}", taller_id=taller_id,
    )
    db.add_all([cuenta, vehiculo])
    db.flush()
    # OT-1001/OT-1002 en cada taller: la numeración es por taller.
    orden_pendiente = Orden(
        cliente_id=cliente.id, vehiculo_id=vehiculo.id, creado_por_id=admin.id,
        codigo="OT-1001", estado="pendiente",
        descripcion_ingreso=f"Trabajo pendiente {t}", taller_id=taller_id,
    )
    orden_lista = Orden(
        cliente_id=cliente.id, vehiculo_id=vehiculo.id, creado_por_id=admin.id,
        codigo="OT-1002", estado="listo", costo_final=Decimal("1500.00"),
        descripcion_ingreso=f"Trabajo lista {t}", taller_id=taller_id,
    )
    db.add_all([orden_pendiente, orden_lista])
    db.flush()
    pago = Pago(
        orden_id=orden_lista.id, monto=Decimal("1500.00"), estado="pendiente",
        taller_id=taller_id,
    )
    db.add(pago)
    db.commit()
    return {
        "admin": admin, "recepcion": recepcion, "mecanico": mecanico,
        "cuenta": cuenta, "cliente": cliente, "vehiculo": vehiculo,
        "orden_pendiente": orden_pendiente, "orden_lista": orden_lista,
        "pago": pago,
    }


@pytest.fixture
def datos():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        taller_b = Taller(nombre="Taller Norte", estado="activo")
        taller_susp = Taller(nombre="Taller Sur", estado="suspendido")
        db.add_all([taller_b, taller_susp])
        db.flush()

        a = _sembrar_taller(db, 1, "a")
        b = _sembrar_taller(db, taller_b.id, "b")

        # En el taller A hay una OT más: si el contador de OT- se mezclara,
        # el taller B numeraría OT-1004 en vez de OT-1003.
        orden_extra_a = Orden(
            cliente_id=a["cliente"].id, vehiculo_id=a["vehiculo"].id,
            creado_por_id=a["admin"].id, codigo="OT-1003", estado="entregado",
            descripcion_ingreso="Trabajo extra A", taller_id=1,
        )
        db.add(orden_extra_a)

        superadmin = Usuario(
            nombre="Super", apellido="Admin", email="super@demo.com",
            password_hash=PW, rol=RolUsuario.superadmin, taller_id=None,
        )
        db.add(superadmin)
        db.commit()

        personas = {
            "admin_a": a["admin"], "recepcion_a": a["recepcion"],
            "mecanico_a": a["mecanico"], "cliente_a": a["cuenta"],
            "admin_b": b["admin"], "recepcion_b": b["recepcion"],
            "mecanico_b": b["mecanico"], "cliente_b": b["cuenta"],
            "superadmin": superadmin,
        }
        headers = {
            nombre: {"Authorization": "Bearer " + create_access_token(u.id)}
            for nombre, u in personas.items()
        }
        return {
            "headers": headers,
            "taller_b_id": taller_b.id,
            "ids": {
                "orden_pendiente_b": b["orden_pendiente"].id,
                "orden_lista_b": b["orden_lista"].id,
                "pago_b": b["pago"].id,
                "vehiculo_b": b["vehiculo"].id,
                "orden_lista_a": a["orden_lista"].id,
                "pago_a": a["pago"].id,
            },
        }


@pytest.fixture
def api():
    with TestClient(app) as cliente:
        yield cliente


# ---------------------------------------------------------------------------
# Avisos y notificaciones
# ---------------------------------------------------------------------------


def test_notificacion_de_orden_del_taller2_queda_en_su_taller(api, datos, monkeypatch):
    mock = AsyncMock(return_value=ResultadoEnvio("enviado", "Asunto"))
    monkeypatch.setattr(
        "app.api.v1.ordenes.service.enviar_notificacion_cambio_estado", mock
    )
    r = api.patch(
        f"/api/v1/ordenes/{datos['ids']['orden_pendiente_b']}",
        headers=datos["headers"]["admin_b"],
        json={"estado": "ingresado", "comentario_cambio": "Entró al taller"},
    )
    assert r.status_code == 200
    with SessionLocal() as db:
        notificaciones = list(
            db.scalars(
                select(Notificacion).where(
                    Notificacion.orden_id == datos["ids"]["orden_pendiente_b"]
                )
            ).all()
        )
    assert len(notificaciones) == 1
    assert notificaciones[0].taller_id == datos["taller_b_id"]


# ---------------------------------------------------------------------------
# Webhook y cobro online de Mercado Pago
# ---------------------------------------------------------------------------


def _settings_mp(monkeypatch, **cambios):
    fake = SimpleNamespace(
        debug=True,
        environment="dev",
        mp_access_token="token",
        mp_webhook_secret=None,
        frontend_url="http://front.test",
        backend_public_url=None,
    )
    for clave, valor in cambios.items():
        setattr(fake, clave, valor)
    monkeypatch.setattr(pagos_service, "get_settings", lambda: fake)
    return fake


def test_webhook_actualiza_el_pago_del_taller2(api, datos, monkeypatch):
    _settings_mp(monkeypatch)
    pago_b_id = datos["ids"]["pago_b"]
    monkeypatch.setattr(
        mercadopago,
        "obtener_pago",
        lambda *a, **k: {
            "id": "555000",
            "status": "approved",
            "transaction_amount": "1500.00",
            "external_reference": str(pago_b_id),
        },
    )
    r = api.post(
        "/api/v1/pagos/webhook",
        json={"type": "payment", "data": {"id": "555000"}},
    )
    assert r.status_code == 200
    with SessionLocal() as db:
        pago_b = db.get(Pago, pago_b_id)
        pago_a = db.get(Pago, datos["ids"]["pago_a"])
    assert pago_b.estado == "aprobado"
    assert pago_b.payment_id == "555000"
    # El pago del taller 1 no se toca.
    assert pago_a.estado == "pendiente"
    assert pago_a.payment_id is None


def test_crear_pago_en_otro_taller_da_409(api, datos, monkeypatch):
    _settings_mp(monkeypatch, mp_access_token=None)
    # Taller 1 sí puede crear el pago online (dev+debug sin token).
    r1 = api.post(
        f"/api/v1/pagos/ordenes/{datos['ids']['orden_lista_a']}",
        headers=datos["headers"]["admin_a"],
    )
    assert r1.status_code == 201
    # Taller 2 todavía no tiene cobro online.
    r2 = api.post(
        f"/api/v1/pagos/ordenes/{datos['ids']['orden_lista_b']}",
        headers=datos["headers"]["admin_b"],
    )
    assert r2.status_code == 409
    assert r2.json()["detail"] == "Este taller todavía no tiene cobro online"


# ---------------------------------------------------------------------------
# Numeración de órdenes por taller
# ---------------------------------------------------------------------------


def test_numeracion_ot_por_taller(api, datos):
    with SessionLocal() as db:
        vehiculo_a = db.scalar(
            select(Vehiculo).where(Vehiculo.patente == "PAT-A-001")
        )
        vehiculo_b = db.scalar(
            select(Vehiculo).where(Vehiculo.patente == "PAT-B-001")
        )
    # Taller A ya tiene OT-1001..OT-1003 → la próxima es OT-1004.
    r1 = api.post(
        "/api/v1/ordenes",
        headers=datos["headers"]["admin_a"],
        json={"vehiculo_id": vehiculo_a.id, "descripcion_ingreso": "Nueva A"},
    )
    assert r1.status_code in (200, 201)
    assert r1.json()["codigo"] == "OT-1004"
    # Taller B tiene OT-1001 y OT-1002 → la próxima es OT-1003 (no ve las del A).
    r2 = api.post(
        "/api/v1/ordenes",
        headers=datos["headers"]["admin_b"],
        json={"vehiculo_id": vehiculo_b.id, "descripcion_ingreso": "Nueva B"},
    )
    assert r2.status_code in (200, 201)
    assert r2.json()["codigo"] == "OT-1003"


# ---------------------------------------------------------------------------
# Datos del taller por sesión
# ---------------------------------------------------------------------------


def test_get_y_put_taller_por_taller(api, datos):
    h1 = datos["headers"]["admin_a"]
    h2 = datos["headers"]["admin_b"]

    r1 = api.get("/api/v1/taller", headers=h1)
    assert r1.status_code == 200
    assert r1.json()["nombre"] == "Mi taller"
    assert r1.json()["pago_online"] is True

    # El taller B crea su propia fila con sus valores por defecto.
    r2 = api.get("/api/v1/taller", headers=h2)
    assert r2.status_code == 200
    assert r2.json()["nombre"] == "Mi taller"
    assert r2.json()["pago_online"] is False

    # El admin del taller B edita solo lo suyo.
    r = api.put("/api/v1/taller", headers=h2, json={"nombre": "Taller Norte"})
    assert r.status_code == 200
    assert r.json()["nombre"] == "Taller Norte"

    # El taller A no ve el cambio del B.
    assert api.get("/api/v1/taller", headers=h1).json()["nombre"] == "Mi taller"

    with SessionLocal() as db:
        configs = {
            c.taller_id: c.nombre
            for c in db.scalars(select(ConfiguracionTaller)).all()
        }
    assert configs[1] == "Mi taller"
    assert configs[datos["taller_b_id"]] == "Taller Norte"


# ---------------------------------------------------------------------------
# Respaldo del taller
# ---------------------------------------------------------------------------


def _csvs_del_zip(contenido: bytes) -> dict[str, str]:
    with zipfile.ZipFile(io.BytesIO(contenido)) as respaldo:
        return {
            nombre: respaldo.read(nombre).decode("utf-8-sig")
            for nombre in respaldo.namelist()
        }


def test_respaldo_del_taller2_no_tiene_filas_del_taller1(api, datos):
    r = api.get("/api/v1/taller/respaldo", headers=datos["headers"]["admin_b"])
    assert r.status_code == 200
    csvs = _csvs_del_zip(r.content)
    assert sorted(csvs) == sorted(
        [
            "usuarios.csv", "clientes.csv", "vehiculos.csv", "ordenes.csv",
            "detalles_orden.csv", "historial_estado.csv", "repuestos.csv",
            "turnos.csv", "pagos.csv", "horarios_mecanico.csv",
            "configuracion_taller.csv",
        ]
    )
    for nombre, texto in csvs.items():
        assert nombre.endswith(".csv")
        # Ningún centinela del taller A puede aparecer en el respaldo del B.
        for centinela in ("admin.a@demo.com", "cliente.a@demo.com",
                          "DNI-A-001", "PAT-A-001", "ClienteA", "MarcaA",
                          "Trabajo pendiente A", "Trabajo lista A", "Trabajo extra A"):
            assert centinela not in texto, f"{centinela} filtrado en {nombre}"
    # Y sí están los datos del taller B.
    assert "admin.b@demo.com" in csvs["usuarios.csv"]
    assert "DNI-B-001" in csvs["clientes.csv"]
    assert "Trabajo pendiente B" in csvs["ordenes.csv"]
    assert "OT-1001" in csvs["ordenes.csv"]


def test_respaldo_solo_administrador(api, datos):
    for rol in ("recepcion_b", "mecanico_b", "cliente_b", "superadmin"):
        r = api.get("/api/v1/taller/respaldo", headers=datos["headers"][rol])
        assert r.status_code == 403, rol


# ---------------------------------------------------------------------------
# Auditoría del taller y de la plataforma
# ---------------------------------------------------------------------------


def _insertar_auditoria(taller_id: int, ruta: str) -> None:
    with SessionLocal() as db:
        db.add(
            Auditoria(
                taller_id=taller_id,
                metodo="POST",
                ruta=ruta,
                estado_http=200,
                usuario_email="admin@demo.com",
            )
        )
        db.commit()


def test_auditoria_del_taller_solo_sus_filas(api, datos):
    _insertar_auditoria(1, "/api/v1/repuestos")
    _insertar_auditoria(datos["taller_b_id"], "/api/v1/clientes")

    h2 = datos["headers"]["admin_b"]
    r = api.get("/api/v1/taller/auditoria", headers=h2)
    assert r.status_code == 200
    filas = r.json()
    assert len(filas) == 1
    assert filas[0]["ruta"] == "/api/v1/clientes"
    assert filas[0]["taller_id"] == datos["taller_b_id"]

    # La exportación también sale solo con las filas del taller.
    r = api.get("/api/v1/taller/auditoria/exportar", headers=h2)
    assert r.status_code == 200
    texto = r.content.decode("utf-8-sig")
    assert "/api/v1/clientes" in texto
    assert "/api/v1/repuestos" not in texto


def test_auditoria_plataforma_con_y_sin_filtro(api, datos):
    _insertar_auditoria(1, "/api/v1/repuestos")
    _insertar_auditoria(datos["taller_b_id"], "/api/v1/clientes")

    h = datos["headers"]["superadmin"]
    r = api.get("/api/v1/plataforma/auditoria", headers=h)
    assert r.status_code == 200
    rutas = {f["ruta"] for f in r.json()}
    assert "/api/v1/repuestos" in rutas and "/api/v1/clientes" in rutas

    r = api.get(
        "/api/v1/plataforma/auditoria",
        headers=h, params={"taller_id": datos["taller_b_id"]},
    )
    assert r.status_code == 200
    filas = r.json()
    assert len(filas) == 1
    assert filas[0]["ruta"] == "/api/v1/clientes"


def test_auditoria_roles(api, datos):
    h = datos["headers"]
    # El administrador del taller no entra a la auditoría de plataforma.
    assert api.get("/api/v1/plataforma/auditoria", headers=h["admin_b"]).status_code == 403
    assert (
        api.get("/api/v1/plataforma/auditoria/exportar", headers=h["admin_b"]).status_code
        == 403
    )
    # El superadmin no entra a la auditoría del taller.
    assert api.get("/api/v1/taller/auditoria", headers=h["superadmin"]).status_code == 403
    assert (
        api.get("/api/v1/taller/auditoria/exportar", headers=h["superadmin"]).status_code
        == 403
    )
    # Recepción no es administrador del taller.
    assert api.get("/api/v1/taller/auditoria", headers=h["recepcion_b"]).status_code == 403


# ---------------------------------------------------------------------------
# Salud de la plataforma
# ---------------------------------------------------------------------------


def test_plataforma_sistema_agregados_y_talleres(api, datos):
    r = api.get("/api/v1/plataforma/sistema", headers=datos["headers"]["superadmin"])
    assert r.status_code == 200
    body = r.json()
    # Conteos agregados de TODOS los talleres (2 activos + el suspendido no tiene datos).
    assert body["conteos"]["usuarios"] == 9  # 4 por taller x2 + superadmin
    assert body["conteos"]["clientes"] == 2
    assert body["conteos"]["vehiculos"] == 2
    assert body["conteos"]["ordenes"] == 5  # 3 del A + 2 del B
    assert body["conteos"]["ordenes_abiertas"] == 4  # pendientes y listas
    assert body["conteos"]["pagos"] == 2
    assert body["usuarios_por_rol"] == {
        "superadmin": 1, "administrador": 2, "recepcion": 2,
        "mecanico": 2, "cliente": 2,
    }
    assert body["talleres"] == {"activo": 2, "suspendido": 1}


def test_plataforma_sistema_roles(api, datos):
    h = datos["headers"]
    for rol in ("admin_a", "admin_b", "recepcion_b", "cliente_b"):
        assert api.get("/api/v1/plataforma/sistema", headers=h[rol]).status_code == 403, rol
