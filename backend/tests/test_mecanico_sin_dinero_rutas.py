"""MC1c: red de seguridad para el mecánico sin dinero, por todas las rutas.

Decisión del dueño: el mecánico solo hace sus tareas y avisa qué repuestos
usó. No ve precios ni montos y no propone cobros.

Complementa a ``test_mecanico_sin_dinero`` (órdenes e historial): acá se
recorren automáticamente todas las rutas GET del API (sacadas de
``app.routes``, igual que ``test_aislamiento_talleres``) más las escrituras
que usa el mecánico (cargar una línea, cambiar la etapa, subir una foto), con
datos sembrados que sí tienen precios, costos, cobro y pagos. Si en el JSON de
una respuesta al mecánico aparece una clave de dinero con valor, el test
falla: una clave vacía (null, "" o []) no expone nada. Administración y
recepción siguen recibiendo todo.

Los casos del mecánico que hoy fallan están en ``xfail(strict=False)`` hasta
que MC1 y MC1b saquen el dinero de sus respuestas; después se saca la marca.
"""

import io
import re
from datetime import date, datetime

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.main import app
from app.models import (
    Cliente,
    DetalleOrden,
    Historial_estado,
    HorarioMecanico,
    ImagenOrden,
    Orden,
    Pago,
    PagoSuscripcion,
    Repuesto,
    Taller,
    Turno,
    Usuario,
    Vehiculo,
)
from app.models.notificacion import NotificacionInterna
from app.models.usuario import RolUsuario

XFAIL_MC1 = pytest.mark.xfail(strict=False, reason="lo cierran MC1 y MC1b")

# Una clave es "de dinero" si contiene alguna de estas palabras
# (precio_unitario, costo_estimado, monto_propuesto, subtotal, pagos...).
PALABRAS_DINERO = (
    "precio", "monto", "total", "subtotal", "costo", "presupuesto", "cobrado", "pagos",
)

# Mismo recorte que test_aislamiento_talleres: plataforma, auth, la landing
# pública y términos no son rutas del taller.
PREFIJOS_EXCLUIDOS = (
    "/api/v1/plataforma",
    "/api/v1/auth",
    "/api/v1/publico",
    "/api/v1/terminos",
)


def _jpeg() -> bytes:
    """Imagen válida para Pillow (como en test_imagenes)."""
    buf = io.BytesIO()
    Image.new("RGB", (64, 48), (180, 40, 40)).save(buf, format="JPEG")
    return buf.getvalue()


# ---------------------------------------------------------------------------
# Descubrimiento de rutas
# ---------------------------------------------------------------------------


def _walk_rutas(routes, prefijo=""):
    """Aplana app.routes: los _IncludedRouter de FastAPI 0.141 anidan routers."""
    for ruta in routes:
        if type(ruta).__name__ == "_IncludedRouter":
            ctx = ruta.include_context
            yield from _walk_rutas(ruta.original_router.routes, prefijo + ctx.prefix)
        elif hasattr(ruta, "path") and hasattr(ruta, "methods"):
            yield prefijo + ruta.path, ruta


def _rutas_get():
    rutas = set()
    for path, ruta in _walk_rutas(app.routes):
        if not path.startswith("/api/v1") or "/webhook" in path:
            continue
        if any(path.startswith(p) for p in PREFIJOS_EXCLUIDOS):
            continue
        if "GET" in ruta.methods:
            rutas.add(path)
    return sorted(rutas)


RUTAS_GET = _rutas_get()

# Rutas GET que todavía le devuelven dinero al mecánico: quedan en xfail hasta
# que MC1 cierre su parte (el resto ya tiene que pasar).
GET_PENDIENTES_MC1: set[str] = set()
CASOS_GET = [
    pytest.param(r, marks=XFAIL_MC1) if r in GET_PENDIENTES_MC1 else r for r in RUTAS_GET
]


def _params(path: str) -> list[str]:
    return re.findall(r"{(\w+)}", path)


# ---------------------------------------------------------------------------
# Búsqueda de claves de dinero con valor
# ---------------------------------------------------------------------------


