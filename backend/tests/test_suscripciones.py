"""S1: planes, suscripción del taller, pagos manuales y límite de personal
(docs/Suscripciones.md)."""
from datetime import date, timedelta
from decimal import Decimal
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.api.v1.suscripcion_mp import cliente_mp
from app.api.v1.suscripcion_mp import service as mp_service
from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.main import app
from app.models import Auditoria, Cliente, Taller, Usuario, Vehiculo
from app.models.usuario import RolUsuario

PASSWORD = "Clave1234"
MSG_SIN_PERMISO = "No tenés permisos para esta acción"
MSG_VENCIDA = "La suscripción del taller está vencida"
MSG_LECTURA = "El taller está en solo lectura por falta de pago de la suscripción"
MSG_TOPE_PLAN = "Tu personal activo supera el límite de ese plan"
MSG_CUPO = (
    "Tu plan permite hasta 3 usuarios del personal. "
    "Pasá a un plan mayor para sumar más."
)


def _usuario(nombre, email, rol, taller_id=None, activo=True):
    return Usuario(
        nombre=nombre,
        apellido="Prueba",
        email=email,
        password_hash=hash_password(PASSWORD),
        rol=rol,
        taller_id=taller_id,
        activo=activo,
    )


def _vence(taller_id: int, fecha: date) -> None:
    with SessionLocal() as db:
        taller = db.get(Taller, taller_id)
        taller.suscripcion_vence_en = fecha
        db.commit()


@pytest.fixture
def datos():
    """Taller 1 (esencial, 3 de personal = al límite) y taller 2 (pro, 4 de
    personal, para probar la baja de plan), más un superadmin."""
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    hoy = date.today()
    with SessionLocal() as db:
        taller1 = db.get(Taller, 1)
        taller1.suscripcion_vence_en = hoy + timedelta(days=30)
        taller2 = Taller(nombre="Taller Dos", plan_codigo="pro")
        db.add(taller2)
        db.flush()
        taller2.suscripcion_vence_en = hoy + timedelta(days=30)

        sa = _usuario("Super", "sa@x.com", RolUsuario.superadmin)
        admin = _usuario("Admin", "admin@x.com", RolUsuario.administrador)
        recep = _usuario("Recep", "recep@x.com", RolUsuario.recepcion)
        mec = _usuario("Mec", "mec@x.com", RolUsuario.mecanico)
        # Personal inactivo del taller 1: sirve para probar la reactivación.
        inactivo = _usuario("Inac", "inac@x.com", RolUsuario.mecanico, activo=False)
        admin2 = _usuario("Admin2", "admin2@x.com", RolUsuario.administrador, taller2.id)
        recep2 = _usuario("Recep2", "recep2@x.com", RolUsuario.recepcion, taller2.id)
        mec2a = _usuario("Mec2a", "mec2a@x.com", RolUsuario.mecanico, taller2.id)
        mec2b = _usuario("Mec2b", "mec2b@x.com", RolUsuario.mecanico, taller2.id)

        cliente = Cliente(nombre="Juan", apellido="Perez", dni="10000001",
                          email="juan@x.com")
        cliente_sin_cuenta = Cliente(nombre="Ana", apellido="Gomez", dni="20000002",
                                     email="ana@x.com")
        cuenta = _usuario("Juan", "cuenta@x.com", RolUsuario.cliente)
        db.add_all([
            sa, admin, recep, mec, inactivo,
            admin2, recep2, mec2a, mec2b,
            cliente, cliente_sin_cuenta, cuenta,
        ])
        db.flush()
        cuenta.cliente_id = cliente.id
        vehiculo = Vehiculo(cliente_id=cliente.id, patente="AAA111",
                            marca="VW", modelo="Gol")
        db.add(vehiculo)
        db.flush()
        db.commit()

        usuarios = {
            "superadmin": sa, "admin": admin, "recepcion": recep, "mecanico": mec,
            "inactivo": inactivo, "admin2": admin2, "recepcion2": recep2,
            "cuenta": cuenta,
        }
        return {
            "ids": {k: u.id for k, u in usuarios.items()},
            "taller2_id": taller2.id,
            "vehiculo_id": vehiculo.id,
            "cliente_sin_cuenta_id": cliente_sin_cuenta.id,
            "headers": {
                k: {"Authorization": "Bearer " + create_access_token(u.id)}
                for k, u in usuarios.items()
            },
        }


