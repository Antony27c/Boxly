"""C2: tipo de acceso (demo, piloto, pago), adicionales y funciones por plan
(docs/Oferta.md, "API de C2")."""
from datetime import date, timedelta
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.api.v1.suscripcion_mp import service as mp_service
from app.core.funciones import FUNCIONES
from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.main import app
from app.models import AdicionalTaller, Auditoria, Taller, Usuario
from app.models.usuario import RolUsuario

PASSWORD = "Clave1234"
MSG_YA_INCLUIDA = "El plan ya incluye esta función"


def _usuario(nombre, email, rol, taller_id=None):
    return Usuario(
        nombre=nombre,
        apellido="Prueba",
        email=email,
        password_hash=hash_password(PASSWORD),
        rol=rol,
        taller_id=taller_id,
        activo=True,
    )


def _headers(usuario_id: int) -> dict:
    return {"Authorization": "Bearer " + create_access_token(usuario_id)}


@pytest.fixture
def datos():
    """Taller 1 (esencial, pago) con su personal, taller demo (pro) con su
    administrador y un superadmin."""
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    hoy = date.today()
    with SessionLocal() as db:
        taller1 = db.get(Taller, 1)
        taller1.plan_codigo = "esencial"
        taller1.tipo_acceso = "pago"
        taller1.suscripcion_vence_en = hoy + timedelta(days=30)
        demo = Taller(
            nombre="Taller Demo",
            plan_codigo="pro",
            tipo_acceso="demo",
            suscripcion_vence_en=hoy + timedelta(days=5),
        )
        db.add(demo)
        db.flush()

        usuarios = {
            "superadmin": _usuario("Super", "sa@x.com", RolUsuario.superadmin),
            "admin": _usuario("Admin", "admin@x.com", RolUsuario.administrador),
            "recepcion": _usuario("Recep", "recep@x.com", RolUsuario.recepcion),
            "mecanico": _usuario("Mec", "mec@x.com", RolUsuario.mecanico),
            "admin_demo": _usuario(
                "AdminDemo", "demo@x.com", RolUsuario.administrador, demo.id
            ),
        }
        db.add_all(usuarios.values())
        db.commit()
        return {
            "demo_id": demo.id,
            "headers": {k: _headers(u.id) for k, u in usuarios.items()},
        }


@pytest.fixture
def api():
    with TestClient(app) as cliente:
        yield cliente


@pytest.fixture
def sa(datos):
    return datos["headers"]["superadmin"]


def _alta(api, headers, email, acceso=None):
    body = {
        "nombre": "Taller Nuevo",
        "admin": {"nombre": "Admin", "apellido": "Nuevo", "email": email},
    }
    if acceso is not None:
        body["acceso"] = acceso
    return api.post("/api/v1/plataforma/talleres", headers=headers, json=body)


def _taller(taller_id: int) -> Taller:
    with SessionLocal() as db:
        taller = db.get(Taller, taller_id)
        db.expunge(taller)
        return taller


def _detalles_de_acceso(taller_id: int) -> list[str]:
    with SessionLocal() as db:
        stmt = select(Auditoria.detalle).where(
            Auditoria.entidad_id == taller_id,
            Auditoria.taller_id.is_(None),
            Auditoria.detalle.is_not(None),
        )
        return list(db.scalars(stmt))


