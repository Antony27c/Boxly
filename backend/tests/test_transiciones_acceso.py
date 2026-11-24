# ruff: noqa: F811 (los fixtures se importan de otro módulo de tests)
"""Transiciones del tipo de acceso (auditoría R2, bugs 2 y 3).

El superadmin nunca le acorta el acceso a un taller sin decirlo explícitamente:
sin ``vence_en`` se conserva lo que el taller ya tenía, y las vueltas atrás
(a demo) no se permiten. Cada conversión y cada alta o baja de un adicional
dejan el detalle en la auditoría de la plataforma.
"""
from datetime import timedelta

import pytest

from app.core.suscripcion import hoy
from app.db.session import SessionLocal
from app.models import Taller
from tests.test_acceso_adicionales import (  # noqa: F401
    _detalles_de_acceso,
    _taller,
    api,
    datos,
    sa,
)

MSG_DEMO_ACTIVA = "La demo ya está activa; para extenderla indicá la nueva fecha"
MSG_PILOTO_A_DEMO = "Un piloto no puede volver a demo"
MSG_PAGO_A_DEMO = "Un taller pago no puede volver a demo"


def _convertir(api, sa, taller_id, **body):
    if "vence_en" in body and body["vence_en"] is not None:
        body["vence_en"] = body["vence_en"].isoformat()
    return api.post(f"/api/v1/plataforma/talleres/{taller_id}/acceso", headers=sa, json=body)


def _poner(taller_id, tipo, dias, plan="pro"):
    with SessionLocal() as db:
        taller = db.get(Taller, taller_id)
        taller.tipo_acceso = tipo
        taller.plan_codigo = plan
        taller.suscripcion_vence_en = hoy() + timedelta(days=dias)
        db.commit()


# --- demo / piloto / pago → pago ---------------------------------------------------


def test_demo_a_pago_sin_fecha_conserva_los_dias_de_demo(api, datos, sa):
    r = _convertir(api, sa, datos["demo_id"], tipo="pago", plan="esencial")
    assert r.status_code == 200, r.text
    assert r.json()["vence_en"] == (hoy() + timedelta(days=5)).isoformat()


def test_demo_vencida_a_pago_sin_fecha_vence_hoy(api, datos, sa):
    _poner(datos["demo_id"], "demo", -2)
    r = _convertir(api, sa, datos["demo_id"], tipo="pago", plan="esencial")
    assert r.status_code == 200, r.text
    assert r.json()["vence_en"] == hoy().isoformat()


def test_demo_a_pago_con_fecha_usa_esa_fecha(api, datos, sa):
    vence = hoy() + timedelta(days=2)
    r = _convertir(api, sa, datos["demo_id"], tipo="pago", plan="esencial", vence_en=vence)
    assert r.status_code == 200, r.text
    assert r.json()["vence_en"] == vence.isoformat()


def test_piloto_a_pago_sin_fecha_conserva_el_piloto(api, datos, sa):
    _poner(datos["demo_id"], "piloto", 20)
    r = _convertir(api, sa, datos["demo_id"], tipo="pago", plan="pro")
    assert r.status_code == 200, r.text
    assert r.json()["vence_en"] == (hoy() + timedelta(days=20)).isoformat()


def test_pago_a_pago_sin_fecha_no_pierde_lo_pagado(api, sa):
    r = _convertir(api, sa, 1, tipo="pago", plan="pro")
    assert r.status_code == 200, r.text
    assert r.json()["vence_en"] == (hoy() + timedelta(days=30)).isoformat()


# --- → demo ------------------------------------------------------------------------


def test_demo_a_demo_sin_fecha_da_409(api, datos, sa):
    r = _convertir(api, sa, datos["demo_id"], tipo="demo")
    assert r.status_code == 409
    assert r.json()["detail"] == MSG_DEMO_ACTIVA
    assert _taller(datos["demo_id"]).suscripcion_vence_en == hoy() + timedelta(days=5)