def _es_clave_de_dinero(clave: str) -> bool:
    clave = clave.lower()
    return any(p in clave for p in PALABRAS_DINERO)


def _tiene_valor(valor) -> bool:
    """Una clave de dinero vacía (null, "", [] o {}) no expone nada: MC1 las
    deja así para el mecánico en vez de borrarlas. 0 sí es un valor."""
    return valor not in (None, "", [], {})


def _claves_de_dinero(valor, ruta="$") -> list[str]:
    """Rutas JSON (``$.pagos``, ``$[0].precio_unitario``) de cada clave de
    dinero que trae un valor."""
    encontradas = []
    if isinstance(valor, dict):
        for k, v in valor.items():
            if _es_clave_de_dinero(str(k)) and _tiene_valor(v):
                encontradas.append(f"{ruta}.{k}")
            encontradas.extend(_claves_de_dinero(v, f"{ruta}.{k}"))
    elif isinstance(valor, list):
        for i, v in enumerate(valor):
            encontradas.extend(_claves_de_dinero(v, f"{ruta}[{i}]"))
    return encontradas


def _dinero_en_respuesta(r) -> list[str]:
    tipo = r.headers.get("content-type", "")
    if "json" in tipo:
        return _claves_de_dinero(r.json())
    if "csv" in tipo:
        encabezado = r.text.splitlines()[0] if r.text else ""
        return [f"columna {c}" for c in re.split(r"[;,]", encabezado) if _es_clave_de_dinero(c)]
    return []


def test_buscador_de_claves_de_dinero():
    """El buscador en sí: recorre anidado, ignora claves vacías y no confunde
    claves sin dinero."""
    datos = {
        "id": 1,
        "estado": "listo",
        "pago_medio": "efectivo",
        "detalles": [{"descripcion": "x", "precio_unitario": "10.00"}],
        "orden": {"costo_final": 0, "pagos": [{"id": 1, "monto": "5"}]},
        "vacias": {"costo_estimado": None, "subtotal": "", "pagos": []},
    }
    assert sorted(_claves_de_dinero(datos)) == [
        "$.detalles[0].precio_unitario",
        "$.orden.costo_final",
        "$.orden.pagos",
        "$.orden.pagos[0].monto",
    ]
    assert _claves_de_dinero([{"nombre": "Aceite", "stock": 3}]) == []


# ---------------------------------------------------------------------------
# Datos: un taller con dinero en todos lados
# ---------------------------------------------------------------------------


