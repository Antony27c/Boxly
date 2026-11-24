"""Tests de horarios de mecánico y catálogo: validaciones, permisos y N+1."""

from contextlib import contextmanager

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event

from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.main import app
from app.models import (
    Cliente,
    Marca,
    Modelo,
    Orden,
    Usuario,
    Vehiculo,
)
from app.models.usuario import RolUsuario


@contextmanager
def contar_queries():
    """Cuenta las queries SQL que se ejecutan en el engine durante el bloque."""
    n = [0]

    def _listener(*_args):
        n[0] += 1

    event.listen(engine, "before_cursor_execute", _listener)
    try:
        yield n
    finally:
        event.remove(engine, "before_cursor_execute", _listener)


def _usuario(db, nombre, email, rol):
    u = Usuario(
        nombre=nombre,
        apellido="Test",
        email=email,
        password_hash=hash_password("Clave1234"),
        rol=rol,
    )
    db.add(u)
    return u


@pytest.fixture
def datos():
    """Personal del taller y un cliente; las tablas se recrean por test."""
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        admin = _usuario(db, "Admin", "admin@x.com", RolUsuario.administrador)
        recepcion = _usuario(db, "Recep", "recep@x.com", RolUsuario.recepcion)
        mecanico = _usuario(db, "Mec", "mec@x.com", RolUsuario.mecanico)
        otro_mecanico = _usuario(db, "Mec2", "mec2@x.com", RolUsuario.mecanico)
        cliente = Cliente(
            nombre="Juan", apellido="Perez", dni="30111222", email="j@x.com"
        )
        db.add(cliente)
        db.commit()
        return {
            "admin": admin.id,
            "recepcion": recepcion.id,
            "mecanico": mecanico.id,
            "otro_mecanico": otro_mecanico.id,
            "cliente": cliente.id,
            "h": {
                rol: {
                    "Authorization": f"Bearer {create_access_token(u.id)}"
                }
                for rol, u in (
                    ("admin", admin),
                    ("recepcion", recepcion),
                    ("mecanico", mecanico),
                )
            },
        }


@pytest.fixture
def api():
    with TestClient(app) as client:
        yield client


def _crear_horario(api, headers, mecanico_id, dia=0, desde="08:00", hasta="12:00"):
    return api.post(
        f"/api/v1/mecanicos/{mecanico_id}/horarios",
        headers=headers,
        json={"dia_semana": dia, "hora_desde": desde, "hora_hasta": hasta},
    )


def _agregar_orden(db, cliente_id, creado_por_id, mecanico_id, n):
    """Orden abierta del mecánico con su propio vehículo (para medir N+1)."""
    v = Vehiculo(
        cliente_id=cliente_id,
        patente=f"ZZ{n:04d}",
        marca="Fiat",
        modelo="Cronos",
    )
    db.add(v)
    db.flush()
    db.add(
        Orden(
            cliente_id=cliente_id,
            vehiculo_id=v.id,
            creado_por_id=creado_por_id,
            mecanico_id=mecanico_id,
            codigo=f"OT-N{n}",
            estado="en_diagnostico",
            descripcion_ingreso="ruido",
        )
    )


# ---------- Horarios de mecánico ----------


def test_admin_crea_y_lista_horarios(api, datos):
    h = datos["h"]["admin"]
    mid = datos["mecanico"]
    r = _crear_horario(api, h, mid)
    assert r.status_code == 201
    listado = api.get(f"/api/v1/mecanicos/{mid}/horarios", headers=h)
    assert listado.status_code == 200
    assert [x["id"] for x in listado.json()] == [r.json()["id"]]


def test_hora_desde_mayor_que_hasta_da_400(api, datos):
    r = _crear_horario(
        api, datos["h"]["admin"], datos["mecanico"], desde="12:00", hasta="08:00"
    )
    assert r.status_code == 400


