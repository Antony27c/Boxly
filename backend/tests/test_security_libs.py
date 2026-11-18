"""Librerías de autenticación: PyJWT + bcrypt directo."""
from datetime import datetime, timedelta, timezone

import jwt
import pytest
from fastapi.testclient import TestClient

from app.core.security import (
    PROPOSITO_ACTIVACION,
    create_access_token,
    create_invitation_token,
    decode_access_token,
    decode_invitation_token,
    hash_password,
    verify_password,
)
from app.main import app

# Hash $2b$ generado con la librería anterior (CryptContext bcrypt) antes de
# la migración: la contraseña original era "ClaveSecreta123".
_HASH_BCRYPT_ANTERIOR = "$2b$12$ZFVKn9xUyewEqderNjPyIuvUFvYWwJ6JJjjCTNVcbsNpBlC7HuTKW"


def test_hash_password_genera_bcrypt_y_verifica():
    h = hash_password("MiClaveSegura123")
    assert h.startswith("$2b$")
    assert verify_password("MiClaveSegura123", h) is True
    assert verify_password("otra-clave", h) is False


def test_verify_password_con_hash_invalido_devuelve_false():
    assert verify_password("x", "no-es-un-hash-bcrypt") is False


def test_hash_generado_con_libreria_anterior_sigue_verificando():
    assert verify_password("ClaveSecreta123", _HASH_BCRYPT_ANTERIOR) is True
    assert verify_password("clave-equivocada", _HASH_BCRYPT_ANTERIOR) is False


def test_access_token_roundtrip_conserva_claims():
    token = create_access_token(
        42,
        extra_claims={"rol": "administrador", "email": "admin@x.com"},
        token_version=3,
    )
    payload = decode_access_token(token)
    assert payload["sub"] == "42"
    assert payload["tv"] == 3
    assert payload["rol"] == "administrador"
    assert payload["email"] == "admin@x.com"
    assert "exp" in payload


def test_access_token_expirado_o_invalido_lanza_value_error():
    expirado = create_access_token(1, expires_minutes=-5)
    with pytest.raises(ValueError, match="Token inválido o expirado"):
        decode_access_token(expirado)
    with pytest.raises(ValueError, match="Token inválido o expirado"):
        decode_access_token("esto.no.es.un.jwt")


def test_access_token_firmado_con_otro_secreto_es_invalido():
    payload = {"sub": "1", "exp": datetime.now(timezone.utc) + timedelta(minutes=5)}
    token = jwt.encode(payload, "secreto-equivocado", algorithm="HS256")
    with pytest.raises(ValueError, match="Token inválido o expirado"):
        decode_access_token(token)


def test_token_de_invitacion_no_sirve_como_access_token():
    invitacion = create_invitation_token(7, "Ana@X.com")
    with pytest.raises(ValueError, match="Token inválido o expirado"):
        decode_access_token(invitacion)


def test_invitation_token_roundtrip():
    token = create_invitation_token(7, "Ana@X.com")
    payload = decode_invitation_token(token)
    assert payload["sub"] == "7"
    assert payload["email"] == "ana@x.com"
    assert payload["proposito"] == PROPOSITO_ACTIVACION


def test_invitation_token_invalido_lanza_value_error():
    with pytest.raises(ValueError, match="Token inválido o expirado"):
        decode_invitation_token("basura")
    access = create_access_token(1)
    with pytest.raises(ValueError, match="Token inválido o expirado"):
        decode_invitation_token(access)


def test_token_invalido_devuelve_401_en_la_api():
    api = TestClient(app)
    headers = {"Authorization": "Bearer token-inventado"}
    assert api.get("/api/v1/ordenes", headers=headers).status_code == 401

    expirado = create_access_token(1, expires_minutes=-5)
    headers = {"Authorization": f"Bearer {expirado}"}
    assert api.get("/api/v1/ordenes", headers=headers).status_code == 401
