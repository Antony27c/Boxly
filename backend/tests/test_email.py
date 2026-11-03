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
