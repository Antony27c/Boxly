"""Caminos críticos de suscripción, webhook, personal y mecánico (tarea Q2).

Complementa test_suscripciones.py y test_suscripcion_mp.py con tests que miran el
contenido (no solo el código HTTP) y el estado de la base después de cada request.
Contrato: docs/Suscripciones.md. Los códigos de plan no se escriben a mano: se leen
de la tabla ``planes`` (el catálogo de planes está cambiando en paralelo).
"""

import threading
from datetime import date, timedelta
from decimal import Decimal
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.api.v1.suscripcion_mp import cliente_mp
from app.api.v1.suscripcion_mp import service as mp_service
from app.api.v1.users import service as users_service
from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.main import app
from app.models import (
    Cliente,
    DetalleOrden,
    Orden,
    Pago,
    PagoSuscripcion,
    Plan,
    Taller,
    Usuario,
    Vehiculo,
)
from app.models.usuario import RolUsuario

PASSWORD = "Clave1234"
MSG_LECTURA = "El taller está en solo lectura por falta de pago de la suscripción"
MSG_VENCIDA = "La suscripción del taller está vencida"
MSG_SIN_PERMISO = "No tenés permisos para esta acción"
ROLES_PERSONAL = (RolUsuario.administrador, RolUsuario.recepcion, RolUsuario.mecanico)

# Días desde el vencimiento que caen en cada estado (docs/Suscripciones.md).
VENCIDO_HACE = {"al_dia": -10, "gracia": 3, "solo_lectura": 10, "suspendida": 40}


# --- Datos ---------------------------------------------------------------------


def _usuario(nombre, email, rol, taller_id=None, **extra):
    return Usuario(
        nombre=nombre,
        apellido="Prueba",
        email=email,
        password_hash=hash_password(PASSWORD),
        rol=rol,
        taller_id=taller_id,
        activo=True,
        **extra,
    )


def _planes_con_limite(db):
    """Planes activos con límite de personal, del más chico al más grande."""
    return list(
        db.scalars(
            select(Plan)
            .where(Plan.activo.is_(True), Plan.max_personal.is_not(None))
            .order_by(Plan.max_personal, Plan.codigo)
        )
    )


@pytest.fixture
def datos():
    """Taller 1 en el plan con límite más chico y taller 2 en otro plan.

    Taller 1: admin, recepción, mecánico, una cuenta de cliente con una orden lista
    y con el cobro emitido (pagable online) y otra orden del mecánico con una línea
    con precio. Taller 2: admin y recepción. Más un superadmin.
    """
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    hoy = date.today()
    with SessionLocal() as db:
        planes = _planes_con_limite(db)
        assert len(planes) >= 2, "Se necesitan al menos dos planes con límite"
        plan1, plan2 = planes[0], planes[1]

        taller1 = db.get(Taller, 1)
        taller1.plan_codigo = plan1.codigo
        taller1.suscripcion_vence_en = hoy + timedelta(days=10)
        taller2 = Taller(nombre="Taller Dos", plan_codigo=plan2.codigo)
        db.add(taller2)
        db.flush()
        taller2.suscripcion_vence_en = hoy + timedelta(days=20)

        sa = _usuario("Super", "sa@x.com", RolUsuario.superadmin)
        admin = _usuario("Admin", "admin@x.com", RolUsuario.administrador)
        recep = _usuario("Recep", "recep@x.com", RolUsuario.recepcion)
        mec = _usuario("Mec", "mec@x.com", RolUsuario.mecanico)
        admin2 = _usuario("Admin2", "admin2@x.com", RolUsuario.administrador, taller2.id)
        recep2 = _usuario("Recep2", "recep2@x.com", RolUsuario.recepcion, taller2.id)
        cliente = Cliente(nombre="Juan", apellido="Perez", dni="10000001", email="juan@x.com")
        db.add_all([sa, admin, recep, mec, admin2, recep2, cliente])
        db.flush()

        cuenta = _usuario("Juan", "cuenta@x.com", RolUsuario.cliente, cliente_id=cliente.id)
        vehiculo = Vehiculo(cliente_id=cliente.id, patente="AAA111", marca="VW", modelo="Gol")
        db.add_all([cuenta, vehiculo])
        db.flush()

        # Orden lista con el cobro emitido: el cliente la puede pagar online.
        pagable = Orden(
            cliente_id=cliente.id,
            vehiculo_id=vehiculo.id,
            creado_por_id=recep.id,
            mecanico_id=mec.id,
            codigo="OT-9001",
            estado="listo",
            descripcion_ingreso="Service",
            costo_final=Decimal("15000.00"),
            cobro_estado="aprobado",
        )
        # Orden del mecánico, lista, con una línea con precio y sin cobro.
        del_mecanico = Orden(
            cliente_id=cliente.id,
            vehiculo_id=vehiculo.id,
            creado_por_id=recep.id,
            mecanico_id=mec.id,
            codigo="OT-9002",
            estado="listo",
            descripcion_ingreso="Frenos",
        )
        db.add_all([pagable, del_mecanico])
        db.flush()
        linea = DetalleOrden(
            orden_id=del_mecanico.id, descripcion="Pastillas", cantidad=1, precio_unitario=Decimal("20000.00")
        )
        db.add(linea)
        db.commit()

        usuarios = {
            "sa": sa,
            "admin": admin,
            "recepcion": recep,
            "mecanico": mec,
            "admin2": admin2,
            "recepcion2": recep2,
            "cuenta": cuenta,
        }
        return {
            "headers": {
                clave: {"Authorization": "Bearer " + create_access_token(u.id)}
                for clave, u in usuarios.items()
            },
            "taller2": taller2.id,
            "plan1": plan1.codigo,
            "plan2": plan2.codigo,
            "orden_pagable": pagable.id,
            "orden_mecanico": del_mecanico.id,
            "linea": linea.id,
        }


