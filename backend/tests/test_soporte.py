"""Tests del acceso de soporte (tarea P2, contrato en docs/Plataforma.md).

El superadmin solo ve datos de un taller si el taller lo autorizó: acceso
temporal, solo lectura, datos personales enmascarados y todo auditado.
"""
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.enmascarado import _enmascarar, _enmascarar_texto
from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.main import app
from app.models import (
    AccesoSoporte,
    Auditoria,
    Cliente,
    Orden,
    Taller,
    Usuario,
    Vehiculo,
)
from app.models.usuario import RolUsuario

PASSWORD = "Clave1234"
HEADER_SOPORTE_1 = {"X-Taller-Soporte": "1"}


@pytest.fixture
def datos():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        taller2 = Taller(nombre="Taller Norte")
        db.add(taller2)
        db.flush()

        usuarios = {
            "admin1": Usuario(
                nombre="Admin", apellido="Uno", email="admin1@x.com",
                password_hash=hash_password(PASSWORD),
                rol=RolUsuario.administrador, taller_id=1,
            ),
            "recepcion1": Usuario(
                nombre="Recep", apellido="Uno", email="recep1@x.com",
                password_hash=hash_password(PASSWORD),
                rol=RolUsuario.recepcion, taller_id=1,
            ),
            "admin2": Usuario(
                nombre="Admin", apellido="Dos", email="admin2@x.com",
                password_hash=hash_password(PASSWORD),
                rol=RolUsuario.administrador, taller_id=taller2.id,
            ),
            "superadmin": Usuario(
                nombre="Super", apellido="Admin", email="super@x.com",
                password_hash=hash_password(PASSWORD),
                rol=RolUsuario.superadmin,
            ),
        }
        cliente1 = Cliente(
            nombre="Ana", apellido="Uno", dni="30111222",
            telefono="1155550001", email="ana@x.com",
            direccion="Calle Falsa 123", taller_id=1,
        )
        cliente2 = Cliente(
            nombre="Beto", apellido="Dos", dni="30999888",
            telefono="1155550002", email="beto@x.com",
            direccion="Otra Calle 456", taller_id=taller2.id,
        )
        db.add_all([*usuarios.values(), cliente1, cliente2])
        db.flush()
        vehiculo2 = Vehiculo(
            cliente_id=cliente2.id, patente="BBB222", marca="Ford",
            modelo="Focus", taller_id=taller2.id,
        )
        db.add(vehiculo2)
        db.flush()
        orden2 = Orden(
            cliente_id=cliente2.id, vehiculo_id=vehiculo2.id,
            creado_por_id=usuarios["admin2"].id, codigo="OT-2001",
            estado="pendiente", descripcion_ingreso="Service completo",
            taller_id=taller2.id,
        )
        db.add(orden2)
        db.commit()

        def token(u):
            return {
                "Authorization": "Bearer "
                + create_access_token(
                    u.id, {"email": u.email, "rol": u.rol.value}
                )
            }

        return {
            "headers": {rol: token(u) for rol, u in usuarios.items()},
            "usuarios": usuarios,
            "taller2_id": taller2.id,
            "cliente1_id": cliente1.id,
            "cliente2_id": cliente2.id,
            "orden2_id": orden2.id,
        }


@pytest.fixture
def api():
    with TestClient(app) as cliente:
        yield cliente


def _acceso_directo(taller_id: int, **campos) -> int:
    """Crea un AccesoSoporte sin contexto de taller (los tests lo hacen directo)."""
    datos_acceso = {
        "taller_id": taller_id,
        "desde": datetime.now(timezone.utc) - timedelta(minutes=1),
        "hasta": datetime.now(timezone.utc) + timedelta(hours=4),
    }
    datos_acceso.update(campos)
    with SessionLocal() as db:
        acceso = AccesoSoporte(**datos_acceso)
        db.add(acceso)
        db.commit()
        return acceso.id


def _filas_auditoria(**filtros) -> list[Auditoria]:
    with SessionLocal() as db:
        stmt = select(Auditoria)
        for campo, valor in filtros.items():
            stmt = stmt.where(getattr(Auditoria, campo) == valor)
        return list(db.scalars(stmt.order_by(Auditoria.id)).all())


# --- Lado taller: otorgar, historial y revocar -------------------------------