@pytest.fixture
def api():
    with TestClient(app) as cliente:
        yield cliente


# --- Estado según vencimiento -------------------------------------------------


def test_estado_segun_vencimiento(api, datos):
    h = datos["headers"]["admin"]
    hoy = date.today()
    for dias, estado in ((0, "al_dia"), (-3, "gracia"), (-10, "solo_lectura"),
                         (-40, "suspendida")):
        vence = hoy + timedelta(days=dias)
        _vence(1, vence)
        r = api.get("/api/v1/suscripcion", headers=h)
        assert r.status_code == 200, r.text
        cuerpo = r.json()
        assert cuerpo["estado"] == estado, (dias, cuerpo)
        assert cuerpo["vence_en"] == vence.isoformat()
        assert cuerpo["dias_para_vencer"] == (vence - hoy).days
        assert cuerpo["plan"]["codigo"] == "esencial"
        assert cuerpo["max_personal"] == 3
        assert cuerpo["personal_activo"] == 3
        assert cuerpo["proximo_monto"] == "35000.00"


def test_solo_lectura_bloquea_escritura_pero_no_lectura(api, datos):
    _vence(1, date.today() - timedelta(days=10))
    h = datos["headers"]["admin"]

    r = api.post("/api/v1/ordenes", headers=h, json={
        "vehiculo_id": datos["vehiculo_id"], "descripcion_ingreso": "Service",
    })
    assert r.status_code == 403
    assert r.json()["detail"] == MSG_LECTURA

    # La lectura sigue andando y la suscripción también (ruta libre).
    assert api.get("/api/v1/ordenes", headers=h).status_code == 200
    assert api.get("/api/v1/suscripcion", headers=h).status_code == 200
    assert api.put("/api/v1/suscripcion/plan", headers=h,
                   json={"plan": "pro"}).status_code == 200


def test_suspendida_solo_el_admin_y_solo_rutas_libres(api, datos):
    _vence(1, date.today() - timedelta(days=40))
    h_admin = datos["headers"]["admin"]
    h_recep = datos["headers"]["recepcion"]

    # El administrador entra solo a las rutas libres: suscripción y login.
    assert api.get("/api/v1/suscripcion", headers=h_admin).status_code == 200
    assert api.put("/api/v1/suscripcion/plan", headers=h_admin,
                   json={"plan": "pro"}).status_code == 200
    r = api.post("/api/v1/auth/login",
                 json={"email": "admin@x.com", "password": PASSWORD})
    assert r.status_code == 200

    # El resto del taller queda afuera, incluso para leer.
    for h in (h_admin, h_recep):
        r = api.get("/api/v1/ordenes", headers=h)
        assert r.status_code == 403
        assert r.json()["detail"] == MSG_VENCIDA
    # Y recepción ni siquiera ve la suscripción.
    r = api.get("/api/v1/suscripcion", headers=h_recep)
    assert r.status_code == 403
    assert r.json()["detail"] == MSG_VENCIDA


# --- Pago manual y vencimiento desde la plataforma ----------------------------


