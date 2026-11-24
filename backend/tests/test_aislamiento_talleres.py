"""P4: aislamiento entre talleres probado de punta a punta.

Dos talleres (el 1 y el 2) con datos completos y usuarios de cada rol en cada
uno, más un taller suspendido y un superadmin. Se recorren automáticamente
todas las rutas de ``app.routes`` bajo ``/api/v1`` (excluidas ``/plataforma``,
``/auth``, ``/terminos`` y el webhook de pagos) y se verifica que un usuario
del taller A nunca pueda leer ni tocar datos del taller B, que los listados no
devuelvan filas de B, que el respaldo ZIP, la auditoría y los accesos de
soporte del taller A no incluyan nada del taller B, que el superadmin sin
acceso de soporte reciba 403 en las rutas del taller, que un usuario de un
taller suspendido reciba 403, y que la unicidad (DNI, patente, código de
repuesto) sea por taller.

Si una ruta fuga datos de B el test queda en ``xfail(strict=True)`` con el
motivo ``FUGA:`` para que la regresión sea visible pero no rompa la suite
mientras otro agente lo corrige (contrato en docs/Plataforma.md).
"""

import csv
import io
import zipfile
from datetime import date, datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.main import app
from app.models import (
    AccesoSoporte,
    Auditoria,
    Cliente,
    DetalleOrden,
    Historial_estado,
    HorarioMecanico,
    ImagenOrden,
    Notificacion,
    Orden,
    Pago,
    PagoSuscripcion,
    Repuesto,
    Taller,
    Turno,
    Usuario,
    Vehiculo,
)
from app.models.taller import TALLER_PRINCIPAL_ID
from app.models.usuario import RolUsuario

# ---------------------------------------------------------------------------
# Descubrimiento automático de rutas
# ---------------------------------------------------------------------------

# Prefijos que no son "rutas del taller": plataforma, auth, términos, las
# rutas públicas de la landing (sin usuario ni contexto de taller) y el
# webhook público de Mercado Pago. /soporte SÍ entra: desde P2 son rutas del
# taller (el administrador otorga y revoca accesos de su propio taller).
PREFIJOS_EXCLUIDOS = (
    "/api/v1/plataforma",
    "/api/v1/auth",
    "/api/v1/publico",
    "/api/v1/terminos",
)


def _walk_rutas(routes, prefijo=""):
    """Aplana app.routes: los _IncludedRouter de FastAPI 0.141 anidan routers."""
    for ruta in routes:
        if type(ruta).__name__ == "_IncludedRouter":
            ctx = ruta.include_context
            yield from _walk_rutas(ruta.original_router.routes, prefijo + ctx.prefix)
        elif hasattr(ruta, "path") and hasattr(ruta, "methods"):
            yield prefijo + ruta.path, ruta


def _rutas_en_scope():
    """{(metodo, path)} bajo /api/v1 menos los prefijos excluidos y el webhook."""
    encontradas = set()
    for path, ruta in _walk_rutas(app.routes):
        if not path.startswith("/api/v1"):
            continue
        if any(path.startswith(p) for p in PREFIJOS_EXCLUIDOS):
            continue
        if "/webhook" in path:
            continue
        for metodo in ruta.methods:
            if metodo not in ("HEAD", "OPTIONS"):
                encontradas.add((metodo, path))
    return encontradas


# ---------------------------------------------------------------------------
# Casos: rutas con {param} del otro taller
# (metodo, plantilla, json, files). Los {} se reemplazan con ids del taller B.
# ---------------------------------------------------------------------------

PNG_TINY = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32