@pytest.mark.parametrize("dias", [5, 3])
def test_demo_a_demo_con_fecha_que_no_extiende_da_409(api, datos, sa, dias):
    r = _convertir(api, sa, datos["demo_id"], tipo="demo", vence_en=hoy() + timedelta(days=dias))
    assert r.status_code == 409
    assert _taller(datos["demo_id"]).suscripcion_vence_en == hoy() + timedelta(days=5)


def test_demo_a_demo_con_fecha_posterior_extiende_la_demo(api, datos, sa):
    vence = hoy() + timedelta(days=10)
    r = _convertir(api, sa, datos["demo_id"], tipo="demo", vence_en=vence)
    assert r.status_code == 200, r.text
    assert r.json()["tipo_acceso"] == "demo"
    assert r.json()["plan"]["codigo"] == "pro"
    assert r.json()["vence_en"] == vence.isoformat()


def test_piloto_a_demo_da_409(api, datos, sa):
    _poner(datos["demo_id"], "piloto", 20)
    r = _convertir(api, sa, datos["demo_id"], tipo="demo", vence_en=hoy() + timedelta(days=40))
    assert r.status_code == 409
    assert r.json()["detail"] == MSG_PILOTO_A_DEMO
    assert _taller(datos["demo_id"]).tipo_acceso == "piloto"


def test_pago_a_demo_da_409(api, sa):
    r = _convertir(api, sa, 1, tipo="demo")
    assert r.status_code == 409
    assert r.json()["detail"] == MSG_PAGO_A_DEMO
    taller = _taller(1)
    assert (taller.tipo_acceso, taller.suscripcion_vence_en) == ("pago", hoy() + timedelta(days=30))


# --- → piloto ----------------------------------------------------------------------


def test_piloto_a_piloto_con_fecha_explicita(api, datos, sa):
    _poner(datos["demo_id"], "piloto", 20)
    vence = hoy() + timedelta(days=60)
    r = _convertir(api, sa, datos["demo_id"], tipo="piloto", plan="pro", vence_en=vence,
                   motivo="Extensión del piloto")
    assert r.status_code == 200, r.text
    assert r.json()["vence_en"] == vence.isoformat()


def test_pago_a_piloto_con_fecha_y_motivo(api, sa):
    vence = hoy() + timedelta(days=90)
    r = _convertir(api, sa, 1, tipo="piloto", plan="pro", vence_en=vence, motivo="Convenio")
    assert r.status_code == 200, r.text
    assert (r.json()["tipo_acceso"], r.json()["vence_en"]) == ("piloto", vence.isoformat())


# --- Auditoría ---------------------------------------------------------------------


def test_la_conversion_deja_el_detalle_completo_aunque_no_haya_motivo(api, datos, sa):
    antes = hoy() + timedelta(days=5)
    assert _convertir(api, sa, datos["demo_id"], tipo="pago", plan="esencial").status_code == 200
    assert _detalles_de_acceso(datos["demo_id"]) == [
        f"Acceso demo → pago. Plan pro → esencial. Vence {antes.isoformat()} → {antes.isoformat()}. "
        "Motivo: sin motivo"
    ]


def test_la_conversion_rechazada_no_deja_detalle(api, sa):
    assert _convertir(api, sa, 1, tipo="demo").status_code == 409
    assert _detalles_de_acceso(1) == []


def test_alta_y_baja_de_adicional_quedan_auditadas(api, sa):
    url = "/api/v1/plataforma/talleres/1/adicionales"
    hasta = hoy() + timedelta(days=30)
    alta = api.post(url, headers=sa, json={"codigo": "arca", "hasta": hasta.isoformat()})
    assert alta.status_code == 201, alta.text
    assert api.delete(f"{url}/arca", headers=sa).status_code == 204
    assert _detalles_de_acceso(1) == [
        f"Adicional arca activado: desde sin fecha, hasta {hasta.isoformat()}",
        "Adicional arca desactivado",
    ]
