"""Tests de seguridad del login (F1-D): enumeración de usuarios, rate limit
e invalidación de tokens al cambiar la contraseña."""

from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
import jwt

from app.core.config import get_settings
from app.core.rate_limit import configurar_rate_limit, limiter
from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.main import app
from app.models import Usuario
from app.models.usuario import RolUsuario


@pytest.fixture
def datos():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        admin = Usuario(
            nombre="A", apellido="B", email="admin@x.com",
            password_hash=hash_password("AdminClave9"), rol=RolUsuario.administrador,
        )
        maria = Usuario(
            nombre="Maria", apellido="Lopez", email="maria@x.com",
            password_hash=hash_password("Clave1234"), rol=RolUsuario.recepcion,
        )
        db.add_all([admin, maria])
        db.commit()
        return {
            "admin": {"Authorization": "Bearer " + create_access_token(admin.id)},
            "maria_id": maria.id,
        }


@pytest.fixture
def api():
    with TestClient(app) as cliente:
        yield cliente


@pytest.fixture
def limiter_activo(monkeypatch):
    """Enciende el rate limit solo para este test y limpia los contadores al salir."""
    monkeypatch.setenv("RATE_LIMIT_ENABLED", "true")
    estado_previo = limiter.enabled
    configurar_rate_limit(app)
    limiter.reset()
    yield
    limiter.reset()
    limiter.enabled = estado_previo


def _login(api, email, password):
    return api.post("/api/v1/auth/login", json={"email": email, "password": password})


def _me(api, token):
    return api.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})


def _cambiar_password(api, datos, nueva):
    return api.put(
        f"/api/v1/users/{datos['maria_id']}",
        headers=datos["admin"],
        json={"password": nueva},
    )


def test_login_no_revela_si_el_email_existe(api, datos):
    # Email inexistente y contraseña incorrecta devuelven exactamente el mismo error.
    inexistente = _login(api, "nadie@x.com", "Clave1234")
    password_mala = _login(api, "maria@x.com", "ClaveMala9")
    assert inexistente.status_code == 401
    assert inexistente.json() == password_mala.json()
    assert inexistente.json()["detail"] == "Email o contraseña incorrectos"


def test_token_previo_al_cambio_de_contrasena_da_401(api, datos):
    sesion = _login(api, "maria@x.com", "Clave1234")
    assert sesion.status_code == 200
    token_viejo = sesion.json()["access_token"]
    assert _me(api, token_viejo).status_code == 200

    assert _cambiar_password(api, datos, "NuevaClave9").status_code == 200

    # El token emitido antes del cambio ya no sirve...
    assert _me(api, token_viejo).status_code == 401
    # ...y la sesión iniciada con la contraseña nueva sí.
    sesion2 = _login(api, "maria@x.com", "NuevaClave9")
    assert sesion2.status_code == 200
    assert _me(api, sesion2.json()["access_token"]).status_code == 200


def test_token_sin_claim_tv_se_toma_como_version_cero(api, datos):
    # JWT firmado antes de que existiera "tv": vale mientras tv del usuario sea 0.
    settings = get_settings()
    token_sin_tv = jwt.encode(
        {
            "sub": str(datos["maria_id"]),
            "exp": datetime.now(timezone.utc) + timedelta(minutes=30),
        },
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )
    assert _me(api, token_sin_tv).status_code == 200

    assert _cambiar_password(api, datos, "OtraClave9").status_code == 200
    assert _me(api, token_sin_tv).status_code == 401


def test_sexto_intento_de_login_en_un_minuto_da_429(api, datos, limiter_activo):
    for _ in range(5):
        assert _login(api, "maria@x.com", "ClaveMala9").status_code == 401
    assert _login(api, "maria@x.com", "ClaveMala9").status_code == 429