def test_admin_otorga_ve_historial_y_revoca(api, datos):
    headers = datos["headers"]["admin1"]

    r = api.post(
        "/api/v1/soporte/accesos",
        headers=headers,
        json={"horas": 4, "motivo": "Revisar un cobro"},
    )
    assert r.status_code == 201
    acceso = r.json()
    assert acceso["taller_id"] == 1
    assert acceso["vigente"] is True
    assert acceso["motivo"] == "Revisar un cobro"
    assert acceso["otorgado_por"]["email"] == "admin1@x.com"
    assert acceso["revocado_en"] is None
    # La ventana dura las horas pedidas.
    desde = datetime.fromisoformat(acceso["desde"])
    hasta = datetime.fromisoformat(acceso["hasta"])
    assert (hasta - desde) == timedelta(hours=4)

    # Historial: el acceso aparece, más nuevo primero.
    r = api.get("/api/v1/soporte/accesos", headers=headers)
    assert r.status_code == 200
    assert [a["id"] for a in r.json()] == [acceso["id"]]

    # Con uno vigente, otro otorgamiento da 409.
    r = api.post("/api/v1/soporte/accesos", headers=headers, json={"horas": 1})
    assert r.status_code == 409

    # Revocar.
    r = api.post(
        f"/api/v1/soporte/accesos/{acceso['id']}/revocar", headers=headers
    )
    assert r.status_code == 200
    assert r.json()["revocado_en"] is not None
    assert r.json()["vigente"] is False

    # Ya revocado se puede volver a listar y el 409 no aplica más.
    r = api.get("/api/v1/soporte/accesos", headers=headers)
    assert r.json()[0]["vigente"] is False
    r = api.post("/api/v1/soporte/accesos", headers=headers, json={"horas": 1})
    assert r.status_code == 201


def test_otorgar_valida_rol_y_payload(api, datos):
    # Solo el administrador del taller.
    for rol in ("recepcion1", "superadmin"):
        r = api.post(
            "/api/v1/soporte/accesos",
            headers=datos["headers"][rol],
            json={"horas": 1},
        )
        assert r.status_code == 403, rol
    # Horas fuera de la lista y motivo largo: 422.
    headers = datos["headers"]["admin1"]
    assert api.post(
        "/api/v1/soporte/accesos", headers=headers, json={"horas": 2}
    ).status_code == 422
    assert api.post(
        "/api/v1/soporte/accesos",
        headers=headers,
        json={"horas": 1, "motivo": "x" * 301},
    ).status_code == 422
    # Sin token: 401.
    assert api.get("/api/v1/soporte/accesos").status_code == 401


def test_otro_taller_no_ve_ni_revoca_accesos_ajenos(api, datos):
    headers1 = datos["headers"]["admin1"]
    r = api.post(
        "/api/v1/soporte/accesos", headers=headers1, json={"horas": 4}
    )
    acceso_id = r.json()["id"]

    headers2 = datos["headers"]["admin2"]
    r = api.get("/api/v1/soporte/accesos", headers=headers2)
    assert r.status_code == 200
    assert r.json() == []

    r = api.post(
        f"/api/v1/soporte/accesos/{acceso_id}/revocar", headers=headers2
    )
    assert r.status_code == 404


def test_actividad_muestra_lo_que_hizo_el_superadmin(api, datos):
    _acceso_directo(1)
    headers_soporte = {
        **datos["headers"]["superadmin"],
        **HEADER_SOPORTE_1,
    }
    assert api.get("/api/v1/clientes", headers=headers_soporte).status_code == 200

    r = api.get("/api/v1/soporte/actividad", headers=datos["headers"]["admin1"])
    assert r.status_code == 200
    filas = [f for f in r.json() if f["ruta"] == "/api/v1/clientes"]
    assert len(filas) == 1
    assert filas[0]["metodo"] == "GET"
    assert filas[0]["usuario_email"] == "super@x.com"


# --- Lado plataforma ----------------------------------------------------------

def test_plataforma_soporte_lista_vigentes(api, datos):
    _acceso_directo(1, motivo="soporte facturación")
    _acceso_directo(
        datos["taller2_id"],
        hasta=datetime.now(timezone.utc) - timedelta(hours=1),
    )  # vencido: no aparece

    headers = datos["headers"]["superadmin"]
    r = api.get("/api/v1/plataforma/soporte", headers=headers)
    assert r.status_code == 200
    assert len(r.json()) == 1
    vigente = r.json()[0]
    assert vigente["taller_id"] == 1
    assert vigente["taller_nombre"] == "Taller principal"
    assert vigente["motivo"] == "soporte facturación"
    hasta = datetime.fromisoformat(vigente["hasta"])
    if hasta.tzinfo is None:
        hasta = hasta.replace(tzinfo=timezone.utc)
    assert hasta > datetime.now(timezone.utc)

    for rol in ("admin1", "admin2", "recepcion1"):
        r = api.get("/api/v1/plataforma/soporte", headers=datos["headers"][rol])
        assert r.status_code == 403, rol
    assert api.get("/api/v1/plataforma/soporte").status_code == 401