@pytest.fixture
def datos(tmp_path, monkeypatch):
    # Las subidas escriben en un directorio descartable, no en uploads/ real.
    monkeypatch.setattr("app.api.v1.ordenes.service.UPLOADS_DIR", tmp_path)
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        db.get(Taller, 1).plan_codigo = "pro"
        pw = hash_password("Clave1234")
        admin = Usuario(nombre="Admin", apellido="Taller", email="admin@x.com",
                        password_hash=pw, rol=RolUsuario.administrador)
        recepcion = Usuario(nombre="Recep", apellido="Taller", email="recep@x.com",
                            password_hash=pw, rol=RolUsuario.recepcion)
        mecanico = Usuario(nombre="Mec", apellido="Uno", email="mec@x.com",
                           password_hash=pw, rol=RolUsuario.mecanico)
        cliente = Cliente(nombre="Juan", apellido="Perez", dni="10000001", email="juan@x.com")
        db.add_all([admin, recepcion, mecanico, cliente])
        db.flush()
        vehiculo = Vehiculo(cliente_id=cliente.id, patente="AAA111", marca="VW", modelo="Gol")
        repuesto = Repuesto(codigo="ACE-01", nombre="Aceite motor", stock=10,
                            stock_minimo=2, precio=150)
        db.add_all([vehiculo, repuesto])
        db.flush()
        # Orden en curso (para las escrituras) con presupuesto y una línea cotizada.
        trabajo = Orden(
            cliente_id=cliente.id, vehiculo_id=vehiculo.id, creado_por_id=admin.id,
            mecanico_id=mecanico.id, codigo="OT-1001", estado="en_diagnostico",
            descripcion_ingreso="Cambio de aceite y filtros", costo_estimado=25000,
        )
        # Orden terminada, con cobro aprobado y pagada.
        cobrada = Orden(
            cliente_id=cliente.id, vehiculo_id=vehiculo.id, creado_por_id=admin.id,
            mecanico_id=mecanico.id, codigo="OT-1002", estado="listo",
            descripcion_ingreso="Cambio de pastillas de freno", costo_estimado=40000,
            costo_final=42000, cobro_estado="aprobado", monto_propuesto=42000,
            cobro_propuesto_por_id=recepcion.id, cobro_aprobado_por_id=admin.id,
            cobro_aprobado_en=datetime(2026, 11, 1, 10, 0),
        )
        db.add_all([trabajo, cobrada])
        db.flush()
        detalle = DetalleOrden(orden_id=trabajo.id, repuesto_id=repuesto.id,
                               descripcion="Aceite motor", cantidad=1, precio_unitario=150)
        mano_de_obra = DetalleOrden(orden_id=cobrada.id, descripcion="Mano de obra",
                                    cantidad=1, precio_unitario=42000)
        historial = Historial_estado(orden_id=cobrada.id, usuario_id=admin.id,
                                     estado_anterior="en_diagnostico", estado_nuevo="listo",
                                     comentario="Terminado")
        imagen = ImagenOrden(orden_id=trabajo.id, url="/uploads/mc1c.png", usuario_id=mecanico.id)
        pago = Pago(orden_id=cobrada.id, monto=42000, estado="aprobado")
        turno = Turno(cliente_id=cliente.id, vehiculo_id=vehiculo.id,
                      registrado_por_id=recepcion.id, mecanico_id=mecanico.id,
                      fecha_hora=datetime(2026, 12, 1, 9, 0), estado="confirmado",
                      motivo="Service")
        horario = HorarioMecanico(mecanico_id=mecanico.id, dia_semana=0,
                                  hora_desde="08:00", hora_hasta="12:00")
        aviso = NotificacionInterna(taller_id=1, tipo=NotificacionInterna.TIPO_STOCK_BAJO,
                                    repuesto_id=repuesto.id,
                                    mensaje="Stock bajo: Aceite motor quedó en 1; mínimo 2")
        # Pago de la suscripción a Boxly: el mecánico tampoco ve su monto.
        pago_suscripcion = PagoSuscripcion(
            taller_id=1, monto=79000, periodo_desde=date(2026, 11, 1),
            periodo_hasta=date(2026, 11, 30), medio="manual", estado="aprobado",
            registrado_por_id=admin.id,
        )
        db.add_all([
            detalle, mano_de_obra, historial, imagen, pago, turno, horario, aviso,
            pago_suscripcion,
        ])
        db.commit()

        # Nombre de path-param -> id de una entidad propia del mecánico.
        ids = {
            "cliente_id": cliente.id,
            "vehiculo_id": vehiculo.id,
            "repuesto_id": repuesto.id,
            "turno_id": turno.id,
            "orden_id": cobrada.id,
            "detalle_id": mano_de_obra.id,
            "imagen_id": imagen.id,
            "pago_id": pago.id,
            "user_id": mecanico.id,
            "mecanico_id": mecanico.id,
            "horario_id": horario.id,
            "aviso_id": aviso.id,
            "acceso_id": 1,
        }
        headers = {
            rol: {"Authorization": "Bearer " + create_access_token(u.id)}
            for rol, u in (("admin", admin), ("recepcion", recepcion), ("mecanico", mecanico))
        }
        return {
            "headers": headers, "ids": ids, "trabajo_id": trabajo.id,
            "repuesto_id": repuesto.id,
        }


@pytest.fixture
def api():
    with TestClient(app) as cliente:
        yield cliente


# ---------------------------------------------------------------------------
# 1. Todas las rutas GET
# ---------------------------------------------------------------------------


def test_cobertura_los_parametros_de_ruta_tienen_id():
    """Si aparece una ruta GET con un parámetro nuevo, hay que sembrar su id."""
    conocidos = {
        "cliente_id", "vehiculo_id", "repuesto_id", "turno_id", "orden_id",
        "detalle_id", "imagen_id", "pago_id", "user_id", "mecanico_id",
        "horario_id", "aviso_id", "acceso_id",
    }
    faltan = {(p, n) for p in RUTAS_GET for n in _params(p) if n not in conocidos}
    assert not faltan, f"Rutas GET con parámetros sin id sembrado: {sorted(faltan)}"