def test_pago_manual_extiende_vencimiento_y_desbloquea(api, datos):
    _vence(1, date.today() - timedelta(days=10))
    h = datos["headers"]["admin"]
    hs = datos["headers"]["superadmin"]
    tid = 1  # taller principal

    bloqueado = api.post("/api/v1/ordenes", headers=h, json={
        "vehiculo_id": datos["vehiculo_id"], "descripcion_ingreso": "Service",
    })
    assert bloqueado.status_code == 403

    r = api.post(f"/api/v1/plataforma/talleres/{tid}/pagos", headers=hs, json={
        "monto": "15000.00", "meses": 1, "referencia": "transf 001",
    })
    assert r.status_code == 201, r.text
    pago = r.json()
    assert pago["medio"] == "manual"
    assert pago["estado"] == "aprobado"
    assert pago["referencia"] == "transf 001"
    assert pago["registrado_por"] == "Super Prueba"
    assert "taller_id" not in pago and "mp_payment_id" not in pago

    # El período arranca hoy (el vencimiento ya pasó) y da ~1 mes.
    assert pago["periodo_desde"] == date.today().isoformat()
    assert date.fromisoformat(pago["periodo_hasta"]) > date.today() + timedelta(days=25)

    # Desbloqueado: el taller vuelve a escribir y ve su pago.
    assert api.post("/api/v1/ordenes", headers=h, json={
        "vehiculo_id": datos["vehiculo_id"], "descripcion_ingreso": "Service",
    }).status_code == 201
    r = api.get("/api/v1/suscripcion", headers=h)
    assert r.json()["estado"] == "al_dia"
    pagos = api.get("/api/v1/suscripcion/pagos", headers=h).json()
    assert [p["id"] for p in pagos] == [pago["id"]]
    assert pagos[0]["medio"] == "manual"

    # La plataforma ve la suscripción con sus pagos.
    r = api.get(f"/api/v1/plataforma/talleres/{tid}/suscripcion", headers=hs)
    assert r.status_code == 200
    assert [p["id"] for p in r.json()["pagos"]] == [pago["id"]]


def test_pago_manual_convive_con_periodo_pagado(api, datos):
    """Si todavía está pago, el período nuevo arranca al día siguiente del
    vencimiento (docs/Suscripciones.md: periodo_desde = max(vence_en + 1, hoy))."""
    vence = date.today() + timedelta(days=20)
    _vence(1, vence)
    hs = datos["headers"]["superadmin"]

    r = api.post("/api/v1/plataforma/talleres/1/pagos", headers=hs,
                 json={"monto": "15000.00", "meses": 1})
    assert r.status_code == 201, r.text
    pago = r.json()
    assert pago["periodo_desde"] == (vence + timedelta(days=1)).isoformat()
    # vence_en queda en periodo_hasta: no se pisan los días ya pagos.
    r = api.get("/api/v1/suscripcion", headers=datos["headers"]["admin"])
    assert r.json()["vence_en"] == pago["periodo_hasta"]


def test_ajustar_vencimiento_queda_en_auditoria(api, datos):
    hs = datos["headers"]["superadmin"]
    nuevo = (date.today() - timedelta(days=15)).isoformat()
    r = api.post("/api/v1/plataforma/talleres/1/vencimiento", headers=hs,
                 json={"vence_en": nuevo})
    assert r.status_code == 200, r.text
    assert r.json()["estado"] == "solo_lectura"
    assert r.json()["vence_en"] == nuevo

    with SessionLocal() as db:
        fila = db.scalars(
            select(Auditoria).where(Auditoria.ruta.like("%vencimiento%"))
        ).first()
        assert fila is not None


# --- Planes y cambio de plan ---------------------------------------------------


def test_cambio_de_plan_taller_y_plataforma(api, datos):
    h = datos["headers"]["admin"]
    h2 = datos["headers"]["admin2"]
    hs = datos["headers"]["superadmin"]
    t2 = datos["taller2_id"]

    # Plan inexistente o inactivo: 404.
    r = api.put("/api/v1/suscripcion/plan", headers=h, json={"plan": "no_existe"})
    assert r.status_code == 404

    # El taller sube a pro y rige ya.
    r = api.put("/api/v1/suscripcion/plan", headers=h, json={"plan": "pro"})
    assert r.status_code == 200, r.text
    assert r.json()["plan"]["codigo"] == "pro"
    assert r.json()["plan"]["precio_mensual"] == "79000.00"
    assert r.json()["max_personal"] == 10

    # La plataforma cambia el plan del taller 2 (pro -> profesional).
    r = api.put(f"/api/v1/plataforma/talleres/{t2}/plan", headers=hs,
                json={"plan": "profesional"})
    assert r.status_code == 200
    assert r.json()["plan"]["codigo"] == "profesional"
    assert r.json()["max_personal"] is None

    # El admin del taller 2 ve su plan nuevo.
    r = api.get("/api/v1/suscripcion", headers=h2)
    assert r.json()["plan"]["codigo"] == "profesional"


