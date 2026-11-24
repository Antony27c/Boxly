# ruff: noqa: F811 (los fixtures se importan de otro módulo de tests)
"""pago → piloto cancela el cobro automático en Mercado Pago (tarea R3h).

Un taller pago con preapproval viva no puede quedar en piloto con el cobro
siguiendo: la conversión la cancela en MP y limpia ``cobro_automatico`` y
``mp_preapproval_id`` en la misma transacción. Si MP no confirma, la
conversión no se aplica: 502 sin cambios (mejor reintentar que quedar en
piloto con el cobro vivo).
"""
from datetime import timedelta
from types import SimpleNamespace

from app.api.v1.suscripcion_mp import cliente_mp
from app.api.v1.suscripcion_mp import service as mp_service
from app.core import mercadopago as mp
from app.core.suscripcion import hoy
from app.db.session import SessionLocal
from app.models import Taller
from tests.test_acceso_adicionales import (  # noqa: F401
    _taller,
    api,
    datos,
    sa,
)


def _settings_sus(monkeypatch, **cambios):
    """Settings de prueba para el service de suscripción MP."""
    fake = SimpleNamespace(
        debug=True,
        environment="dev",
        boxly_mp_access_token="tok-boxly",
        boxly_mp_webhook_secret=None,
        frontend_url="http://front.test",
        backend_public_url=None,
    )
    for clave, valor in cambios.items():
        setattr(fake, clave, valor)
    monkeypatch.setattr(mp_service, "get_settings", lambda: fake)
    return fake


def _poner_cobro(taller_id: int = 1, preapproval_id: str = "pre-9") -> None:
    """Deja el taller con cobro automático y preapproval en MP."""
    with SessionLocal() as db:
        taller = db.get(Taller, taller_id)
        taller.cobro_automatico = True
        taller.mp_preapproval_id = preapproval_id
        db.commit()


def _convertir_piloto(api, sa, taller_id: int = 1):
    return api.post(
        f"/api/v1/plataforma/talleres/{taller_id}/acceso",
        headers=sa,
        json={
            "tipo": "piloto",
            "plan": "pro",
            "vence_en": (hoy() + timedelta(days=90)).isoformat(),
            "motivo": "Convenio",
        },
    )


def test_pago_a_piloto_cancela_la_preapproval_en_mp(api, datos, sa, monkeypatch):
    """La conversión cancela la preapproval en MP y limpia las marcas."""
    _poner_cobro()
    _settings_sus(monkeypatch)
    canceladas = []
    monkeypatch.setattr(
        cliente_mp, "cancelar_preapproval",
        lambda token, pid: canceladas.append((token, pid)) or {},
    )

    r = _convertir_piloto(api, sa)
    assert r.status_code == 200, r.text
    assert canceladas == [("tok-boxly", "pre-9")]

    taller = _taller(1)
    assert taller.tipo_acceso == "piloto"
    assert taller.cobro_automatico is False
    assert taller.mp_preapproval_id is None


def test_pago_a_piloto_sin_preapproval_no_llama_a_mp(api, datos, sa, monkeypatch):
    """Sin mp_preapproval_id no hay nada que cancelar en MP."""
    _settings_sus(monkeypatch)
    llamadas = []
    monkeypatch.setattr(
        cliente_mp, "cancelar_preapproval",
        lambda *a, **k: llamadas.append(a),
    )

    r = _convertir_piloto(api, sa)
    assert r.status_code == 200, r.text
    assert llamadas == []
    taller = _taller(1)
    assert taller.tipo_acceso == "piloto"


def test_pago_a_piloto_si_mp_falla_no_convierte(api, datos, sa, monkeypatch):
    """Si MP no confirma la cancelación, la conversión no se aplica: el
    taller seguiría pagando en piloto."""
    _poner_cobro()
    _settings_sus(monkeypatch)

    def falla(*a, **k):
        raise mp.MercadoPagoError("MP caído")

    monkeypatch.setattr(cliente_mp, "cancelar_preapproval", falla)
    r = _convertir_piloto(api, sa)
    assert r.status_code == 502

    taller = _taller(1)
    assert taller.tipo_acceso == "pago"
    assert taller.cobro_automatico is True
    assert taller.mp_preapproval_id == "pre-9"


def test_demo_a_piloto_no_toca_mp(api, datos, sa, monkeypatch):
    """Solo un taller pago cancela cobro: la demo nunca tuvo preapproval."""
    _settings_sus(monkeypatch)
    llamadas = []
    monkeypatch.setattr(
        cliente_mp, "cancelar_preapproval",
        lambda *a, **k: llamadas.append(a),
    )

    r = _convertir_piloto(api, sa, taller_id=datos["demo_id"])
    assert r.status_code == 200, r.text
    assert llamadas == []
    assert _taller(datos["demo_id"]).tipo_acceso == "piloto"


def test_cancelar_cobro_sigue_funcionando(api, datos, monkeypatch):
    """El endpoint del taller delega en cancelar_cobro_taller: mismo
    comportamiento (cancela en MP y limpia las marcas locales)."""
    _settings_sus(monkeypatch)
    _poner_cobro()
    canceladas = []
    monkeypatch.setattr(
        cliente_mp, "cancelar_preapproval",
        lambda token, pid: canceladas.append(pid) or {},
    )

    r = api.delete(
        "/api/v1/suscripcion/cobro-automatico",
        headers=datos["headers"]["admin"],
    )
    assert r.status_code == 200, r.text
    assert canceladas == ["pre-9"]
    taller = _taller(1)
    assert taller.cobro_automatico is False
    assert taller.mp_preapproval_id is None


def test_cancelar_cobro_sin_preapproval_da_404(api, datos, monkeypatch):
    """Sin preapproval el endpoint sigue respondiendo 404 como antes."""
    _settings_sus(monkeypatch)
    r = api.delete(
        "/api/v1/suscripcion/cobro-automatico",
        headers=datos["headers"]["admin"],
    )
    assert r.status_code == 404