@pytest.mark.parametrize("plantilla", CASOS_GET)
def test_get_del_mecanico_sin_dinero(api, datos, plantilla):
    path = plantilla.format(**datos["ids"])
    r = api.get(path, headers=datos["headers"]["mecanico"])
    # Las rutas que el mecánico no puede usar no le devuelven nada.
    if r.status_code in (401, 403, 404):
        return
    assert r.status_code < 500, f"GET {path} explotó: {r.status_code} {r.text[:200]}"
    dinero = _dinero_en_respuesta(r)
    assert not dinero, f"GET {path} le devuelve dinero al mecánico: {dinero}"


def test_mecanico_recibe_la_suscripcion_sin_precios(api, datos):
    """Para los avisos de solo lectura le alcanza con estado, plan, fechas y
    funciones: los precios y montos van en null."""
    h = datos["headers"]["mecanico"]
    r = api.get("/api/v1/suscripcion", headers=h)
    assert r.status_code == 200, r.text
    cuerpo = r.json()
    assert cuerpo["estado"] and cuerpo["plan"]["codigo"] == "pro"
    assert cuerpo["plan"]["funciones"] and cuerpo["funciones_efectivas"]
    assert "vence_en" in cuerpo and "fin_acceso" in cuerpo
    assert cuerpo["plan"]["precio_mensual"] is None
    assert cuerpo["proximo_monto"] is None

    planes = api.get("/api/v1/suscripcion/planes", headers=h)
    assert planes.status_code == 200, planes.text
    assert planes.json() and all(p["precio_mensual"] is None for p in planes.json())

    pagos = api.get("/api/v1/suscripcion/pagos", headers=h)
    assert pagos.status_code == 200, pagos.text
    assert pagos.json() and all(p["monto"] is None for p in pagos.json())


# ---------------------------------------------------------------------------
# 2. Escrituras que usa el mecánico
# ---------------------------------------------------------------------------


def test_mecanico_carga_un_repuesto_sin_recibir_precio(api, datos):
    """Avisa qué repuesto usó: la respuesta no trae precio ni subtotal."""
    r = api.post(
        f"/api/v1/ordenes/{datos['trabajo_id']}/detalles",
        headers=datos["headers"]["mecanico"],
        json={"repuesto_id": datos["repuesto_id"], "cantidad": 1},
    )
    assert r.status_code == 201, r.text
    assert not _dinero_en_respuesta(r), _dinero_en_respuesta(r)


def test_mecanico_carga_mano_de_obra_sin_recibir_precio(api, datos):
    r = api.post(
        f"/api/v1/ordenes/{datos['trabajo_id']}/detalles",
        headers=datos["headers"]["mecanico"],
        json={"descripcion": "Cambio de filtro", "cantidad": 1},
    )
    assert r.status_code == 201, r.text
    assert not _dinero_en_respuesta(r), _dinero_en_respuesta(r)


def test_mecanico_cambia_la_etapa_sin_recibir_dinero(api, datos):
    r = api.patch(
        f"/api/v1/ordenes/{datos['trabajo_id']}",
        headers=datos["headers"]["mecanico"],
        json={
            "estado": "esperando_repuestos",
            "comentario_cambio": "Falta el filtro",
            "diagnostico": "Falta el filtro",
        },
    )
    assert r.status_code == 200, r.text
    assert not _dinero_en_respuesta(r), _dinero_en_respuesta(r)


def test_mecanico_sube_una_foto_sin_recibir_dinero(api, datos):
    r = api.post(
        f"/api/v1/ordenes/{datos['trabajo_id']}/imagenes",
        headers=datos["headers"]["mecanico"],
        files={"archivo": ("foto.jpg", _jpeg(), "image/jpeg")},
    )
    assert r.status_code == 201, r.text
    assert not _dinero_en_respuesta(r), _dinero_en_respuesta(r)