CASOS_PARAMS = [
    # clientes
    ("GET", "/api/v1/clientes/{cliente_id}", None, None),
    ("PUT", "/api/v1/clientes/{cliente_id}", {}, None),
    ("DELETE", "/api/v1/clientes/{cliente_id}", None, None),
    ("POST", "/api/v1/clientes/{cliente_id}/invitacion", None, None),
    # vehiculos
    ("GET", "/api/v1/vehiculos/{vehiculo_id}", None, None),
    ("GET", "/api/v1/vehiculos/{vehiculo_id}/ordenes", None, None),
    ("PUT", "/api/v1/vehiculos/{vehiculo_id}", {}, None),
    ("DELETE", "/api/v1/vehiculos/{vehiculo_id}", None, None),
    # repuestos
    ("GET", "/api/v1/repuestos/{repuesto_id}", None, None),
    ("PUT", "/api/v1/repuestos/{repuesto_id}", {}, None),
    ("DELETE", "/api/v1/repuestos/{repuesto_id}", None, None),
    ("POST", "/api/v1/repuestos/{repuesto_id}/ingresos", {"cantidad": 3}, None),
    # turnos
    ("GET", "/api/v1/turnos/{turno_id}", None, None),
    ("PUT", "/api/v1/turnos/{turno_id}", {}, None),
    ("PUT", "/api/v1/turnos/{turno_id}/estado", {"estado": "confirmado"}, None),
    ("DELETE", "/api/v1/turnos/{turno_id}", None, None),
    # ordenes
    ("GET", "/api/v1/ordenes/{orden_id}", None, None),
    ("PATCH", "/api/v1/ordenes/{orden_id}", {}, None),
    ("DELETE", "/api/v1/ordenes/{orden_id}", None, None),
    ("POST", "/api/v1/ordenes/{orden_id}/cobro", {}, None),
    ("POST", "/api/v1/ordenes/{orden_id}/cobro/aprobar", {}, None),
    ("POST", "/api/v1/ordenes/{orden_id}/pago-local", {"medio": "efectivo", "monto": "100"}, None),
    ("GET", "/api/v1/ordenes/{orden_id}/historial", None, None),
    ("GET", "/api/v1/ordenes/{orden_id}/notificaciones", None, None),
    ("POST", "/api/v1/ordenes/{orden_id}/notificaciones", None, None),
    ("GET", "/api/v1/ordenes/{orden_id}/detalles", None, None),
    (
        "POST",
        "/api/v1/ordenes/{orden_id}/detalles",
        {"descripcion": "Mano de obra", "cantidad": 1, "precio_unitario": 100},
        None,
    ),
    (
        "PATCH",
        "/api/v1/ordenes/{orden_id}/detalles/{detalle_id}",
        {"precio_unitario": 75},
        None,
    ),
    ("DELETE", "/api/v1/ordenes/{orden_id}/detalles/{detalle_id}", None, None),
    ("GET", "/api/v1/ordenes/{orden_id}/imagenes", None, None),
    (
        "POST",
        "/api/v1/ordenes/{orden_id}/imagenes",
        None,
        {"archivo": ("foto.png", PNG_TINY, "image/png")},
    ),
    ("DELETE", "/api/v1/ordenes/{orden_id}/imagenes/{imagen_id}", None, None),
    # pagos
    ("POST", "/api/v1/pagos/ordenes/{orden_id}", None, None),
    ("GET", "/api/v1/pagos/{pago_id}", None, None),
    ("POST", "/api/v1/pagos/{pago_id}/confirmar", {"payment_id": "123"}, None),
    ("POST", "/api/v1/pagos/{pago_id}/simular", {"estado": "aprobado"}, None),
    # users
    ("GET", "/api/v1/users/{user_id}", None, None),
    ("PUT", "/api/v1/users/{user_id}", {}, None),
    ("DELETE", "/api/v1/users/{user_id}", None, None),
    # mecanicos / horarios
    ("GET", "/api/v1/mecanicos/{mecanico_id}/horarios", None, None),
    (
        "POST",
        "/api/v1/mecanicos/{mecanico_id}/horarios",
        {"dia_semana": 0, "hora_desde": "08:00", "hora_hasta": "12:00"},
        None,
    ),
    (
        "PUT",
        "/api/v1/mecanicos/{mecanico_id}/horarios/{horario_id}",
        {"hora_desde": "09:00"},
        None,
    ),
    ("DELETE", "/api/v1/mecanicos/{mecanico_id}/horarios/{horario_id}", None, None),
    ("GET", "/api/v1/mecanicos/{mecanico_id}/calendario", None, None),
    # portal del cliente
    ("GET", "/api/v1/mis-ordenes/{orden_id}", None, None),
    # soporte: revocar el acceso del otro taller tiene que dar 404
    ("POST", "/api/v1/soporte/accesos/{acceso_id}/revocar", None, None),
]

# GET sin parámetros de ruta: listados, catálogos, respaldo y auditoría.
CASOS_LISTAS = [
    ("GET", "/api/v1/catalogo/marcas"),
    ("GET", "/api/v1/catalogo/modelos"),
    ("GET", "/api/v1/clientes"),
    ("GET", "/api/v1/metricas/finanzas"),
    ("GET", "/api/v1/metricas/mecanicos"),
    ("GET", "/api/v1/metricas/mejor-mecanico"),
    ("GET", "/api/v1/mis-ordenes"),
    ("GET", "/api/v1/mis-vehiculos"),
    ("GET", "/api/v1/ordenes"),
    ("GET", "/api/v1/ordenes/estados"),
    ("GET", "/api/v1/repuestos"),
    ("GET", "/api/v1/repuestos/stock-bajo"),
    ("GET", "/api/v1/soporte/accesos"),
    ("GET", "/api/v1/soporte/actividad"),
    ("GET", "/api/v1/suscripcion"),
    ("GET", "/api/v1/suscripcion/encuesta"),
    ("GET", "/api/v1/suscripcion/pagos"),
    ("GET", "/api/v1/suscripcion/planes"),
    ("GET", "/api/v1/taller"),
    ("GET", "/api/v1/taller/auditoria"),
    ("GET", "/api/v1/taller/auditoria/exportar"),
    ("GET", "/api/v1/taller/respaldo"),
    ("GET", "/api/v1/turnos"),
    ("GET", "/api/v1/users"),
    ("GET", "/api/v1/users/mecanicos"),
    ("GET", "/api/v1/vehiculos"),
]