# --- Modo soporte: lectura, enmascarado y auditoría ---------------------------

def _headers_soporte(datos, taller_id=1):
    return {
        **datos["headers"]["superadmin"],
        "X-Taller-Soporte": str(taller_id),
    }


def test_superadmin_lee_el_taller_con_datos_enmascarados(api, datos):
    _acceso_directo(1)
    headers = _headers_soporte(datos, 1)

    r = api.get("/api/v1/clientes", headers=headers)
    assert r.status_code == 200
    cuerpo = r.json()
    assert len(cuerpo) == 1  # solo los clientes del taller 1
    cliente = cuerpo[0]
    assert cliente["nombre"] == "Ana"
    # Datos personales enmascarados: últimos 4 visibles.
    assert cliente["dni"] == "****1222"
    assert cliente["telefono"] == "****0001"
    assert cliente["email"] == "****.com"
    assert cliente["direccion"] == "**** 123"
    # El dato real no viaja en la respuesta.
    assert "30111222" not in r.text
    assert "ana@x.com" not in r.text
    assert "1155550001" not in r.text

    # Las órdenes del taller también se leen (rol "como administrador").
    r = api.get("/api/v1/ordenes", headers=headers)
    assert r.status_code == 200

    # /auth/me no cambia: el email del propio superadmin no se enmascara.
    r = api.get("/api/v1/auth/me", headers=headers)
    assert r.status_code == 200
    assert r.json()["email"] == "super@x.com"


def test_modo_soporte_con_otro_taller_no_ve_sus_datos(api, datos):
    _acceso_directo(datos["taller2_id"])
    headers = _headers_soporte(datos, datos["taller2_id"])

    r = api.get("/api/v1/clientes", headers=headers)
    assert r.status_code == 200
    assert [c["nombre"] for c in r.json()] == ["Beto"]
    assert r.json()[0]["dni"] == "****9888"

    # El taller 1 no aparece: el contexto es el del header.
    r = api.get(f"/api/v1/clientes/{datos['cliente1_id']}", headers=headers)
    assert r.status_code == 404


def test_modo_soporte_es_solo_lectura(api, datos):
    _acceso_directo(1)
    headers = _headers_soporte(datos, 1)

    r = api.post(
        "/api/v1/clientes",
        headers=headers,
        json={"nombre": "Nuevo", "apellido": "Cliente", "dni": "40000001"},
    )
    assert r.status_code == 403
    assert r.json()["detail"] == "El modo soporte es de solo lectura"

    r = api.patch(
        f"/api/v1/ordenes/{datos['orden2_id']}",
        headers=headers,
        json={"diagnostico": "algo"},
    )
    assert r.status_code == 403

    r = api.delete("/api/v1/vehiculos/1", headers=headers)
    assert r.status_code == 403


def test_sin_acceso_vencido_o_revocado_da_403(api, datos):
    headers = _headers_soporte(datos, 1)

    # Sin ningún acceso.
    r = api.get("/api/v1/clientes", headers=headers)
    assert r.status_code == 403
    assert r.json()["detail"] == "El taller no te dio acceso de soporte"

    # Vencido.
    _acceso_directo(
        1, hasta=datetime.now(timezone.utc) - timedelta(hours=1)
    )
    assert api.get("/api/v1/clientes", headers=headers).status_code == 403

    # Revocado.
    _acceso_directo(1, revocado_en=datetime.now(timezone.utc))
    assert api.get("/api/v1/clientes", headers=headers).status_code == 403

    # Header con un taller que no dio acceso (el 1 sí tiene uno vigente ahora? no:
    # los dos últimos están vencido/revocado; el taller 2 nunca otorgó).
    assert api.get(
        "/api/v1/clientes", headers=_headers_soporte(datos, datos["taller2_id"])
    ).status_code == 403

    # Header que no es un entero.
    headers_mal = {**datos["headers"]["superadmin"], "X-Taller-Soporte": "abc"}
    assert api.get("/api/v1/clientes", headers=headers_mal).status_code == 403


