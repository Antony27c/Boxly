"""Pruebas del módulo compartido de Mercado Pago (app/core/mercadopago.py).

La firma del webhook y la validación de ids son las mismas para la cuenta de
cada taller y para la de Boxly; acá se prueban una sola vez.
"""
import hashlib
import hmac
import time
import urllib.error
import urllib.request

import pytest

from app.core import mercadopago as mp

SECRETO = "secreto-compartido"


def _x_signature(secret, data_id, request_id, ts):
    manifest = f"id:{data_id};request-id:{request_id};ts:{ts};"
    v1 = hmac.new(secret.encode(), manifest.encode(), hashlib.sha256).hexdigest()
    return f"ts={ts},v1={v1}", request_id


def test_firma_valida_acepta_firma_correcta():
    ts = str(int(time.time()))
    firma, request_id = _x_signature(SECRETO, "123", "req-1", ts)
    assert mp.firma_valida(SECRETO, "123", firma, request_id)


def test_firma_valida_rechaza_v1_distinto():
    ts = str(int(time.time()))
    firma, request_id = _x_signature(SECRETO, "123", "req-1", ts)
    firma_mala = firma.replace(firma.split("v1=")[1], "0" * 64)
    assert not mp.firma_valida(SECRETO, "123", firma_mala, request_id)


def test_firma_valida_rechaza_otro_data_id():
    """La firma está atada al id de la notificación: no sirve para otra."""
    ts = str(int(time.time()))
    firma, request_id = _x_signature(SECRETO, "123", "req-1", ts)
    assert not mp.firma_valida(SECRETO, "456", firma, request_id)


@pytest.mark.parametrize(
    "firma,request_id",
    [
        (None, "req-1"),
        ("", "req-1"),
        ("ts=123,v1=abc", None),
        ("sin-partes", "req-1"),
        ("ts=123", "req-1"),  # falta v1
    ],
)
def test_firma_valida_rechaza_headers_incompletos(firma, request_id):
    assert not mp.firma_valida(SECRETO, "123", firma, request_id)


def test_firma_valida_ventana_rechaza_ts_viejo():
    ts_viejo = "1700000000"
    firma, request_id = _x_signature(SECRETO, "123", "req-1", ts_viejo)
    # Con ventana (producción) un aviso viejo no pasa...
    assert not mp.firma_valida(
        SECRETO, "123", firma, request_id, ventana_seg=mp.VENTANA_FIRMA_SEG
    )
    # ...y sin ventana (desarrollo) la misma firma de prueba sí.
    assert mp.firma_valida(SECRETO, "123", firma, request_id)


def test_firma_valida_acepta_ts_en_milisegundos():
    """Algunos avisos de MP mandan el ts en milisegundos."""
    ts_ms = str(int(time.time() * 1000))
    firma, request_id = _x_signature(SECRETO, "123", "req-1", ts_ms)
    assert mp.firma_valida(
        SECRETO, "123", firma, request_id, ventana_seg=mp.VENTANA_FIRMA_SEG
    )


def test_firma_valida_ts_no_numerico_falla():
    firma, request_id = _x_signature(SECRETO, "123", "req-1", "no-es-fecha")
    assert not mp.firma_valida(
        SECRETO, "123", firma, request_id, ventana_seg=mp.VENTANA_FIRMA_SEG
    )


@pytest.mark.parametrize(
    "valor,esperado",
    [
        ("12345", True),
        ("pre-1", True),
        ("9f8e7d6c-1234-abcd-ef01-23456789abcd", True),
        ("../x", False),
        ("a/b", False),
        ("x" * 65, False),
        ("", False),
        ("con espacio", False),
        ("punto.final", False),
    ],
)
def test_id_seguro(valor, esperado):
    assert bool(mp.ID_SEGURO.fullmatch(valor)) is esperado


def test_request_traduce_error_de_red(monkeypatch):
    def urlopen_caido(request, timeout):
        raise urllib.error.URLError("sin conexión")

    monkeypatch.setattr(urllib.request, "urlopen", urlopen_caido)
    with pytest.raises(mp.MercadoPagoError):
        mp.request("GET", "/v1/payments/1", "token")


def test_request_json_roto_es_error_de_mp(monkeypatch):
    class RespuestaFalsa:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def read(self):
            return b"esto no es json"

    monkeypatch.setattr(urllib.request, "urlopen", lambda *a, **k: RespuestaFalsa())
    with pytest.raises(mp.MercadoPagoError):
        mp.request("GET", "/v1/payments/1", "token")