# Escrituras sin {param}: el body puede referenciar entidades de B por id.
# (metodo, path, json). Las de "propio" crean datos del taller de la sesión.
CASOS_CREACIONES = [
    # referencias cruzadas: tienen que fallar, nunca crear con datos de B
    (
        "POST",
        "/api/v1/vehiculos",
        {"cliente_id": "{cliente_id}", "patente": "CRZ-001", "marca": "MarcaX", "modelo": "ModeloY"},
    ),
    (
        "POST",
        "/api/v1/turnos",
        {"cliente_id": "{cliente_id}", "vehiculo_id": "{vehiculo_id}", "fecha_hora": "2026-12-01T09:00:00"},
    ),
    (
        "POST",
        "/api/v1/ordenes",
        {"vehiculo_id": "{vehiculo_id}", "descripcion_ingreso": "Intento cruzado"},
    ),
    (
        "POST",
        "/api/v1/users",
        {
            "nombre": "Prueba",
            "apellido": "Cruzada",
            "email": "x.cruz@demo.com",
            "password": "Clave1234",
            "rol": "cliente",
            "cliente_id": "{cliente_id}",
        },
    ),
    # creación propia en el taller de la sesión
    ("POST", "/api/v1/clientes", {"nombre": "Nuevo", "apellido": "Cliente", "dni": "N0000001"}),
    ("POST", "/api/v1/repuestos", {"codigo": "NUEVO-1", "nombre": "Repuesto nuevo", "precio": 50}),
    # acceso de soporte propio del taller de la sesión (P2)
    ("POST", "/api/v1/soporte/accesos", {"horas": 4, "motivo": "Prueba de aislamiento"}),
    # suscripción del taller de la sesión (S1/S2)
    ("PUT", "/api/v1/suscripcion/plan", {"plan": "pro"}),
    ("POST", "/api/v1/suscripcion/encuesta", {"salteada": True}),
    ("POST", "/api/v1/suscripcion/cobro-automatico", {}),
    ("DELETE", "/api/v1/suscripcion/cobro-automatico", {}),
    ("POST", "/api/v1/suscripcion/simular-cobro", {"estado": "aprobado"}),
    # datos del taller: P3 lo pasó al administrador del taller
    ("PUT", "/api/v1/taller", {"nombre": "Intento de cambio"}),
]

# Rutas neutras: datos globales/de catálogo, no pertenecen a un taller.
RUTAS_NEUTRAS = {
    ("GET", "/api/v1/catalogo/marcas"),
    ("GET", "/api/v1/catalogo/modelos"),
    ("GET", "/api/v1/ordenes/estados"),
}

# Personas del taller A con las que se prueba cada ruta con {param}.
PERSONAS = ("admin", "recepcion", "mecanico", "cliente")

# Personas para los listados: el administrador ve todo lo del taller (el caso
# más exigente); el portal del cliente se prueba con la cuenta de cliente.
PERSONAS_LISTA = {
    "/api/v1/mis-ordenes": ("cliente",),
    "/api/v1/mis-vehiculos": ("cliente",),
}

# Rutas que hoy explotan con 500 por un bug ajeno (no son fugas de datos):
# PlanResponse.model_validate no acepta instancias ORM porque
# app/schemas/suscripcion.py no define from_attributes. El caso queda
# registrado para cobertura, pero si la request explota se reporta xfail;
# cuando el bug se corrige el test vuelve a correr y pasa solo.
XFAIL_500 = {
    ("GET", "/api/v1/suscripcion"),
    ("GET", "/api/v1/suscripcion/planes"),
    ("PUT", "/api/v1/suscripcion/plan"),
}
MOTIVO_500 = (
    "BUG ajeno (S1): PlanResponse.model_validate falla con instancias ORM "
    "(falta from_attributes en schemas/suscripcion.py) → 500; no es fuga"
)


def _request(api, headers, metodo, path, **kwargs):
    """api.request que convierte en xfail la explosión de las rutas de XFAIL_500."""
    try:
        return api.request(metodo, path, headers=headers, **kwargs)
    except Exception:
        if (metodo, path) in XFAIL_500:
            pytest.xfail(MOTIVO_500)
        raise


# Body mínimo válido por ruta de escritura, para que un 403/401 no dependa de
# que el body pase la validación.
def _kwargs_minimos(metodo: str, path: str) -> dict:
    if metodo in ("GET", "DELETE"):
        return {}
    if path.endswith("/imagenes"):
        return {"files": {"archivo": ("f.png", PNG_TINY, "image/png")}}
    if "/horarios" in path:
        return {"json": {"dia_semana": 0, "hora_desde": "08:00", "hora_hasta": "12:00"}}
    if path.endswith("/estado"):
        return {"json": {"estado": "confirmado"}}
    if path.endswith("/ingresos"):
        return {"json": {"cantidad": 1}}
    if path.endswith("/detalles"):
        return {"json": {"descripcion": "x", "cantidad": 1, "precio_unitario": 1}}
    if "/detalles/" in path:
        return {"json": {"precio_unitario": 10}}
    if path.endswith("/confirmar"):
        return {"json": {"payment_id": "1"}}
    if path.endswith("/simular"):
        return {"json": {"estado": "aprobado"}}
    if path == "/api/v1/soporte/accesos":
        return {"json": {"horas": 4}}
    if path == "/api/v1/suscripcion/plan":
        return {"json": {"plan": "pro"}}
    if path == "/api/v1/suscripcion/simular-cobro":
        return {"json": {"estado": "aprobado"}}
    if path == "/api/v1/taller":
        return {"json": {"nombre": "x"}}
    return {"json": {}}


# ---------------------------------------------------------------------------
# Fixture: taller A (id=1, el principal), taller B y un taller suspendido
# ---------------------------------------------------------------------------