def test_bajar_de_plan_con_personal_de_mas_da_409(api, datos):
    h = datos["headers"]["admin"]
    hs = datos["headers"]["superadmin"]
    t2 = datos["taller2_id"]

    # Taller 2: pro con 4 de personal -> esencial (máx. 3) no entra.
    r = api.put(f"/api/v1/plataforma/talleres/{t2}/plan", headers=hs,
                json={"plan": "esencial"})
    assert r.status_code == 409
    assert r.json()["detail"] == MSG_TOPE_PLAN

    # Del lado del taller: subir a pro, sumar un cuarto y bajar -> 409.
    assert api.put("/api/v1/suscripcion/plan", headers=h,
                   json={"plan": "pro"}).status_code == 200
    r = api.post("/api/v1/users", headers=h, json={
        "nombre": "Mec", "apellido": "Nuevo", "email": "mec_nuevo@x.com",
        "password": PASSWORD, "rol": "mecanico",
    })
    assert r.status_code == 201
    r = api.put("/api/v1/suscripcion/plan", headers=h, json={"plan": "esencial"})
    assert r.status_code == 409
    assert r.json()["detail"] == MSG_TOPE_PLAN


def test_cambio_de_plan_actualiza_el_monto_de_la_preapproval(api, datos, monkeypatch):
    """Con cobro automático, cambiar de plan (taller o plataforma) actualiza el
    monto de la preapproval en Mercado Pago (S2)."""
    fake = SimpleNamespace(boxly_mp_access_token="tok-boxly")
    monkeypatch.setattr(mp_service, "get_settings", lambda: fake)
    llamadas = []
    monkeypatch.setattr(
        cliente_mp, "actualizar_preapproval",
        lambda token, preapproval_id, **kw: llamadas.append((preapproval_id, kw)),
    )
    t2 = datos["taller2_id"]
    with SessionLocal() as db:
        for tid in (1, t2):
            taller = db.get(Taller, tid)
            taller.cobro_automatico = True
            taller.mp_preapproval_id = f"pre-{tid}"
        db.commit()

    # Taller: esencial -> pro ($79.000).
    r = api.put("/api/v1/suscripcion/plan", headers=datos["headers"]["admin"],
                json={"plan": "pro"})
    assert r.status_code == 200
    assert len(llamadas) == 1
    preapproval_id, kw = llamadas[0]
    assert preapproval_id == "pre-1"
    assert kw["monto"] == Decimal("79000.00")

    # Plataforma: pro -> profesional ($169.000) en el taller 2.
    r = api.put(f"/api/v1/plataforma/talleres/{t2}/plan",
                headers=datos["headers"]["superadmin"],
                json={"plan": "profesional"})
    assert r.status_code == 200
    assert len(llamadas) == 2
    preapproval_id, kw = llamadas[1]
    assert preapproval_id == f"pre-{t2}"
    assert kw["monto"] == Decimal("169000.00")

    # Sin cobro automático no hay llamada a MP (el PUT igual responde 200).
    with SessionLocal() as db:
        db.get(Taller, t2).cobro_automatico = False
        db.commit()
    llamadas.clear()
    r = api.put(f"/api/v1/plataforma/talleres/{t2}/plan",
                headers=datos["headers"]["superadmin"],
                json={"plan": "pro"})
    assert r.status_code == 200
    assert llamadas == []