@pytest.fixture
def api():
    with TestClient(app) as cliente:
        yield cliente


def _estado(taller_id: int, estado: str) -> None:
    """Deja el taller en el estado de suscripción pedido moviendo el vencimiento."""
    with SessionLocal() as db:
        taller = db.get(Taller, taller_id)
        taller.suscripcion_vence_en = date.today() - timedelta(days=VENCIDO_HACE[estado])
        db.commit()


def _fila(modelo, id_):
    with SessionLocal() as db:
        return db.get(modelo, id_)


def _personal_activo(taller_id: int) -> int:
    with SessionLocal() as db:
        return len(
            db.scalars(
                select(Usuario.id).where(
                    Usuario.taller_id == taller_id,
                    Usuario.rol.in_(ROLES_PERSONAL),
                    Usuario.activo.is_(True),
                )
            ).all()
        )


def _body_usuario(email, rol="mecanico"):
    return {"nombre": "Nuevo", "apellido": "User", "email": email, "password": PASSWORD, "rol": rol}


# --- 1. Bloqueo por suscripción para el rol cliente -----------------------------


@pytest.mark.parametrize("estado", ["al_dia", "gracia"])
def test_cliente_con_taller_al_dia_o_en_gracia_lee_y_puede_iniciar_el_pago(api, datos, estado):
    _estado(1, estado)
    h = datos["headers"]["cuenta"]
    orden = datos["orden_pagable"]

    r = api.get(f"/api/v1/mis-ordenes/{orden}", headers=h)
    assert r.status_code == 200
    assert r.json()["puede_pagar"] is True

    # El pago puede fallar por otra razón (sin Mercado Pago configurado en tests),
    # pero nunca por la suscripción.
    r = api.post(f"/api/v1/pagos/ordenes/{orden}", headers=h)
    assert r.json().get("detail") not in (MSG_LECTURA, MSG_VENCIDA)


def test_cliente_en_solo_lectura_lee_su_portal_pero_no_inicia_un_pago(api, datos):
    _estado(1, "solo_lectura")
    h = datos["headers"]["cuenta"]
    orden = datos["orden_pagable"]

    lista = api.get("/api/v1/mis-ordenes", headers=h)
    assert lista.status_code == 200
    assert {o["id"] for o in lista.json()} == {orden, datos["orden_mecanico"]}
    detalle = api.get(f"/api/v1/mis-ordenes/{orden}", headers=h)
    assert detalle.status_code == 200
    assert detalle.json()["codigo"] == "OT-9001"
    assert api.get("/api/v1/auth/me", headers=h).json()["email"] == "cuenta@x.com"

    r = api.post(f"/api/v1/pagos/ordenes/{orden}", headers=h)
    assert r.status_code == 403
    assert r.json()["detail"] == MSG_LECTURA
    with SessionLocal() as db:
        assert db.scalars(select(Pago).where(Pago.orden_id == orden)).all() == []


