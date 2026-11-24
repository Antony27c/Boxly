import asyncio
from unittest.mock import AsyncMock

import pytest

from app.core import email as mail
from app.core.config import get_settings


@pytest.fixture
def smtp(monkeypatch):
    s = get_settings()
    monkeypatch.setattr(s, "smtp_user", "taller@x.com")
    monkeypatch.setattr(s, "smtp_password", "pw")
    monkeypatch.setattr(s, "smtp_from_email", "taller@x.com")
    fake = AsyncMock()
    monkeypatch.setattr(mail, "_get_fastmail", lambda: fake)
    return fake


def _enviar(comentario="ok", nombre="Perez, Juan"):
    asyncio.run(mail.enviar_notificacion_cambio_estado(
        "c@x.com", nombre, "ABC123", "VW", "Gol", "OT-1", "Listo", comentario))


def test_escapa_html(smtp):
    _enviar(comentario="<script>x</script>", nombre="<b>Perez</b>")
    body = smtp.send_message.call_args[0][0].body
    assert "<script>x</script>" not in body and "&lt;script&gt;" in body
    assert "<b>Perez</b>" not in body


def test_fallo_smtp_no_propaga(smtp):
    smtp.send_message.side_effect = RuntimeError("smtp caído")
    _enviar()


def test_sin_config_no_envia(monkeypatch):
    monkeypatch.setattr(get_settings(), "smtp_user", "")
    fake = AsyncMock()
    monkeypatch.setattr(mail, "_get_fastmail", lambda: fake)
    _enviar()
    fake.send_message.assert_not_called()


def test_barra_de_progreso_marca_etapa_actual(smtp):
    asyncio.run(mail.enviar_notificacion_cambio_estado(
        "c@x.com", "Perez, Juan", "ABC123", "VW", "Gol", "OT-1", "En diagnóstico", "ok", "en_diagnostico"))
    body = smtp.send_message.call_args[0][0].body
    assert "etapa 3 de 6" in body and body.count("#16a34a") == 4  # 2 superadas: barra + texto cada una
    assert "Entregado" in body


def test_cancelada_no_muestra_barra_y_cobro_no_la_lleva(smtp):
    asyncio.run(mail.enviar_notificacion_cambio_estado(
        "c@x.com", "P", "A", "V", "G", "OT-1", "Cancelado", "ok", "cancelado"))
    body = smtp.send_message.call_args[0][0].body
    assert "fue cancelada" in body and "Avance de tu orden" not in body
    asyncio.run(mail.enviar_notificacion_cobro("c@x.com", "P", "A", "V", "G", "OT-1", "Listo", "$ 1.00"))
    assert "Avance de tu orden" not in smtp.send_message.call_args[0][0].body


@pytest.fixture
def http(monkeypatch):
    s = get_settings()
    monkeypatch.setattr(s, "smtp_from_email", "taller@x.com")
    monkeypatch.setattr(s, "smtp_user", "")
    monkeypatch.setattr(s, "smtp_password", "")
    monkeypatch.setattr(s, "resend_api_key", "")
    monkeypatch.setattr(s, "brevo_api_key", "")
    fake = AsyncMock(return_value=(200, "{}"))
    monkeypatch.setattr(mail, "_post_json", fake)
    smtp = AsyncMock()
    monkeypatch.setattr(mail, "_get_fastmail", lambda: smtp)
    return s, fake, smtp


def test_resend_manda_por_https_y_no_por_smtp(http):
    s, post, smtp = http
    s.resend_api_key = "re_123"
    _enviar()
    url, headers, payload = post.await_args.args
    assert url == "https://api.resend.com/emails" and headers == {"Authorization": "Bearer re_123"}
    assert payload["to"] == ["c@x.com"] and payload["from"].endswith("<taller@x.com>")
    smtp.send_message.assert_not_called()


def test_brevo_manda_por_https(http):
    s, post, smtp = http
    s.brevo_api_key = "xkeysib-1"
    _enviar()
    url, headers, payload = post.await_args.args
    assert url == "https://api.brevo.com/v3/smtp/email" and headers == {"api-key": "xkeysib-1"}
    assert payload["sender"]["email"] == "taller@x.com" and payload["to"] == [{"email": "c@x.com"}]
    smtp.send_message.assert_not_called()


def test_error_del_proveedor_queda_como_fallido(http):
    s, post, _ = http
    s.resend_api_key = "re_123"
    post.return_value = (403, '{"message":"dominio no verificado"}')
    r = asyncio.run(mail._enviar("c@x.com", "Asunto", "<p>x</p>", "OT-1"))
    assert r.resultado == "fallido" and "403" in r.error and "dominio no verificado" in r.error


def test_sin_claves_sigue_usando_smtp(http, monkeypatch):
    s, post, smtp = http
    monkeypatch.setattr(s, "smtp_user", "taller@x.com")
    monkeypatch.setattr(s, "smtp_password", "pw")
    _enviar()
    smtp.send_message.assert_awaited_once()
    post.assert_not_awaited()


def _cuerpo_estado(smtp, codigo, estado, **pago):
    asyncio.run(mail.enviar_notificacion_cambio_estado(
        "c@x.com", "P", "A", "V", "G", "OT-1", estado, "ok", codigo, **pago))
    return smtp.send_message.call_args[0][0].body


def test_pesos_con_formato_argentino():
    assert mail.pesos(15000) == "$ 15.000,00" and mail.pesos(1234567.5) == "$ 1.234.567,50"


def test_listo_con_cobro_y_pago_online_muestra_el_boton(smtp):
    body = _cuerpo_estado(smtp, "listo", "Listo", monto="$ 15.000,00",
                          enlace_pago="http://app/portal/orden/7")
    assert "Cómo pagar" in body and "$ 15.000,00" in body and "Mercado Pago" in body
    assert 'href="http://app/portal/orden/7"' in body and "Pagar mi orden" in body


def test_listo_con_cobro_sin_pago_online_indica_pagar_en_el_local(smtp):
    body = _cuerpo_estado(smtp, "listo", "Listo", monto="$ 15.000,00")
    assert "$ 15.000,00" in body and "abonás en el taller" in body
    assert "Pagar mi orden" not in body and "Mercado Pago" not in body


def test_listo_sin_cobro_avisa_que_se_define(smtp):
    body = _cuerpo_estado(smtp, "listo", "Listo", enlace_pago="http://app/portal/orden/7")
    assert "definiendo el monto" in body and "Pagar mi orden" not in body


def test_orden_pagada_agradece_y_otros_estados_no_hablan_de_pago(smtp):
    assert "ya está paga" in _cuerpo_estado(smtp, "entregado", "Entregado", pagada=True)
    assert "Cómo pagar" not in _cuerpo_estado(smtp, "en_diagnostico", "En diagnóstico")


def test_correo_de_cobro_lleva_como_pagar(smtp):
    asyncio.run(mail.enviar_notificacion_cobro(
        "c@x.com", "P", "A", "V", "G", "OT-1", "Listo", "$ 9.000,00", "http://app/portal/orden/7"))
    body = smtp.send_message.call_args[0][0].body
    assert "Pagar mi orden" in body and "http://app/portal/orden/7" in body and "$ 9.000,00" in body
    asyncio.run(mail.enviar_notificacion_cobro("c@x.com", "P", "A", "V", "G", "OT-1", "Listo", "$ 9.000,00"))
    body = smtp.send_message.call_args[0][0].body
    assert "abonás en el taller" in body and "Pagar mi orden" not in body
