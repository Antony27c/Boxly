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