def test_cliente_con_suscripcion_suspendida_no_entra_a_nada_pero_el_login_anda(api, datos):
    """Contrato: en ``suspendida`` todo da 403, salvo el ADMINISTRADOR en
    /suscripcion*, /auth* y /terminos*. El login funciona para todos, pero el
    cliente no ve ni paga nada del taller.

    /auth* queda afuera a propósito: dependencies.py lo deja libre para todos los
    roles (si no, el frontend desloguea en cada recarga) y solo devuelve los datos
    del propio usuario, nunca del taller."""
    _estado(1, "suspendida")
    h = datos["headers"]["cuenta"]

    login = api.post("/api/v1/auth/login", json={"email": "cuenta@x.com", "password": PASSWORD})
    assert login.status_code == 200
    for ruta in (
        "/api/v1/mis-ordenes",
        f"/api/v1/mis-ordenes/{datos['orden_pagable']}",
        "/api/v1/mis-vehiculos",
    ):
        r = api.get(ruta, headers=h)
        assert r.status_code == 403, ruta
        assert r.json()["detail"] == MSG_VENCIDA, ruta
    r = api.post(f"/api/v1/pagos/ordenes/{datos['orden_pagable']}", headers=h)
    assert r.status_code == 403
    assert r.json()["detail"] == MSG_VENCIDA

    # El administrador del mismo taller sí ve su suscripción para poder pagarla.
    s = api.get("/api/v1/suscripcion", headers=datos["headers"]["admin"])
    assert s.status_code == 200
    assert s.json()["estado"] == "suspendida"


# --- 2. Webhook de suscripción con un taller desconocido -------------------------


def _settings_mp(monkeypatch):
    fake = SimpleNamespace(
        debug=True,
        environment="dev",
        boxly_mp_access_token="tok-boxly",
        boxly_mp_webhook_secret=None,
        frontend_url="http://front.test",
        backend_public_url=None,
    )
    monkeypatch.setattr(mp_service, "get_settings", lambda: fake)


def _foto_talleres():
    """Todas las columnas de todos los talleres, para comparar antes y después."""
    with SessionLocal() as db:
        talleres = db.scalars(select(Taller).order_by(Taller.id)).all()
        return [{col.name: getattr(t, col.key) for col in Taller.__table__.columns} for t in talleres]


def _cantidad_pagos_suscripcion():
    with SessionLocal() as db:
        return len(db.scalars(select(PagoSuscripcion.id)).all())


COBRO_APROBADO = {
    "status": "processed",
    "payment": {"id": 777001, "status": "approved", "transaction_amount": 35000.0},
}


@pytest.mark.parametrize(
    "tipo,info",
    [
        # Cobro de una preapproval que ningún taller tiene, sin referencia.
        ("authorized_payment", {"id": 1, "preapproval_id": "pre-fantasma", **COBRO_APROBADO}),
        # Cobro con una referencia a un taller que no existe.
        (
            "authorized_payment",
            {"id": 2, "preapproval_id": "pre-fantasma", "external_reference": "taller-999", **COBRO_APROBADO},
        ),
        # Referencias mal formadas.
        ("authorized_payment", {"id": 3, "external_reference": "taller-abc", **COBRO_APROBADO}),
        ("authorized_payment", {"id": 4, "external_reference": "otro-1", **COBRO_APROBADO}),
        # Alta de preapproval de un taller que no existe.
        ("preapproval", {"id": "pre-fantasma", "status": "authorized", "external_reference": "taller-999"}),
        ("preapproval", {"id": "pre-fantasma", "status": "authorized"}),
    ],
)
def test_webhook_de_taller_desconocido_no_deja_filas_ni_toca_talleres(
    api,
    datos,
    monkeypatch,
    tipo,
    info,
):
    _settings_mp(monkeypatch)
    llamadas = []

    def consultar(*args, **kwargs):
        llamadas.append(args)
        return info

    monkeypatch.setattr(cliente_mp, "obtener_pago_autorizado", consultar)
    monkeypatch.setattr(cliente_mp, "obtener_preapproval", consultar)
    with SessionLocal() as db:
        db.get(Taller, 1).mp_preapproval_id = "pre-real-1"
        db.commit()
    antes = _foto_talleres()

    r = api.post("/api/v1/suscripcion/webhook", json={"type": tipo, "data": {"id": "12345"}})

    assert llamadas, "el webhook tenía que consultar a Mercado Pago"
    # Misma respuesta que con un taller conocido: no revela si el taller existe.
    assert r.status_code == 200
    assert r.json() == {"detail": "ok"}
    assert "999" not in r.text and "taller" not in r.text.lower()
    assert _cantidad_pagos_suscripcion() == 0
    assert _foto_talleres() == antes