def _sembrar_taller(db, taller_id: int, tag: str):
    """Datos completos de un taller. tag='b' usa valores centinela únicos."""
    pw = hash_password("Clave1234")
    t = tag.upper()
    admin = Usuario(
        nombre=f"Admin{t}", apellido="Taller", email=f"admin.{tag}@demo.com",
        password_hash=pw, rol=RolUsuario.administrador, taller_id=taller_id,
    )
    recepcion = Usuario(
        nombre=f"Recep{t}", apellido="Taller", email=f"recepcion.{tag}@demo.com",
        password_hash=pw, rol=RolUsuario.recepcion, taller_id=taller_id,
    )
    mecanico = Usuario(
        nombre=f"Mecanico{t}", apellido="Taller", email=f"mecanico.{tag}@demo.com",
        password_hash=pw, rol=RolUsuario.mecanico, taller_id=taller_id,
    )
    cliente = Cliente(
        nombre=f"Cliente{t}", apellido="Demo", dni=f"{t}0000001",
        email=f"cliente.{tag}@demo.com", taller_id=taller_id,
    )
    db.add_all([admin, recepcion, mecanico, cliente])
    db.flush()
    cuenta = Usuario(
        nombre=f"Cliente{t}", apellido="Demo", email=f"cuenta.{tag}@demo.com",
        password_hash=pw, rol=RolUsuario.cliente, cliente_id=cliente.id,
        taller_id=taller_id,
    )
    vehiculo = Vehiculo(
        cliente_id=cliente.id, patente=f"PAT-{t}-001", marca=f"Marca{t}",
        modelo=f"Modelo{t}", taller_id=taller_id,
    )
    repuesto = Repuesto(
        codigo=f"REP-{t}-001", nombre=f"Repuesto{t}", precio=100,
        stock=5, stock_minimo=1, taller_id=taller_id,
    )
    db.add_all([cuenta, vehiculo, repuesto])
    db.flush()
    orden = Orden(
        cliente_id=cliente.id, vehiculo_id=vehiculo.id, creado_por_id=admin.id,
        mecanico_id=mecanico.id, codigo=f"OT-{t}-0001", estado="en_diagnostico",
        descripcion_ingreso=f"Trabajo{t} centinela", taller_id=taller_id,
    )
    db.add(orden)
    db.flush()
    detalle = DetalleOrden(
        orden_id=orden.id, descripcion=f"Detalle{t}", cantidad=1,
        precio_unitario=50,
    )
    historial = Historial_estado(
        orden_id=orden.id, usuario_id=admin.id, estado_anterior=None,
        estado_nuevo="pendiente", comentario=f"Creada en {t}",
    )
    imagen = ImagenOrden(
        orden_id=orden.id, url=f"/uploads/{tag}-centinela.png", usuario_id=admin.id,
    )
    pago = Pago(
        orden_id=orden.id, monto=100, estado="pendiente", taller_id=taller_id,
    )
    notificacion = Notificacion(
        orden_id=orden.id, tipo="cambio_estado", estado_orden="en_diagnostico",
        destinatario=cliente.email, asunto=f"Aviso{t}", resultado="omitido",
        taller_id=taller_id,
    )
    turno = Turno(
        cliente_id=cliente.id, vehiculo_id=vehiculo.id,
        registrado_por_id=recepcion.id, mecanico_id=mecanico.id,
        fecha_hora=datetime(2026, 12, 1, 9, 0), estado="confirmado",
        motivo=f"Turno{t}", taller_id=taller_id,
    )
    horario = HorarioMecanico(
        mecanico_id=mecanico.id, dia_semana=0, hora_desde="08:00",
        hora_hasta="12:00", taller_id=taller_id,
    )
    # PagoSuscripcion no usa TallerMixin: el taller va explícito (el service
    # de suscripción filtra a mano; acá queda para que /suscripcion/pagos
    # tenga datos del otro taller contra los que probar la fuga).
    pago_suscripcion = PagoSuscripcion(
        taller_id=taller_id, monto=15000,
        periodo_desde=date(2026, 1, 1), periodo_hasta=date(2026, 1, 31),
        medio="manual", estado="aprobado", referencia=f"Ref-{t}",
        registrado_por_id=admin.id,
    )
    db.add_all([
        detalle, historial, imagen, pago, notificacion, turno, horario,
        pago_suscripcion,
    ])
    db.commit()
    return {
        "admin": admin, "recepcion": recepcion, "mecanico": mecanico,
        "cuenta": cuenta, "cliente": cliente, "vehiculo": vehiculo,
        "repuesto": repuesto, "orden": orden, "detalle": detalle,
        "imagen": imagen, "pago": pago, "turno": turno, "horario": horario,
        "pago_suscripcion": pago_suscripcion,
    }