# ---------------------------------------------------------------------------
# 3. El mecánico no propone cobros ni carga montos
# ---------------------------------------------------------------------------


def test_mecanico_no_emite_cobro(api, datos):
    r = api.post(
        f"/api/v1/ordenes/{datos['ids']['orden_id']}/cobro",
        headers=datos["headers"]["mecanico"],
        json={"monto": "50000"},
    )
    assert r.status_code == 403, r.text


def test_mecanico_no_aprueba_cobro(api, datos):
    r = api.post(
        f"/api/v1/ordenes/{datos['ids']['orden_id']}/cobro/aprobar",
        headers=datos["headers"]["mecanico"],
        json={"monto": "50000"},
    )
    assert r.status_code == 403, r.text


def test_mecanico_no_carga_precio_en_una_linea(api, datos):
    r = api.post(
        f"/api/v1/ordenes/{datos['trabajo_id']}/detalles",
        headers=datos["headers"]["mecanico"],
        json={"descripcion": "Mano de obra", "cantidad": 1, "precio_unitario": 9000},
    )
    assert r.status_code == 403, r.text


def test_mecanico_no_cotiza_una_linea(api, datos):
    r = api.patch(
        f"/api/v1/ordenes/{datos['ids']['orden_id']}/detalles/{datos['ids']['detalle_id']}",
        headers=datos["headers"]["mecanico"],
        json={"precio_unitario": 1},
    )
    assert r.status_code == 403, r.text


def test_mecanico_no_fija_el_costo_final(api, datos):
    r = api.patch(
        f"/api/v1/ordenes/{datos['trabajo_id']}",
        headers=datos["headers"]["mecanico"],
        json={"costo_final": "99999"},
    )
    assert r.status_code == 403, r.text


def test_mecanico_no_propone_presupuesto(api, datos):
    """El presupuesto (costo_estimado) es una propuesta de cobro al cliente:
    el PATCH de la orden se lo rechaza al mecánico con 403."""
    r = api.patch(
        f"/api/v1/ordenes/{datos['trabajo_id']}",
        headers=datos["headers"]["mecanico"],
        json={"costo_estimado": "1"},
    )
    assert r.status_code == 403, r.text


# ---------------------------------------------------------------------------
# 4. Administración y recepción siguen recibiendo todo
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("rol", ["admin", "recepcion"])
def test_personal_de_mostrador_recibe_el_dinero(api, datos, rol):
    h = datos["headers"][rol]
    ids = datos["ids"]

    orden = api.get(f"/api/v1/ordenes/{ids['orden_id']}", headers=h)
    assert orden.status_code == 200, orden.text
    cuerpo = orden.json()
    assert cuerpo["costo_estimado"] is not None
    assert cuerpo["costo_final"] is not None
    assert cuerpo["monto_propuesto"] is not None
    assert [p["monto"] for p in cuerpo["pagos"]], "sin los pagos de la orden"

    detalles = api.get(f"/api/v1/ordenes/{ids['orden_id']}/detalles", headers=h)
    assert detalles.status_code == 200, detalles.text
    assert detalles.json()[0]["precio_unitario"] is not None
    assert detalles.json()[0]["subtotal"] is not None

    repuesto = api.get(f"/api/v1/repuestos/{ids['repuesto_id']}", headers=h)
    assert repuesto.status_code == 200, repuesto.text
    assert repuesto.json()["precio"] is not None

    linea = api.post(
        f"/api/v1/ordenes/{datos['trabajo_id']}/detalles", headers=h,
        json={"repuesto_id": ids["repuesto_id"], "cantidad": 1},
    )
    assert linea.status_code == 201, linea.text
    assert linea.json()["precio_unitario"] is not None

    suscripcion = api.get("/api/v1/suscripcion", headers=h)
    assert suscripcion.status_code == 200, suscripcion.text
    assert suscripcion.json()["plan"]["precio_mensual"] is not None
    assert suscripcion.json()["proximo_monto"] is not None
    planes = api.get("/api/v1/suscripcion/planes", headers=h)
    assert all(p["precio_mensual"] is not None for p in planes.json())