def test_edicion_de_planes_por_superadmin(api, datos):
    hs = datos["headers"]["superadmin"]
    h = datos["headers"]["admin"]

    r = api.get("/api/v1/plataforma/planes", headers=hs)
    assert r.status_code == 200
    planes = {p["codigo"]: p for p in r.json()}
    assert set(planes) == {"esencial", "pro", "profesional"}
    assert planes["esencial"]["max_personal"] == 3
    assert planes["profesional"]["max_personal"] is None

    # Edición parcial: precio y sacar el límite de pro.
    r = api.put("/api/v1/plataforma/planes/pro", headers=hs, json={
        "precio_mensual": "32000.50", "max_personal": None,
    })
    assert r.status_code == 200, r.text
    assert r.json()["precio_mensual"] == "32000.50"
    assert r.json()["max_personal"] is None
    assert r.json()["nombre"] == "Pro"  # lo que no se manda, queda

    # Plan inexistente: 404. Plan inactivo no aparece en /suscripcion/planes.
    assert api.put("/api/v1/plataforma/planes/no_existe", headers=hs,
                   json={"nombre": "X"}).status_code == 404
    api.put("/api/v1/plataforma/planes/profesional", headers=hs,
            json={"activo": False})
    codigos = [p["codigo"] for p in api.get("/api/v1/suscripcion/planes",
                                            headers=h).json()]
    assert codigos == ["esencial", "pro"]
    # Pero la plataforma lo sigue viendo, inactivo.
    planes = {p["codigo"]: p for p in api.get("/api/v1/plataforma/planes",
                                             headers=hs).json()}
    assert planes["profesional"]["activo"] is False


# --- Límite de personal ---------------------------------------------------------


def _body_usuario(email, rol="mecanico", **extra):
    body = {
        "nombre": "Nuevo", "apellido": "User", "email": email,
        "password": PASSWORD, "rol": rol,
    }
    body.update(extra)
    return body


def test_limite_de_personal_al_crear(api, datos):
    h = datos["headers"]["admin"]

    # Taller 1 en esencial (máx. 3) ya tiene 3 de personal: el cuarto no entra.
    r = api.post("/api/v1/users", headers=h,
                 json=_body_usuario("mec4@x.com"))
    assert r.status_code == 409
    assert r.json()["detail"] == MSG_CUPO

    # Las cuentas de cliente no cuentan para el plan.
    r = api.post("/api/v1/users", headers=h, json=_body_usuario(
        "cuenta2@x.com", rol="cliente",
        cliente_id=datos["cliente_sin_cuenta_id"],
    ))
    assert r.status_code == 201, r.text


def test_limite_de_personal_al_reactivar(api, datos):
    h = datos["headers"]["admin"]
    ids = datos["ids"]

    # Con el cupo lleno, reactivar al mecánico inactivo da 409.
    r = api.put(f"/api/v1/users/{ids['inactivo']}", headers=h,
                json={"activo": True})
    assert r.status_code == 409
    assert r.json()["detail"] == MSG_CUPO

    # Si se libera lugar (se desactiva a otro), la reactivación entra.
    assert api.delete(f"/api/v1/users/{ids['mecanico']}", headers=h).status_code == 200
    r = api.put(f"/api/v1/users/{ids['inactivo']}", headers=h,
                json={"activo": True})
    assert r.status_code == 200, r.text
    assert r.json()["activo"] is True

    # Y actualizar a alguien que ya cuenta no gasta cupo.
    assert api.put(f"/api/v1/users/{ids['recepcion']}", headers=h,
                   json={"nombre": "Recep Editada"}).status_code == 200


# --- Aislamiento entre talleres y roles ----------------------------------------


def test_cada_taller_ve_solo_su_suscripcion_y_sus_pagos(api, datos):
    hs = datos["headers"]["superadmin"]
    h1 = datos["headers"]["admin"]
    h2 = datos["headers"]["admin2"]
    t2 = datos["taller2_id"]

    # Un pago del taller 2.
    r = api.post(f"/api/v1/plataforma/talleres/{t2}/pagos", headers=hs,
                 json={"monto": "30000.00", "meses": 1})
    assert r.status_code == 201
    pago2 = r.json()["id"]

    # Cada admin ve su plan y solo sus pagos.
    s1 = api.get("/api/v1/suscripcion", headers=h1).json()
    s2 = api.get("/api/v1/suscripcion", headers=h2).json()
    assert s1["plan"]["codigo"] == "esencial"
    assert s2["plan"]["codigo"] == "pro"
    assert [p["id"] for p in api.get("/api/v1/suscripcion/pagos",
                                     headers=h1).json()] == []
    assert [p["id"] for p in api.get("/api/v1/suscripcion/pagos",
                                     headers=h2).json()] == [pago2]

    # La plataforma distingue las dos suscripciones.
    d1 = api.get("/api/v1/plataforma/talleres/1/suscripcion", headers=hs).json()
    d2 = api.get("/api/v1/plataforma/talleres/2/suscripcion", headers=hs).json()
    assert d1["plan"]["codigo"] == "esencial" and d1["pagos"] == []
    assert d2["plan"]["codigo"] == "pro" and [p["id"] for p in d2["pagos"]] == [pago2]