def test_superposicion_al_crear_da_409(api, datos):
    h = datos["h"]["admin"]
    mid = datos["mecanico"]
    assert _crear_horario(api, h, mid, desde="08:00", hasta="12:00").status_code == 201

    r = _crear_horario(api, h, mid, desde="10:00", hasta="14:00")
    assert r.status_code == 409
    assert "superpone" in r.json()["detail"]

    # Pegado al borde no es superposición; otro día tampoco.
    assert _crear_horario(api, h, mid, desde="12:00", hasta="14:00").status_code == 201
    assert (
        _crear_horario(api, h, mid, dia=1, desde="10:00", hasta="14:00").status_code
        == 201
    )


def test_superposicion_al_editar_da_409(api, datos):
    h = datos["h"]["admin"]
    mid = datos["mecanico"]
    _crear_horario(api, h, mid, desde="08:00", hasta="12:00")
    h2 = _crear_horario(api, h, mid, desde="14:00", hasta="18:00").json()

    # Reubicar h2 encima de la primera franja -> 409.
    r = api.put(
        f"/api/v1/mecanicos/{mid}/horarios/{h2['id']}",
        headers=h,
        json={"hora_desde": "10:00", "hora_hasta": "16:00"},
    )
    assert r.status_code == 409
    assert "superpone" in r.json()["detail"]

    # Rango invertido al editar -> 400.
    r = api.put(
        f"/api/v1/mecanicos/{mid}/horarios/{h2['id']}",
        headers=h,
        json={"hora_desde": "18:00", "hora_hasta": "08:00"},
    )
    assert r.status_code == 400

    # Pegado al borde (12:00-14:00) no superpone -> 200.
    r = api.put(
        f"/api/v1/mecanicos/{mid}/horarios/{h2['id']}",
        headers=h,
        json={"hora_desde": "12:00", "hora_hasta": "14:00"},
    )
    assert r.status_code == 200

    # Reenviar los mismos valores no choca con la propia franja -> 200.
    h1 = api.get(f"/api/v1/mecanicos/{mid}/horarios", headers=h).json()[0]
    r = api.put(
        f"/api/v1/mecanicos/{mid}/horarios/{h1['id']}",
        headers=h,
        json={"hora_desde": h1["hora_desde"], "hora_hasta": h1["hora_hasta"]},
    )
    assert r.status_code == 200


def test_solo_el_admin_modifica_horarios(api, datos):
    """Ni el mecánico (propio u ajeno) ni recepción pueden tocar horarios."""
    mid = datos["mecanico"]
    h_admin = datos["h"]["admin"]
    horario = _crear_horario(api, h_admin, mid).json()

    for rol in ("mecanico", "recepcion"):
        hh = datos["h"][rol]
        assert (
            api.post(
                f"/api/v1/mecanicos/{mid}/horarios",
                headers=hh,
                json={"dia_semana": 2, "hora_desde": "08:00", "hora_hasta": "12:00"},
            ).status_code
            == 403
        )
        assert (
            api.put(
                f"/api/v1/mecanicos/{mid}/horarios/{horario['id']}",
                headers=hh,
                json={"hora_desde": "09:00"},
            ).status_code
            == 403
        )
        assert (
            api.delete(
                f"/api/v1/mecanicos/{mid}/horarios/{horario['id']}", headers=hh
            ).status_code
            == 403
        )


def test_mecanico_solo_lee_sus_horarios(api, datos):
    mid = datos["mecanico"]
    otro = datos["otro_mecanico"]
    _crear_horario(api, datos["h"]["admin"], mid)
    _crear_horario(api, datos["h"]["admin"], otro, dia=3)

    r = api.get(f"/api/v1/mecanicos/{mid}/horarios", headers=datos["h"]["mecanico"])
    assert r.status_code == 200 and len(r.json()) == 1

    r = api.get(f"/api/v1/mecanicos/{otro}/horarios", headers=datos["h"]["mecanico"])
    assert r.status_code == 403

    r = api.get(
        f"/api/v1/mecanicos/{otro}/horarios", headers=datos["h"]["recepcion"]
    )
    assert r.status_code == 200 and len(r.json()) == 1


