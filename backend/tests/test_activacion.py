from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient
from jose import jwt

from app.core.config import get_settings
from app.core.email import ResultadoEnvio
from app.core.security import create_access_token, create_invitation_token, hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models import Cliente, Usuario
from app.models.usuario import RolUsuario
from main import app

CLAVE = "Clave1234"


@pytest.fixture
def datos():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        admin = Usuario(nombre="A", apellido="B", email="admin@x.com", password_hash=hash_password("x"),
                        rol=RolUsuario.administrador)
        mecanico = Usuario(nombre="M", apellido="C", email="mec@x.com", password_hash=hash_password("x"),
                           rol=RolUsuario.mecanico)
        juan = Cliente(nombre="Juan", apellido="Perez", dni="12345678", email="juan@x.com")
        sin_mail = Cliente(nombre="Ana", apellido="Sin", dni="87654321", email=None)
        db.add_all([admin, mecanico, juan, sin_mail])
        db.commit()
        return {
            "admin": {"Authorization": "Bearer " + create_access_token(admin.id)},
            "mecanico": {"Authorization": "Bearer " + create_access_token(mecanico.id)},
            "juan": juan.id,
            "sin_mail": sin_mail.id,
        }


@pytest.fixture
def envio(monkeypatch):
    mock = AsyncMock(return_value=ResultadoEnvio("enviado", "Activá tu cuenta de Boxly"))
    monkeypatch.setattr("app.api.v1.clientes.service.enviar_invitacion_portal", mock)
    return mock


@pytest.fixture
def api():
    with TestClient(app) as cliente:
        yield cliente


def _token_del_enlace(envio) -> str:
    return envio.await_args.args[2].split("token=")[1]


def _invitar(api, datos, cliente="juan"):
    return api.post(f"/api/v1/clientes/{datos[cliente]}/invitacion", headers=datos["admin"])


def test_invitar_manda_el_enlace_de_activacion(api, datos, envio):
    r = _invitar(api, datos)
    assert r.status_code == 200
    args = envio.await_args.args
    assert args[0] == "juan@x.com" and "/activar?token=" in args[2]


def test_flujo_completo_confirma_datos_y_entra(api, datos, envio):
    _invitar(api, datos)
    token = _token_del_enlace(envio)

    info = api.get("/api/v1/auth/activacion", params={"token": token}).json()
    assert info["nombre"] == "Juan" and info["email"] == "juan@x.com" and info["dni"] == "•••••678"

    sesion = api.post("/api/v1/auth/activacion", json={"token": token, "password": CLAVE, "confirmo_datos": True})
    assert sesion.status_code == 201 and sesion.json()["usuario"]["rol"] == "cliente"

    login = api.post("/api/v1/auth/login", json={"email": "juan@x.com", "password": CLAVE})
    assert login.status_code == 200
    clientes = api.get("/api/v1/clientes", headers=datos["admin"]).json()
    assert {c["nombre"]: c["tiene_cuenta"] for c in clientes} == {"Juan": True, "Ana": False}


def test_sin_confirmar_los_datos_no_se_crea_la_cuenta(api, datos, envio):
    _invitar(api, datos)
    r = api.post("/api/v1/auth/activacion",
                 json={"token": _token_del_enlace(envio), "password": CLAVE, "confirmo_datos": False})
    assert r.status_code == 422


def test_el_enlace_no_se_puede_usar_dos_veces(api, datos, envio):
    _invitar(api, datos)
    cuerpo = {"token": _token_del_enlace(envio), "password": CLAVE, "confirmo_datos": True}
    assert api.post("/api/v1/auth/activacion", json=cuerpo).status_code == 201
    assert api.post("/api/v1/auth/activacion", json=cuerpo).status_code == 409
    assert api.get("/api/v1/auth/activacion", params={"token": cuerpo["token"]}).status_code == 409


def test_contrasena_debil_se_rechaza(api, datos, envio):
    _invitar(api, datos)
    r = api.post("/api/v1/auth/activacion",
                 json={"token": _token_del_enlace(envio), "password": "sololetras", "confirmo_datos": True})
    assert r.status_code == 422


def test_enlace_vencido_o_falso(api, datos):
    s = get_settings()
    vencido = jwt.encode(
        {"sub": str(datos["juan"]), "email": "juan@x.com", "proposito": "activar_cuenta",
         "exp": datetime.now(timezone.utc) - timedelta(hours=1)},
        s.jwt_secret_key, algorithm=s.jwt_algorithm)
    for token in (vencido, "esto-no-es-un-token"):
        assert api.get("/api/v1/auth/activacion", params={"token": token}).status_code == 400


def test_si_el_taller_cambia_el_correo_el_enlace_viejo_deja_de_valer(api, datos, envio):
    _invitar(api, datos)
    token = _token_del_enlace(envio)
    with SessionLocal() as db:
        db.get(Cliente, datos["juan"]).email = "otro@x.com"
        db.commit()
    assert api.get("/api/v1/auth/activacion", params={"token": token}).status_code == 400


def test_el_enlace_de_invitacion_no_sirve_para_iniciar_sesion(api, datos):
    # su "sub" es el id del cliente: sin esta barrera coincidiría con el id de un usuario.
    token = create_invitation_token(datos["juan"], "juan@x.com")
    assert api.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code == 401


def test_cliente_sin_correo_no_se_puede_invitar(api, datos, envio):
    assert _invitar(api, datos, "sin_mail").status_code == 400
    envio.assert_not_awaited()


def test_si_falla_el_correo_el_administrador_lo_ve(api, datos, envio):
    envio.return_value = ResultadoEnvio("fallido", "Asunto", "SMTPAuthenticationError: clave mala")
    r = _invitar(api, datos)
    assert r.status_code == 502 and "clave mala" in r.json()["detail"]


def test_un_mecanico_no_puede_invitar(api, datos, envio):
    r = api.post(f"/api/v1/clientes/{datos['juan']}/invitacion", headers=datos["mecanico"])
    assert r.status_code == 403
    envio.assert_not_awaited()


def test_alta_de_cliente_con_correo_lo_invita_solo(api, datos, envio):
    r = api.post("/api/v1/clientes", headers=datos["admin"],
                 json={"nombre": "Luis", "apellido": "Gomez", "dni": "11223344", "email": "luis@x.com"})
    assert r.status_code == 201
    assert envio.await_args.args[0] == "luis@x.com"


def test_alta_de_cliente_sin_correo_no_manda_nada(api, datos, envio):
    api.post("/api/v1/clientes", headers=datos["admin"],
             json={"nombre": "Luis", "apellido": "Gomez", "dni": "11223344"})
    envio.assert_not_awaited()