def test_roles_de_las_rutas_de_suscripcion(api, datos):
    hs = datos["headers"]["superadmin"]

    # Recepción y mecánico consultan pero no cambian el plan.
    for clave in ("recepcion", "mecanico"):
        h = datos["headers"][clave]
        assert api.get("/api/v1/suscripcion", headers=h).status_code == 200
        assert api.get("/api/v1/suscripcion/planes", headers=h).status_code == 200
        assert api.get("/api/v1/suscripcion/pagos", headers=h).status_code == 200
        r = api.put("/api/v1/suscripcion/plan", headers=h, json={"plan": "pro"})
        assert r.status_code == 403
        assert r.json()["detail"] == MSG_SIN_PERMISO

    # La cuenta de cliente no es personal del taller.
    h = datos["headers"]["cuenta"]
    assert api.get("/api/v1/suscripcion", headers=h).status_code == 403

    # El superadmin no tiene suscripción de taller pero sí la plataforma.
    assert api.get("/api/v1/suscripcion", headers=hs).status_code == 403
    assert api.get("/api/v1/plataforma/planes", headers=hs).status_code == 200
    assert api.get("/api/v1/plataforma/talleres/1/suscripcion",
                   headers=hs).status_code == 200

    # El admin del taller no entra a las rutas de plataforma.
    h = datos["headers"]["admin"]
    assert api.get("/api/v1/plataforma/planes", headers=h).status_code == 403
    assert api.get("/api/v1/plataforma/talleres/1/suscripcion",
                   headers=h).status_code == 403
    assert api.post("/api/v1/plataforma/talleres/1/pagos", headers=h,
                    json={"monto": "1.00"}).status_code == 403

    # Sin token: 401.
    assert api.get("/api/v1/suscripcion").status_code == 401


# --- Alta de taller con prueba --------------------------------------------------


def test_alta_de_taller_sin_acceso_arranca_en_demo_pro_14_dias(api, datos):
    hs = datos["headers"]["superadmin"]
    r = api.post("/api/v1/plataforma/talleres", headers=hs, json={
        "nombre": "Taller Nuevo",
        "admin": {"nombre": "Admin", "apellido": "Nuevo",
                  "email": "admin.nuevo@x.com"},
    })
    assert r.status_code == 201, r.text
    resumen = r.json()["taller"]
    # Sin acceso, el alta es demo: Pro por 14 días (docs/Oferta.md, C2).
    assert resumen["plan_codigo"] == "pro"
    assert resumen["tipo_acceso"] == "demo"
    assert resumen["suscripcion_estado"] == "al_dia"
    assert resumen["suscripcion_vence_en"] == (
        date.today() + timedelta(days=14)
    ).isoformat()

    # El admin nuevo entra y ve su demo.
    r = api.post("/api/v1/auth/login", json={
        "email": "admin.nuevo@x.com", "password": r.json()["password_temporal"],
    })
    assert r.status_code == 200, r.text
    token = {"Authorization": "Bearer " + r.json()["access_token"]}
    s = api.get("/api/v1/suscripcion", headers=token).json()
    assert s["plan"]["codigo"] == "pro"
    assert s["tipo_acceso"] == "demo"
    assert s["max_personal"] == 10
    assert s["personal_activo"] == 1
    assert s["dias_para_vencer"] == 14