def test_webhook_de_taller_conocido_responde_igual_que_el_desconocido(api, datos, monkeypatch):
    """Control del test anterior: con un taller real el cuerpo es el mismo, así
    que la respuesta no sirve para adivinar talleres."""
    _settings_mp(monkeypatch)
    monkeypatch.setattr(
        cliente_mp,
        "obtener_pago_autorizado",
        lambda *a, **k: {"id": 5, "preapproval_id": "pre-real-1", **COBRO_APROBADO},
    )
    with SessionLocal() as db:
        db.get(Taller, 1).mp_preapproval_id = "pre-real-1"
        db.commit()

    r = api.post("/api/v1/suscripcion/webhook", json={"type": "authorized_payment", "data": {"id": "12345"}})

    assert r.status_code == 200
    assert r.json() == {"detail": "ok"}
    assert _cantidad_pagos_suscripcion() == 1


# --- 3. Roles de las rutas de suscripción, con contenido -------------------------


def _suscripcion_esperada(taller_id: int) -> dict:
    with SessionLocal() as db:
        taller = db.get(Taller, taller_id)
        plan = db.get(Plan, taller.plan_codigo)
        return {
            "plan_codigo": plan.codigo,
            "plan_nombre": plan.nombre,
            "max_personal": plan.max_personal,
            "vence_en": taller.suscripcion_vence_en.isoformat(),
            "dias_para_vencer": (taller.suscripcion_vence_en - date.today()).days,
        }


@pytest.mark.parametrize(
    "rol,taller",
    [
        ("recepcion", 1),
        ("mecanico", 1),
        ("admin", 1),
        ("admin2", "taller2"),
        ("recepcion2", "taller2"),
    ],
)
def test_cada_rol_del_personal_ve_la_suscripcion_de_su_taller(api, datos, rol, taller):
    taller_id = datos["taller2"] if taller == "taller2" else 1
    esperado = _suscripcion_esperada(taller_id)

    r = api.get("/api/v1/suscripcion", headers=datos["headers"][rol])

    assert r.status_code == 200
    s = r.json()
    assert s["plan"]["codigo"] == esperado["plan_codigo"]
    assert s["plan"]["nombre"] == esperado["plan_nombre"]
    assert s["max_personal"] == esperado["max_personal"]
    assert s["vence_en"] == esperado["vence_en"]
    assert s["dias_para_vencer"] == esperado["dias_para_vencer"]
    assert s["estado"] == "al_dia"
    assert s["personal_activo"] == _personal_activo(taller_id)


def test_los_planes_del_taller_son_solo_los_activos(api, datos):
    with SessionLocal() as db:
        db.get(Plan, datos["plan2"]).activo = False
        db.commit()
        activos = set(db.scalars(select(Plan.codigo).where(Plan.activo.is_(True))))

    r = api.get("/api/v1/suscripcion/planes", headers=datos["headers"]["recepcion"])

    assert r.status_code == 200
    codigos = {p["codigo"] for p in r.json()}
    assert codigos == activos
    assert datos["plan2"] not in codigos


def _pago(taller_id, monto, referencia, mp_payment_id=None):
    hoy = date.today()
    return PagoSuscripcion(
        taller_id=taller_id,
        monto=Decimal(monto),
        periodo_desde=hoy,
        periodo_hasta=hoy + timedelta(days=29),
        medio="manual",
        estado="aprobado",
        referencia=referencia,
        mp_payment_id=mp_payment_id,
    )