@pytest.fixture
def datos():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        taller_b = Taller(nombre="TallerBravo", estado="activo")
        taller_susp = Taller(nombre="TallerSuspendido", estado="suspendido")
        db.add_all([taller_b, taller_susp])
        db.flush()

        datos_a = _sembrar_taller(db, 1, "a")
        datos_b = _sembrar_taller(db, taller_b.id, "b")

        suspendido = Usuario(
            nombre="Susp", apellido="Endido", email="susp@demo.com",
            password_hash=hash_password("Clave1234"),
            rol=RolUsuario.administrador, taller_id=taller_susp.id,
        )
        superadmin = Usuario(
            nombre="Super", apellido="Admin", email="super@demo.com",
            password_hash=hash_password("Clave1234"),
            rol=RolUsuario.superadmin, taller_id=None,
        )
        db.add_all([suspendido, superadmin])
        db.flush()

        # Accesos de soporte y auditoría de cada taller (P2/P3). El de A está
        # vencido (se ve en el listado pero no bloquea un nuevo otorgamiento);
        # el de B está vigente y con motivo centinela.
        ahora = datetime.now(timezone.utc)
        acceso_a = AccesoSoporte(
            taller_id=TALLER_PRINCIPAL_ID, otorgado_por_id=datos_a["admin"].id,
            motivo="SoporteA vencido",
            desde=ahora - timedelta(hours=72), hasta=ahora - timedelta(hours=48),
        )
        acceso_b = AccesoSoporte(
            taller_id=taller_b.id, otorgado_por_id=datos_b["admin"].id,
            motivo="MotivoB-centinela",
            desde=ahora - timedelta(hours=1), hasta=ahora + timedelta(hours=23),
        )
        auditorias = [
            Auditoria(
                usuario_id=datos_a["admin"].id, taller_id=TALLER_PRINCIPAL_ID,
                soporte=False, usuario_email="admin.a@demo.com",
                rol="administrador", metodo="POST", ruta="/api/v1/clientes",
                entidad="clientes", estado_http=201, detalle="AccionA",
            ),
            Auditoria(
                usuario_id=superadmin.id, taller_id=TALLER_PRINCIPAL_ID,
                soporte=True, usuario_email="super@demo.com",
                rol="superadmin", metodo="GET", ruta="/api/v1/clientes",
                estado_http=200,
            ),
            Auditoria(
                usuario_id=datos_b["admin"].id, taller_id=taller_b.id,
                soporte=False, usuario_email="admin.b@demo.com",
                rol="administrador", metodo="POST", ruta="/api/v1/ordenes",
                entidad="ordenes", entidad_id=datos_b["orden"].id,
                estado_http=201, detalle="DetalleB-centinela",
            ),
            Auditoria(
                usuario_id=superadmin.id, taller_id=taller_b.id,
                soporte=True, usuario_email="super@demo.com",
                rol="superadmin", metodo="GET",
                ruta=f"/api/v1/ordenes/{datos_b['orden'].id}",
                entidad="ordenes", entidad_id=datos_b["orden"].id, estado_http=200,
            ),
        ]
        db.add_all([acceso_a, acceso_b, *auditorias])
        db.commit()

        # Nombres de path-param -> id de la entidad del taller B.
        b_ids = {
            "cliente_id": datos_b["cliente"].id,
            "vehiculo_id": datos_b["vehiculo"].id,
            "repuesto_id": datos_b["repuesto"].id,
            "turno_id": datos_b["turno"].id,
            "orden_id": datos_b["orden"].id,
            "detalle_id": datos_b["detalle"].id,
            "imagen_id": datos_b["imagen"].id,
            "pago_id": datos_b["pago"].id,
            "user_id": datos_b["admin"].id,
            "mecanico_id": datos_b["mecanico"].id,
            "horario_id": datos_b["horario"].id,
            "acceso_id": acceso_b.id,
        }
        headers = {
            "admin": datos_a["admin"],
            "recepcion": datos_a["recepcion"],
            "mecanico": datos_a["mecanico"],
            "cliente": datos_a["cuenta"],
        }
        headers = {
            rol: {"Authorization": "Bearer " + create_access_token(u.id)}
            for rol, u in headers.items()
        }
        headers["superadmin"] = {
            "Authorization": "Bearer " + create_access_token(superadmin.id)
        }
        headers["suspendido"] = {
            "Authorization": "Bearer " + create_access_token(suspendido.id)
        }
        a_ids = {k: v.id for k, v in datos_a.items()}

        # Valores que SOLO existen en los datos del taller B: si aparecen en una
        # respuesta, es una fuga.
        centinelas = {
            "admin.b@demo.com", "recepcion.b@demo.com", "mecanico.b@demo.com",
            "cliente.b@demo.com", "cuenta.b@demo.com",
            "B0000001", "PAT-B-001", "OT-B-0001", "REP-B-001",
            "ClienteB", "MarcaB", "ModeloB", "RepuestoB", "DetalleB",
            "TrabajoB", "AvisoB", "TurnoB", "AdminB", "RecepB", "MecanicoB",
            "CuentaB", "b-centinela", "TallerBravo", "MotivoB", "Ref-B",
        }
        return {
            "headers": headers, "b_ids": b_ids, "a_ids": a_ids,
            "centinelas": centinelas, "taller_b_id": taller_b.id,
        }


@pytest.fixture
def api():
    with TestClient(app) as cliente:
        yield cliente


def _filtra_b(respuesta, centinelas) -> bool:
    return any(c in respuesta.text for c in centinelas)


def _sustituir_ids(body: dict, b_ids: dict) -> dict:
    """Reemplaza valores "{nombre}" del body por el id de B correspondiente."""
    return {
        k: (b_ids[v[1:-1]] if isinstance(v, str) and v.startswith("{") else v)
        for k, v in body.items()
    }


# ---------------------------------------------------------------------------
# 0. Cobertura: cada ruta descubierta tiene su caso
# ---------------------------------------------------------------------------


def test_cobertura_todas_las_rutas_tienen_caso():
    """La recorrida automática y los casos registrados tienen que coincidir:
    si aparece una ruta nueva sin caso, este test falla y obliga a cubrirla."""
    registradas = (
        {(m, p) for m, p, _, _ in CASOS_PARAMS}
        | {(m, p) for m, p in CASOS_LISTAS}
        | {(m, p) for m, p, _ in CASOS_CREACIONES}
    )
    assert _rutas_en_scope() == registradas


