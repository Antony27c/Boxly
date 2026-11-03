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