def _suscripcion(api, headers, taller_id: int) -> dict:
    r = api.get(f"/api/v1/plataforma/talleres/{taller_id}/suscripcion", headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


# --- Alta con tipo de acceso -----------------------------------------------------


def test_alta_sin_acceso_es_demo_pro_14_dias(api, sa):
    r = _alta(api, sa, "a1@x.com")
    assert r.status_code == 201, r.text
    resumen = r.json()["taller"]
    assert resumen["tipo_acceso"] == "demo"
    assert resumen["plan_codigo"] == "pro"
    assert resumen["suscripcion_vence_en"] == (date.today() + timedelta(days=14)).isoformat()


def test_alta_demo_fuerza_pro_y_14_dias(api, sa):
    otra_fecha = (date.today() + timedelta(days=90)).isoformat()
    r = _alta(api, sa, "a2@x.com", {"tipo": "demo", "plan": "esencial", "vence_en": otra_fecha})
    assert r.status_code == 201, r.text
    taller = _taller(r.json()["taller"]["id"])
    assert (taller.tipo_acceso, taller.plan_codigo) == ("demo", "pro")
    assert taller.suscripcion_vence_en == date.today() + timedelta(days=14)


@pytest.mark.parametrize("falta", ["plan", "vence_en", "motivo"])
def test_alta_piloto_sin_un_dato_da_422(api, sa, falta):
    acceso = {
        "tipo": "piloto",
        "plan": "profesional",
        "vence_en": (date.today() + timedelta(days=60)).isoformat(),
        "motivo": "Taller amigo",
    }
    del acceso[falta]
    r = _alta(api, sa, f"p-{falta}@x.com", acceso)
    assert r.status_code == 422, r.text
    with SessionLocal() as db:
        assert db.scalar(select(Usuario).where(Usuario.email == f"p-{falta}@x.com")) is None


def test_alta_piloto_con_plan_fecha_y_motivo(api, sa):
    vence = date.today() + timedelta(days=60)
    r = _alta(api, sa, "p@x.com", {
        "tipo": "piloto", "plan": "profesional",
        "vence_en": vence.isoformat(), "motivo": "Taller amigo",
    })
    assert r.status_code == 201, r.text
    taller = _taller(r.json()["taller"]["id"])
    assert (taller.tipo_acceso, taller.plan_codigo) == ("piloto", "profesional")
    assert taller.suscripcion_vence_en == vence
    # El motivo queda en la auditoría de plataforma, sin taller_id.
    assert _detalles_de_acceso(taller.id) == [
        f"Acceso piloto, plan profesional, vence {vence.isoformat()}. Motivo: Taller amigo"
    ]


def test_alta_pago_pide_plan_y_vence_hoy_por_defecto(api, sa):
    assert _alta(api, sa, "x@x.com", {"tipo": "pago"}).status_code == 422
    r = _alta(api, sa, "pago@x.com", {"tipo": "pago", "plan": "esencial"})
    assert r.status_code == 201, r.text
    resumen = r.json()["taller"]
    assert (resumen["tipo_acceso"], resumen["plan_codigo"]) == ("pago", "esencial")
    assert resumen["suscripcion_vence_en"] == date.today().isoformat()


def test_alta_con_plan_inexistente_da_404_y_no_crea_nada(api, sa):
    r = _alta(api, sa, "nada@x.com", {"tipo": "pago", "plan": "premium"})
    assert r.status_code == 404
    with SessionLocal() as db:
        assert db.scalar(select(Taller).where(Taller.nombre == "Taller Nuevo")) is None


# --- Conversión del acceso -------------------------------------------------------


def test_convertir_demo_a_pago(api, datos, sa):
    vence = date.today() + timedelta(days=30)
    r = api.post(
        f"/api/v1/plataforma/talleres/{datos['demo_id']}/acceso",
        headers=sa,
        json={"tipo": "pago", "plan": "esencial", "vence_en": vence.isoformat()},
    )
    assert r.status_code == 200, r.text
    cuerpo = r.json()
    assert cuerpo["tipo_acceso"] == "pago"
    assert cuerpo["plan"]["codigo"] == "esencial"
    assert cuerpo["vence_en"] == vence.isoformat()
    demo_vence = (date.today() + timedelta(days=5)).isoformat()
    assert _detalles_de_acceso(datos["demo_id"]) == [
        f"Acceso demo → pago. Plan pro → esencial. Vence {demo_vence} → {vence.isoformat()}. "
        "Motivo: sin motivo"
    ]
    # Queda en el listado de la plataforma.
    talleres = api.get("/api/v1/plataforma/talleres", headers=sa).json()
    assert {t["id"]: t["tipo_acceso"] for t in talleres}[datos["demo_id"]] == "pago"


def test_convertir_a_piloto_guarda_el_motivo(api, datos, sa):
    vence = date.today() + timedelta(days=45)
    r = api.post(
        f"/api/v1/plataforma/talleres/{datos['demo_id']}/acceso",
        headers=sa,
        json={"tipo": "piloto", "plan": "pro", "vence_en": vence.isoformat(),
              "motivo": "  Feria del automotor  "},
    )
    assert r.status_code == 200, r.text
    assert r.json()["tipo_acceso"] == "piloto"
    demo_vence = (date.today() + timedelta(days=5)).isoformat()
    assert _detalles_de_acceso(datos["demo_id"]) == [
        f"Acceso demo → piloto. Plan pro → pro. Vence {demo_vence} → {vence.isoformat()}. "
        "Motivo: Feria del automotor"
    ]


def test_convertir_a_piloto_sin_motivo_da_422(api, datos, sa):
    r = api.post(
        f"/api/v1/plataforma/talleres/{datos['demo_id']}/acceso",
        headers=sa,
        json={"tipo": "piloto", "plan": "pro", "vence_en": date.today().isoformat()},
    )
    assert r.status_code == 422
    assert _taller(datos["demo_id"]).tipo_acceso == "demo"


def test_convertir_taller_inexistente_da_404(api, sa):
    r = api.post(
        "/api/v1/plataforma/talleres/999/acceso",
        headers=sa,
        json={"tipo": "pago", "plan": "pro"},
    )
    assert r.status_code == 404


# --- Adicionales -----------------------------------------------------------------


def test_activar_listar_y_desactivar_adicional(api, sa):
    base = "/api/v1/plataforma/talleres/1/adicionales"
    assert "arca" not in _suscripcion(api, sa, 1)["funciones_efectivas"]

    hasta = date.today() + timedelta(days=30)
    r = api.post(base, headers=sa, json={"codigo": "arca", "hasta": hasta.isoformat()})
    assert r.status_code == 201, r.text
    assert r.json() == {"codigo": "arca", "desde": None, "hasta": hasta.isoformat()}

    assert api.get(base, headers=sa).json() == [r.json()]
    suscripcion = _suscripcion(api, sa, 1)
    assert suscripcion["adicionales"] == [r.json()]
    assert "arca" in suscripcion["funciones_efectivas"]

    # Activarlo de nuevo actualiza la vigencia, sin duplicar.
    r = api.post(base, headers=sa, json={"codigo": "arca"})
    assert r.status_code == 201
    assert len(api.get(base, headers=sa).json()) == 1

    assert api.delete(f"{base}/arca", headers=sa).status_code == 204
    assert api.get(base, headers=sa).json() == []
    suscripcion = _suscripcion(api, sa, 1)
    assert suscripcion["adicionales"] == []
    assert "arca" not in suscripcion["funciones_efectivas"]
    assert api.delete(f"{base}/arca", headers=sa).status_code == 404


def test_adicional_que_el_plan_ya_incluye_da_409(api, datos, sa):
    r = api.post(
        f"/api/v1/plataforma/talleres/{datos['demo_id']}/adicionales",
        headers=sa,
        json={"codigo": "arca"},
    )
    assert r.status_code == 409
    assert r.json()["detail"] == MSG_YA_INCLUIDA


def test_adicional_vencido_no_cuenta(api, sa):
    ayer = date.today() - timedelta(days=1)
    r = api.post(
        "/api/v1/plataforma/talleres/1/adicionales",
        headers=sa,
        json={"codigo": "arca", "desde": (ayer - timedelta(days=30)).isoformat(),
              "hasta": ayer.isoformat()},
    )
    assert r.status_code == 201, r.text
    suscripcion = _suscripcion(api, sa, 1)
    assert suscripcion["adicionales"] == []
    assert "arca" not in suscripcion["funciones_efectivas"]
    # El superadmin lo sigue viendo en la lista del taller.
    assert len(api.get("/api/v1/plataforma/talleres/1/adicionales", headers=sa).json()) == 1


@pytest.mark.parametrize(
    "body",
    [
        {"codigo": "whatsapp_automatico"},
        {"codigo": "inventado"},
        {"codigo": "arca", "desde": "2026-12-10", "hasta": "2026-12-01"},
    ],
)
def test_adicional_invalido_da_422(api, sa, body):
    r = api.post("/api/v1/plataforma/talleres/1/adicionales", headers=sa, json=body)
    assert r.status_code == 422
    with SessionLocal() as db:
        assert db.scalars(select(AdicionalTaller)).first() is None


# --- Funciones por plan ----------------------------------------------------------


def test_funciones_efectivas_segun_el_plan(api, datos, sa):
    assert _suscripcion(api, sa, 1)["funciones_efectivas"] == ["gestion", "whatsapp_manual"]
    demo = _suscripcion(api, sa, datos["demo_id"])
    assert demo["tipo_acceso"] == "demo"
    assert demo["plan"]["funciones"] == demo["funciones_efectivas"]
    assert "arca" in demo["funciones_efectivas"]

    with SessionLocal() as db:
        db.get(Taller, 1).plan_codigo = "profesional"
        db.commit()
    assert _suscripcion(api, sa, 1)["funciones_efectivas"] == list(FUNCIONES)

    # El taller ve lo mismo en su propia suscripción.
    r = api.get("/api/v1/suscripcion", headers=datos["headers"]["admin"])
    assert r.json()["funciones_efectivas"] == list(FUNCIONES)


def test_editar_funciones_de_un_plan(api, sa):
    r = api.put(
        "/api/v1/plataforma/planes/esencial",
        headers=sa,
        json={"funciones": ["gestion", "whatsapp_manual", "arca", "arca"]},
    )
    assert r.status_code == 200, r.text
    assert r.json()["funciones"] == ["gestion", "whatsapp_manual", "arca"]
    planes = {p["codigo"]: p for p in api.get("/api/v1/plataforma/planes", headers=sa).json()}
    assert planes["esencial"]["funciones"] == ["gestion", "whatsapp_manual", "arca"]
    # Ahora el plan incluye ARCA: el adicional ya no corresponde.
    r = api.post("/api/v1/plataforma/talleres/1/adicionales", headers=sa, json={"codigo": "arca"})
    assert r.status_code == 409


def test_funcion_desconocida_en_un_plan_da_422(api, sa):
    r = api.put(
        "/api/v1/plataforma/planes/pro", headers=sa, json={"funciones": ["gestion", "magia"]}
    )
    assert r.status_code == 422
    planes = {p["codigo"]: p for p in api.get("/api/v1/plataforma/planes", headers=sa).json()}
    assert "magia" not in planes["pro"]["funciones"]


# --- Un pago aprobado pasa el taller a pago ---------------------------------------


def test_pago_manual_pasa_demo_a_pago(api, datos, sa):
    r = api.post(
        f"/api/v1/plataforma/talleres/{datos['demo_id']}/pagos",
        headers=sa,
        json={"monto": "79000.00"},
    )
    assert r.status_code == 201, r.text
    taller = _taller(datos["demo_id"])
    assert taller.tipo_acceso == "pago"
    assert taller.plan_codigo == "pro"


def test_pago_mercadopago_pasa_piloto_a_pago(api, datos, monkeypatch):
    with SessionLocal() as db:
        db.get(Taller, datos["demo_id"]).tipo_acceso = "piloto"
        db.commit()
    monkeypatch.setattr(
        mp_service, "get_settings", lambda: SimpleNamespace(environment="dev", debug=True)
    )
    r = api.post(
        "/api/v1/suscripcion/simular-cobro",
        headers=datos["headers"]["admin_demo"],
        json={"estado": "aprobado"},
    )
    assert r.status_code == 200, r.text
    assert _taller(datos["demo_id"]).tipo_acceso == "pago"


def test_pago_mercadopago_rechazado_no_cambia_el_acceso(api, datos, monkeypatch):
    monkeypatch.setattr(
        mp_service, "get_settings", lambda: SimpleNamespace(environment="dev", debug=True)
    )
    r = api.post(
        "/api/v1/suscripcion/simular-cobro",
        headers=datos["headers"]["admin_demo"],
        json={"estado": "rechazado"},
    )
    assert r.status_code == 200, r.text
    assert _taller(datos["demo_id"]).tipo_acceso == "demo"


# --- Roles -----------------------------------------------------------------------


def _rutas_nuevas(demo_id: int):
    return [
        ("POST", f"/api/v1/plataforma/talleres/{demo_id}/acceso", {"tipo": "pago", "plan": "pro"}),
        ("GET", f"/api/v1/plataforma/talleres/{demo_id}/adicionales", None),
        ("POST", "/api/v1/plataforma/talleres/1/adicionales", {"codigo": "arca"}),
        ("DELETE", "/api/v1/plataforma/talleres/1/adicionales/arca", None),
        ("PUT", "/api/v1/plataforma/planes/pro", {"funciones": ["gestion"]}),
    ]


@pytest.mark.parametrize("rol", ["admin", "recepcion", "mecanico", "admin_demo"])
def test_rutas_nuevas_solo_superadmin(api, datos, rol):
    for metodo, url, body in _rutas_nuevas(datos["demo_id"]):
        r = api.request(metodo, url, headers=datos["headers"][rol], json=body)
        assert r.status_code == 403, (rol, metodo, url, r.text)
    assert _taller(datos["demo_id"]).tipo_acceso == "demo"


def test_rutas_nuevas_sin_token_dan_401(api, datos):
    for metodo, url, body in _rutas_nuevas(datos["demo_id"]):
        assert api.request(metodo, url, json=body).status_code == 401, (metodo, url)


def test_el_taller_ve_quien_registro_el_pago_manual(api, datos, sa):
    """El superadmin no pertenece al taller: igual figura como quien registró."""
    r = api.post("/api/v1/plataforma/talleres/1/pagos", headers=sa, json={"monto": "35000.00"})
    assert r.status_code == 201, r.text
    assert r.json()["registrado_por"] == "Super Prueba"
    pagos = api.get("/api/v1/suscripcion/pagos", headers=datos["headers"]["admin"]).json()
    assert [p["registrado_por"] for p in pagos] == ["Super Prueba"]


@pytest.mark.parametrize(
    "tipo,dias_gracia,dias_acceso",
    [("pago", 7, 30), ("piloto", 7, 30), ("demo", None, 3)],
)
def test_fechas_limite_segun_el_tipo_de_acceso(api, datos, sa, tipo, dias_gracia, dias_acceso):
    vence = date.today() + timedelta(days=5)
    with SessionLocal() as db:
        taller = db.get(Taller, datos["demo_id"])
        taller.tipo_acceso = tipo
        taller.suscripcion_vence_en = vence
        db.commit()
    cuerpo = _suscripcion(api, sa, datos["demo_id"])
    esperado_gracia = (vence + timedelta(days=dias_gracia)).isoformat() if dias_gracia else None
    assert cuerpo["fin_gracia"] == esperado_gracia
    assert cuerpo["fin_acceso"] == (vence + timedelta(days=dias_acceso)).isoformat()
    # El taller ve las mismas fechas.
    propia = api.get("/api/v1/suscripcion", headers=datos["headers"]["admin_demo"]).json()
    assert (propia["fin_gracia"], propia["fin_acceso"]) == (
        cuerpo["fin_gracia"], cuerpo["fin_acceso"]
    )


def test_fechas_limite_sin_vencimiento(api, sa):
    with SessionLocal() as db:
        db.get(Taller, 1).suscripcion_vence_en = None
        db.commit()
    cuerpo = _suscripcion(api, sa, 1)
    assert (cuerpo["fin_gracia"], cuerpo["fin_acceso"]) == (None, None)