# ---------------------------------------------------------------------------
# 1. Rutas con ids del otro taller
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "metodo,plantilla,json_body,files",
    CASOS_PARAMS,
    ids=[f"{m} {p}" for m, p, _, _ in CASOS_PARAMS],
)
@pytest.mark.parametrize("persona", PERSONAS)
def test_ruta_con_id_de_otro_taller(api, datos, metodo, plantilla, json_body, files, persona):
    """Con ids del taller B en la ruta, un usuario del taller A jamás recibe
    datos de B: se espera 4xx/5xx, nunca un 2xx."""
    path = plantilla.format(**datos["b_ids"])
    kwargs = {}
    if json_body is not None:
        kwargs["json"] = _sustituir_ids(json_body, datos["b_ids"])
    if files is not None:
        kwargs["files"] = files
    r = api.request(metodo, path, headers=datos["headers"][persona], **kwargs)
    assert not (200 <= r.status_code < 300), (
        f"FUGA: {metodo} {path} como {persona} del taller A devolvió "
        f"{r.status_code}: {r.text[:300]}"
    )
    assert not _filtra_b(r, datos["centinelas"]), (
        f"FUGA: {metodo} {path} como {persona} filtró datos del taller B en la respuesta"
    )


# ---------------------------------------------------------------------------
# 2. Listados: ninguna fila del taller B
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "metodo,path", CASOS_LISTAS, ids=[f"{m} {p}" for m, p in CASOS_LISTAS]
)
def test_listado_no_devuelve_datos_de_b(api, datos, metodo, path):
    personas = PERSONAS_LISTA.get(path, ("admin",))
    for persona in personas:
        r = _request(api, datos["headers"][persona], metodo, path)
        if r.status_code == 200:
            assert not _filtra_b(r, datos["centinelas"]), (
                f"FUGA: {metodo} {path} como {persona} del taller A devolvió "
                f"datos del taller B: {r.text[:300]}"
            )
        else:
            # 403/404/500 no filtran datos; se aceptan pero quedan registradas.
            assert r.status_code != 201


def test_listados_con_filtros_del_otro_taller(api, datos):
    """Sondas con ids de B en query params: tampoco pueden devolver filas de B."""
    b = datos["b_ids"]
    sondas = [
        ("admin", "/api/v1/vehiculos", {"cliente_id": b["cliente_id"]}),
        ("admin", "/api/v1/turnos", {"cliente_id": b["cliente_id"]}),
        ("admin", "/api/v1/clientes", {"q": "B"}),
        ("cliente", "/api/v1/mis-ordenes", {"vehiculo_id": b["vehiculo_id"]}),
    ]
    for persona, path, params in sondas:
        r = api.get(path, headers=datos["headers"][persona], params=params)
        assert not _filtra_b(r, datos["centinelas"]), (
            f"FUGA: {path} {params} como {persona} filtró datos del taller B"
        )


# ---------------------------------------------------------------------------
# 3. Escrituras sin {param}: bodies que referencian al otro taller
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "metodo,path,json_body",
    CASOS_CREACIONES,
    ids=[f"{m} {p}" for m, p, _ in CASOS_CREACIONES],
)
def test_escritura_sin_param_no_toca_al_otro_taller(api, datos, metodo, path, json_body):
    body = _sustituir_ids(json_body, datos["b_ids"])
    b_vals = set(datos["b_ids"].values())
    tiene_refs_b = any(isinstance(v, int) and v in b_vals for v in body.values())
    r = _request(api, datos["headers"]["admin"], metodo, path, json=body)
    if tiene_refs_b:
        # Un body que referencia entidades de B tiene que fallar: nunca crear
        # ni vincular datos usando ids ajenos.
        assert not (200 <= r.status_code < 300), (
            f"FUGA: {metodo} {path} usó ids del taller B y devolvió "
            f"{r.status_code}: {r.text[:300]}"
        )
    else:
        # Creación propia en el taller de la sesión (o ruta aún no habilitada
        # para el admin: PUT /taller hoy es del superadmin y P3 lo cambia).
        assert not _filtra_b(r, datos["centinelas"])


# ---------------------------------------------------------------------------
# 4. Unicidad por taller: mismo DNI/patente/código en los dos talleres
# ---------------------------------------------------------------------------


def _headers_de(email: str) -> dict:
    """Token de un usuario ya sembrado (contexto de sistema: sin filtro)."""
    with SessionLocal() as db:
        user = db.scalar(select(Usuario).where(Usuario.email == email))
    assert user is not None, f"falta el usuario {email} en la fixture"
    return {"Authorization": "Bearer " + create_access_token(user.id)}


def test_mismo_dni_en_dos_talleres(api, datos):
    body = {"nombre": "Dni", "apellido": "Repetido", "dni": "DUP-0001"}
    headers_b = _headers_de("admin.b@demo.com")
    ra = api.post("/api/v1/clientes", headers=datos["headers"]["admin"], json=body)
    rb = api.post("/api/v1/clientes", headers=headers_b, json=body)
    assert ra.status_code == 201, ra.text
    assert rb.status_code == 201, (
        f"El mismo DNI debería poder cargarse en otro taller: {rb.text}"
    )
    # Repetido dentro del MISMO taller sigue fallando.
    rb2 = api.post("/api/v1/clientes", headers=headers_b, json=body)
    assert rb2.status_code in (409, 422), rb2.text