def test_header_con_acceso_de_otro_taller_da_403(api, datos):
    # Acceso vigente para el taller 1; el header apunta al taller 2.
    _acceso_directo(1)
    r = api.get(
        "/api/v1/clientes", headers=_headers_soporte(datos, datos["taller2_id"])
    )
    assert r.status_code == 403


def test_gets_en_modo_soporte_quedan_auditados(api, datos):
    _acceso_directo(1)
    headers = _headers_soporte(datos, 1)

    api.get("/api/v1/clientes", headers=headers)
    api.get("/api/v1/ordenes", headers=headers)
    # Un GET normal del admin NO se audita.
    api.get("/api/v1/clientes", headers=datos["headers"]["admin1"])

    filas = _filas_auditoria(soporte=True, taller_id=1)
    rutas = sorted(f.ruta for f in filas)
    assert rutas == ["/api/v1/clientes", "/api/v1/ordenes"]
    for fila in filas:
        assert fila.metodo == "GET"
        assert fila.usuario_email == "super@x.com"

    # El 403 del modo soporte (sin acceso) no ensucia la auditoría de soporte.
    api.get("/api/v1/clientes", headers=_headers_soporte(datos, 2))
    assert len(_filas_auditoria(soporte=True)) == 2


def test_usuario_normal_que_manda_header_no_cambia_de_taller(api, datos):
    """El header se ignora para quien no es superadmin: ni taller nuevo ni
    enmascarado (documentado en app.core.dependencies._taller_soporte)."""
    _acceso_directo(datos["taller2_id"])
    headers = {**datos["headers"]["admin1"], "X-Taller-Soporte": "2"}

    r = api.get("/api/v1/clientes", headers=headers)
    assert r.status_code == 200
    # Sigue viendo SU taller (1) y sin enmascarar.
    assert [c["nombre"] for c in r.json()] == ["Ana"]
    assert r.json()[0]["dni"] == "30111222"


def test_filas_normales_de_auditoria_guardan_taller_id(api, datos):
    # POST del admin del taller 1.
    r = api.post(
        "/api/v1/clientes",
        headers=datos["headers"]["admin1"],
        json={"nombre": "Nuevo", "apellido": "Cliente", "dni": "40000001"},
    )
    assert r.status_code == 201
    fila = _filas_auditoria(ruta="/api/v1/clientes")[-1]
    assert fila.taller_id == 1
    assert fila.soporte is False

    # POST del superadmin en plataforma: taller_id NULL.
    r = api.post(
        "/api/v1/clientes",
        headers=datos["headers"]["superadmin"],
        json={"nombre": "Plataforma", "apellido": "Intento", "dni": "40000002"},
    )
    assert r.status_code == 403
    fila = _filas_auditoria(ruta="/api/v1/clientes")[-1]
    assert fila.taller_id is None
    assert fila.soporte is False


# --- Enmascarado (unitario) ----------------------------------------------------

def test_enmascarar_texto_formatos():
    assert _enmascarar_texto("30111222") == "****1222"
    assert _enmascarar_texto("1234") == "****"
    assert _enmascarar_texto("12345") == "****2345"
    assert _enmascarar_texto("") == "****"


def test_enmascarar_en_cualquier_nivel():
    documento = {
        "id": 1,
        "cliente": {
            "nombre": "Ana",
            "dni": "30111222",
            "contacto": {"email": "ana@x.com", "telefono": "1155550001"},
        },
        "items": [{"direccion": "Calle 1", "detalle": "ok"}],
        "cuit": "30-711122-3",
        "otra_cosa": {"EMAIL": "mayuscula@x.com"},
    }
    resultado = _enmascarar(documento)
    assert resultado["cliente"]["dni"] == "****1222"
    assert resultado["cliente"]["contacto"]["email"] == "****.com"
    assert resultado["cliente"]["contacto"]["telefono"] == "****0001"
    assert resultado["items"][0]["direccion"] == "****le 1"
    assert resultado["cuit"] == "****22-3"
    # case-insensitive en la clave.
    assert resultado["otra_cosa"]["EMAIL"] == "****.com"
    # Lo que no es campo sensible no se toca.
    assert resultado["cliente"]["nombre"] == "Ana"
    assert resultado["items"][0]["detalle"] == "ok"
    # El original no se muta.
    assert documento["cliente"]["dni"] == "30111222"