# ---------- N+1 ----------


def test_calendario_no_hace_n_queries_por_orden(api, datos):
    """El calendario no debe consultar el vehículo una vez por orden."""
    mid = datos["mecanico"]
    url = f"/api/v1/mecanicos/{mid}/calendario"

    with SessionLocal() as db:
        for i in range(2):
            _agregar_orden(db, datos["cliente"], datos["admin"], mid, i)
        db.commit()

    with contar_queries() as q:
        r1 = api.get(url, headers=datos["h"]["admin"])
    assert r1.status_code == 200
    assert len(r1.json()["ordenes"]) == 2
    queries_con_2 = q[0]

    with SessionLocal() as db:
        for i in range(2, 6):
            _agregar_orden(db, datos["cliente"], datos["admin"], mid, i)
        db.commit()

    with contar_queries() as q:
        r2 = api.get(url, headers=datos["h"]["admin"])
    assert r2.status_code == 200
    body = r2.json()
    assert len(body["ordenes"]) == 6
    # Los datos del vehículo llegan completos (joinedload).
    assert all(o["vehiculo_patente"] for o in body["ordenes"])

    assert q[0] == queries_con_2


def test_catalogo_no_hace_n_queries(api, datos):
    """Marcas y modelos son listados planos: las queries no crecen con filas."""

    def _sembrar(desde, hasta):
        with SessionLocal() as db:
            for m in range(desde, hasta):
                marca = Marca(nombre=f"CatMarca{m}")
                db.add(marca)
                db.flush()
                for n in range(2):
                    db.add(Modelo(marca_id=marca.id, nombre=f"CatMod{n}"))
            db.commit()

    def _contar():
        with contar_queries() as q:
            r_marcas = api.get(
                "/api/v1/catalogo/marcas", headers=datos["h"]["admin"]
            )
            n_marcas = q[0]
        with contar_queries() as q:
            r_modelos = api.get(
                "/api/v1/catalogo/modelos", headers=datos["h"]["admin"]
            )
            n_modelos = q[0]
        assert r_marcas.status_code == 200 and r_modelos.status_code == 200
        return n_marcas, n_modelos

    _sembrar(0, 3)
    antes = _contar()
    _sembrar(3, 6)
    despues = _contar()
    assert antes == despues


# ---------- Orden del catálogo ----------


def test_modelos_se_ordena_por_nombre_con_desempate(api, datos):
    with SessionLocal() as db:
        marca_a = Marca(nombre="Fiat")
        marca_b = Marca(nombre="Ford")
        db.add_all([marca_a, marca_b])
        db.flush()
        # Insertados desordenados y con "Alpha" repetido entre marcas.
        db.add(Modelo(marca_id=marca_b.id, nombre="Beta"))
        db.add(Modelo(marca_id=marca_a.id, nombre="Zeta"))
        db.add(Modelo(marca_id=marca_a.id, nombre="Alpha"))
        db.add(Modelo(marca_id=marca_b.id, nombre="Alpha"))
        db.commit()
        id_marca_a = marca_a.id

    r = api.get("/api/v1/catalogo/modelos", headers=datos["h"]["admin"])
    assert r.status_code == 200
    items = r.json()
    nombres = [m["nombre"] for m in items]
    assert nombres == sorted(nombres)
    # Con nombre repetido el orden es estable (desempata por id).
    alphas = [m for m in items if m["nombre"] == "Alpha"]
    assert [m["id"] for m in alphas] == sorted(m["id"] for m in alphas)

    r = api.get(
        f"/api/v1/catalogo/modelos?marca_id={id_marca_a}",
        headers=datos["h"]["admin"],
    )
    assert [m["nombre"] for m in r.json()] == ["Alpha", "Zeta"]