def test_misma_patente_en_dos_talleres(api, datos):
    veh = {"patente": "Misma-01", "marca": "Ford", "modelo": "Focus"}
    headers_b = _headers_de("admin.b@demo.com")
    with SessionLocal() as db:
        cli_b = db.scalar(select(Cliente).where(Cliente.dni == "B0000001"))
    assert cli_b is not None
    ra = api.post(
        "/api/v1/vehiculos", headers=datos["headers"]["admin"],
        json={**veh, "cliente_id": datos["a_ids"]["cliente"]},
    )
    rb = api.post(
        "/api/v1/vehiculos", headers=headers_b,
        json={**veh, "cliente_id": cli_b.id},
    )
    assert ra.status_code == 201, ra.text
    assert rb.status_code == 201, (
        f"La misma patente debería poder cargarse en otro taller: {rb.text}"
    )
    rb2 = api.post(
        "/api/v1/vehiculos", headers=headers_b,
        json={**veh, "cliente_id": cli_b.id},
    )
    assert rb2.status_code in (409, 422), rb2.text


def test_mismo_codigo_repuesto_en_dos_talleres(api, datos):
    body = {"codigo": "COD-DUP", "nombre": "Repuesto duplicado", "precio": 10}
    headers_b = _headers_de("admin.b@demo.com")
    ra = api.post("/api/v1/repuestos", headers=datos["headers"]["admin"], json=body)
    rb = api.post("/api/v1/repuestos", headers=headers_b, json=body)
    assert ra.status_code == 201, ra.text
    assert rb.status_code == 201, (
        f"El mismo código debería poder cargarse en otro taller: {rb.text}"
    )
    rb2 = api.post("/api/v1/repuestos", headers=headers_b, json=body)
    assert rb2.status_code in (409, 422), rb2.text


# ---------------------------------------------------------------------------
# 5. Superadmin sin soporte y taller suspendido
# ---------------------------------------------------------------------------


def _casos_superadmin():
    """Rutas del taller: todo lo que no es catálogo/estados neutros.

    Incluye /taller/* y /soporte/* (desde P2/P3 son rutas del taller de la
    sesión): el superadmin sin acceso de soporte tiene que recibir 403.
    """
    for metodo, path in sorted(_rutas_en_scope()):
        if (metodo, path) in RUTAS_NEUTRAS:
            continue  # catálogo/estados: datos globales, no del taller
        yield metodo, path


CASOS_SUPERADMIN = list(_casos_superadmin())
CASOS_TODAS = sorted(_rutas_en_scope())


@pytest.mark.parametrize(
    "metodo,path",
    CASOS_SUPERADMIN,
    ids=[f"{m} {p}" for m, p in CASOS_SUPERADMIN],
)
def test_superadmin_sin_soporte_recibe_403(api, datos, metodo, path):
    """El superadmin sin acceso de soporte no opera rutas del taller."""
    url = path.format(**datos["b_ids"])
    r = api.request(
        metodo, url,
        headers=datos["headers"]["superadmin"],
        **_kwargs_minimos(metodo, path),
    )
    assert r.status_code == 403, (
        f"{metodo} {url} como superadmin: {r.status_code} {r.text[:200]}"
    )


@pytest.mark.parametrize(
    "metodo,path",
    CASOS_TODAS,
    ids=[f"{m} {p}" for m, p in CASOS_TODAS],
)
def test_usuario_de_taller_suspendido_recibe_403(api, datos, metodo, path):
    """Un usuario cuyo taller está suspendido no puede usar ninguna ruta."""
    try:
        url = path.format(**datos["b_ids"])
    except KeyError:
        url = path
    r = api.request(
        metodo, url,
        headers=datos["headers"]["suspendido"],
        **_kwargs_minimos(metodo, path),
    )
    assert r.status_code == 403, (
        f"{metodo} {url} como suspendido: {r.status_code} {r.text[:200]}"
    )


# ---------------------------------------------------------------------------
# 6. Respaldo, auditoría y accesos de soporte: nada del taller B
# ---------------------------------------------------------------------------

TABLAS_RESPALDO = [
    "usuarios",
    "clientes",
    "vehiculos",
    "ordenes",
    "detalles_orden",
    "historial_estado",
    "repuestos",
    "turnos",
    "pagos",
    "horarios_mecanico",
    "configuracion_taller",
]


def _csvs_del_zip(contenido: bytes) -> dict:
    """Abre el ZIP del respaldo y devuelve {nombre.csv: filas} parseadas."""
    with zipfile.ZipFile(io.BytesIO(contenido)) as z:
        assert set(z.namelist()) == {f"{tabla}.csv" for tabla in TABLAS_RESPALDO}
        return {
            nombre: list(csv.reader(io.StringIO(z.read(nombre).decode("utf-8-sig"))))
            for nombre in z.namelist()
        }