def test_los_pagos_de_suscripcion_son_solo_del_propio_taller(api, datos):
    with SessionLocal() as db:
        propio = _pago(1, "35000.00", "transferencia-taller-1")
        ajeno = _pago(datos["taller2"], "79000.00", "transferencia-taller-2", "mp-ajeno")
        db.add_all([propio, ajeno])
        db.commit()
        propio_id, ajeno_id = propio.id, ajeno.id

    for rol in ("admin", "recepcion", "mecanico"):
        r = api.get("/api/v1/suscripcion/pagos", headers=datos["headers"][rol])
        assert r.status_code == 200, rol
        pagos = r.json()
        assert [p["id"] for p in pagos] == [propio_id], rol
        # El mecánico no recibe montos (MC1); administración y recepción sí.
        esperado = None if rol == "mecanico" else "35000.00"
        assert pagos[0]["monto"] == esperado, rol
        assert pagos[0]["referencia"] == "transferencia-taller-1"
        # El contrato deja afuera taller_id y mp_payment_id.
        assert "taller_id" not in pagos[0] and "mp_payment_id" not in pagos[0]

    r = api.get("/api/v1/suscripcion/pagos", headers=datos["headers"]["admin2"])
    assert [p["id"] for p in r.json()] == [ajeno_id]
    assert "mp-ajeno" not in r.text


def test_recepcion_no_cambia_el_plan_y_el_plan_queda_igual(api, datos):
    r = api.put(
        "/api/v1/suscripcion/plan", headers=datos["headers"]["recepcion"], json={"plan": datos["plan2"]}
    )

    assert r.status_code == 403
    assert r.json()["detail"] == MSG_SIN_PERMISO
    assert _fila(Taller, 1).plan_codigo == datos["plan1"]


def test_cliente_y_superadmin_no_tienen_suscripcion_de_taller(api, datos):
    for rol in ("cuenta", "sa"):
        r = api.get("/api/v1/suscripcion", headers=datos["headers"][rol])
        assert r.status_code == 403, rol
        assert r.json()["detail"] == MSG_SIN_PERMISO, rol
        assert "plan" not in r.json()


def test_la_plataforma_ve_la_suscripcion_y_los_pagos_del_taller_pedido(api, datos):
    with SessionLocal() as db:
        db.add_all([_pago(1, "35000.00", "t1"), _pago(datos["taller2"], "79000.00", "t2")])
        db.commit()

    r = api.get(f"/api/v1/plataforma/talleres/{datos['taller2']}/suscripcion", headers=datos["headers"]["sa"])

    assert r.status_code == 200
    d = r.json()
    assert d["plan"]["codigo"] == datos["plan2"]
    assert [p["referencia"] for p in d["pagos"]] == ["t2"]
    assert d["personal_activo"] == _personal_activo(datos["taller2"])


# --- 4. Límite de personal en carrera --------------------------------------------


def _dejar_un_lugar(taller_id: int) -> int:
    """Ajusta el límite del plan del taller para que quede exactamente un lugar."""
    ocupados = _personal_activo(taller_id)
    with SessionLocal() as db:
        taller = db.get(Taller, taller_id)
        db.get(Plan, taller.plan_codigo).max_personal = ocupados + 1
        db.commit()
    return ocupados + 1


def test_limite_de_personal_en_secuencia_con_un_lugar(api, datos):
    limite = _dejar_un_lugar(1)
    h = datos["headers"]["admin"]

    primero = api.post("/api/v1/users", headers=h, json=_body_usuario("uno@x.com"))
    segundo = api.post("/api/v1/users", headers=h, json=_body_usuario("dos@x.com"))

    assert primero.status_code == 201, primero.text
    assert segundo.status_code == 409
    assert segundo.json()["detail"] == (
        f"Tu plan permite hasta {limite} usuarios del personal. Pasá a un plan mayor para sumar más."
    )
    assert _personal_activo(1) == limite


def _en_paralelo(monkeypatch, pedidos):
    """Corre dos requests a la vez y devuelve sus respuestas.

    Con SQLite no hay concurrencia real entre escrituras (la base serializa los
    commits), pero la carrera es de "contar y después escribir". Para forzar el
    peor intercalado sin depender de la suerte, cada request espera en una
    barrera justo después de contar: sin lock, las dos cuentan antes de que
    ninguna escriba (lo que puede pasar en producción con dos workers). Con el
    lock del cupo, la segunda no llega a contar hasta que la primera commitea:
    la barrera vence (timeout corto) y la primera sigue sola.
    """
    barrera = threading.Barrier(2, timeout=2)
    contar_original = users_service.personal_activo

    def contar_y_esperar(db, taller_id):
        cantidad = contar_original(db, taller_id)
        try:
            barrera.wait()
        except threading.BrokenBarrierError:
            pass  # La otra request está esperando el lock: se sigue sola.
        return cantidad

    monkeypatch.setattr(users_service, "personal_activo", contar_y_esperar)
    respuestas = [None] * len(pedidos)

    def correr(i):
        respuestas[i] = pedidos[i]()

    hilos = [threading.Thread(target=correr, args=(i,)) for i in range(len(pedidos))]
    for hilo in hilos:
        hilo.start()
    for hilo in hilos:
        hilo.join(timeout=30)
    return respuestas


def test_limite_de_personal_con_dos_altas_en_paralelo(api, datos, monkeypatch):
    """Dos altas a la vez cuando queda un lugar: solo una puede entrar."""
    limite = _dejar_un_lugar(1)
    h = datos["headers"]["admin"]

    respuestas = _en_paralelo(
        monkeypatch,
        [
            lambda: api.post("/api/v1/users", headers=h, json=_body_usuario("a@x.com")),
            lambda: api.post("/api/v1/users", headers=h, json=_body_usuario("b@x.com")),
        ],
    )

    codigos = sorted(r.status_code for r in respuestas)
    assert _personal_activo(1) == limite, f"personal fuera del límite: {codigos}"
    assert codigos == [201, 409]


def test_limite_de_personal_con_dos_reactivaciones_en_paralelo(api, datos, monkeypatch):
    """Reactivar pasa por el mismo control: con un lugar, solo una entra."""
    with SessionLocal() as db:
        inactivos = [_usuario("Inac", f"inac{i}@x.com", RolUsuario.mecanico, taller_id=1) for i in (1, 2)]
        for u in inactivos:
            u.activo = False
        db.add_all(inactivos)
        db.commit()
        ids = [u.id for u in inactivos]
    limite = _dejar_un_lugar(1)
    h = datos["headers"]["admin"]

    respuestas = _en_paralelo(
        monkeypatch,
        [lambda i=i: api.put(f"/api/v1/users/{i}", headers=h, json={"activo": True}) for i in ids],
    )

    codigos = sorted(r.status_code for r in respuestas)
    assert _personal_activo(1) == limite, f"personal fuera del límite: {codigos}"
    assert codigos == [200, 409]


# --- 5. El mecánico y las rutas nuevas --------------------------------------------


@pytest.mark.parametrize("estado", ["al_dia", "gracia"])
def test_el_mecanico_no_cotiza_ni_cobra(api, datos, estado):
    _estado(1, estado)
    h = datos["headers"]["mecanico"]
    orden, linea = datos["orden_mecanico"], datos["linea"]
    base = f"/api/v1/ordenes/{orden}"

    # La orden es suya: la puede ver (así el 403 es por el rol, no por no verla).
    assert api.get(base, headers=h).status_code == 200

    r = api.patch(f"{base}/detalles/{linea}", headers=h, json={"precio_unitario": "1.00"})
    assert r.status_code == 403
    assert r.json()["detail"] == MSG_SIN_PERMISO

    r = api.post(f"{base}/cobro", headers=h, json={"monto": "20000.00"})
    assert r.status_code == 403
    assert r.json()["detail"] == "El mecánico no emite cobros"

    r = api.post(f"{base}/cobro/aprobar", headers=h, json={"monto": "20000.00"})
    assert r.status_code == 403
    assert r.json()["detail"] == MSG_SIN_PERMISO

    # Nada cambió en la base.
    assert _fila(DetalleOrden, linea).precio_unitario == Decimal("20000.00")
    guardada = _fila(Orden, orden)
    assert guardada.cobro_estado is None
    assert guardada.costo_final is None


@pytest.mark.parametrize("estado", ["al_dia", "gracia"])
def test_recepcion_si_cotiza_y_cobra_en_el_mismo_estado(api, datos, estado):
    """Control del test del mecánico: con el mismo taller y estado, recepción
    puede, así que el 403 del mecánico es por su rol."""
    _estado(1, estado)
    h = datos["headers"]["recepcion"]
    base = f"/api/v1/ordenes/{datos['orden_mecanico']}"

    r = api.patch(f"{base}/detalles/{datos['linea']}", headers=h, json={"precio_unitario": "25000.00"})
    assert r.status_code == 200, r.text
    assert Decimal(r.json()["precio_unitario"]) == Decimal("25000.00")

    r = api.post(f"{base}/cobro", headers=h, json={"monto": "25000.00"})
    assert r.status_code == 200, r.text
    assert r.json()["cobro_estado"] == "aprobado"
    assert Decimal(r.json()["costo_final"]) == Decimal("25000.00")