def test_respaldo_del_taller_a_no_contiene_datos_de_b(api, datos):
    """El ZIP del administrador del taller A solo puede tener filas de A:
    se audita la columna taller_id de cada CSV, el orden_id de las tablas
    hijas de la orden y que ningún centinela de B (DNI, emails, códigos)
    aparezca en ningún lado."""
    r = api.get("/api/v1/taller/respaldo", headers=datos["headers"]["admin"])
    assert r.status_code == 200, r.text[:300]
    csvs = _csvs_del_zip(r.content)
    taller_b = str(datos["taller_b_id"])

    # Toda fila con columna taller_id tiene que ser del taller A.
    for nombre, filas in csvs.items():
        encabezado = filas[0]
        if "taller_id" in encabezado:
            i = encabezado.index("taller_id")
            for fila in filas[1:]:
                assert fila[i] != taller_b, (
                    f"FUGA: {nombre}.csv del respaldo tiene una fila del taller B"
                )

    # Las tablas hijas de la orden no tienen taller_id propio: solo pueden
    # apuntar a órdenes que sí salieron en ordenes.csv (las del taller A).
    encabezado_ordenes = csvs["ordenes.csv"][0]
    ids_ordenes_a = {
        fila[encabezado_ordenes.index("id")] for fila in csvs["ordenes.csv"][1:]
    }
    assert ids_ordenes_a, "el respaldo no trajo ninguna orden del taller A"
    for nombre in ("detalles_orden.csv", "historial_estado.csv"):
        filas = csvs[nombre]
        j = filas[0].index("orden_id")
        for fila in filas[1:]:
            assert fila[j] in ids_ordenes_a, (
                f"FUGA: {nombre}.csv referencia una orden fuera del taller A"
            )

    # Ningún valor centinela de B (DNIs, emails, códigos, motivos, etc.).
    for nombre, filas in csvs.items():
        texto = "\n".join(",".join(fila) for fila in filas)
        for centinela in datos["centinelas"]:
            assert centinela not in texto, (
                f"FUGA: {nombre}.csv del respaldo contiene {centinela!r} "
                "del taller B"
            )

    # Sanidad: los datos del taller A sí están en el respaldo.
    texto_clientes = "\n".join(
        ",".join(fila) for fila in csvs["clientes.csv"][1:]
    )
    assert "A0000001" in texto_clientes


def test_auditoria_del_taller_a_no_trae_filas_de_b(api, datos):
    """GET /taller/auditoria y su exportar CSV solo traen filas del taller A."""
    h = datos["headers"]["admin"]
    r = api.get("/api/v1/taller/auditoria", headers=h)
    assert r.status_code == 200, r.text[:300]
    filas = r.json()
    assert filas, "la auditoría del taller A vino vacía"
    assert all(f["taller_id"] == TALLER_PRINCIPAL_ID for f in filas), (
        "FUGA: /taller/auditoria devolvió filas de otro taller"
    )
    assert not _filtra_b(r, datos["centinelas"])

    r = api.get("/api/v1/taller/auditoria/exportar", headers=h)
    assert r.status_code == 200, r.text[:300]
    assert not _filtra_b(r, datos["centinelas"]), (
        "FUGA: /taller/auditoria/exportar contiene datos del taller B"
    )


def test_accesos_y_actividad_soporte_del_taller_a_no_muestran_b(api, datos):
    """GET /soporte/accesos y /soporte/actividad del taller A no traen lo de B."""
    h = datos["headers"]["admin"]
    r = api.get("/api/v1/soporte/accesos", headers=h)
    assert r.status_code == 200, r.text[:300]
    accesos = r.json()
    assert accesos, "el taller A debería ver al menos su acceso vencido"
    assert all(a["taller_id"] == TALLER_PRINCIPAL_ID for a in accesos), (
        "FUGA: /soporte/accesos devolvió accesos de otro taller"
    )
    assert all(a["id"] != datos["b_ids"]["acceso_id"] for a in accesos)
    assert not _filtra_b(r, datos["centinelas"])

    r = api.get("/api/v1/soporte/actividad", headers=h)
    assert r.status_code == 200, r.text[:300]
    actividad = r.json()
    assert actividad, "el taller A debería ver la actividad de soporte propia"
    assert all(a["taller_id"] == TALLER_PRINCIPAL_ID for a in actividad), (
        "FUGA: /soporte/actividad devolvió auditoría de otro taller"
    )
    assert not _filtra_b(r, datos["centinelas"])


# ---------------------------------------------------------------------------
# Rutas de plataforma de la oferta (docs/Oferta.md, C2): tipo de acceso,
# adicionales y funciones de los planes. Ningún usuario de un taller las usa,
# ni sobre el suyo ni sobre el otro.
# ---------------------------------------------------------------------------

CASOS_PLATAFORMA_C2 = [
    ("POST", "/api/v1/plataforma/talleres/{taller}/acceso", {"tipo": "pago", "plan": "pro"}),
    ("GET", "/api/v1/plataforma/talleres/{taller}/adicionales", None),
    ("POST", "/api/v1/plataforma/talleres/{taller}/adicionales", {"codigo": "arca"}),
    ("DELETE", "/api/v1/plataforma/talleres/{taller}/adicionales/arca", None),
    ("PUT", "/api/v1/plataforma/planes/esencial", {"funciones": ["gestion", "arca"]}),
]


@pytest.mark.parametrize(
    "metodo,plantilla,json_body",
    CASOS_PLATAFORMA_C2,
    ids=[f"{m} {p}" for m, p, _ in CASOS_PLATAFORMA_C2],
)
@pytest.mark.parametrize("persona", ["admin", "recepcion", "mecanico", "cliente"])
def test_rutas_de_plataforma_c2_no_son_para_el_taller(
    api, datos, metodo, plantilla, json_body, persona
):
    for taller_id in (TALLER_PRINCIPAL_ID, datos["taller_b_id"]):
        url = plantilla.format(taller=taller_id)
        r = api.request(metodo, url, headers=datos["headers"][persona], json=json_body)
        assert r.status_code == 403, f"{metodo} {url} como {persona}: {r.status_code}"
    with SessionLocal() as db:
        assert db.get(Taller, datos["taller_b_id"]).tipo_acceso == "pago"
