"""Concurrencia de crear_pago: índice único de pendiente por orden,
recuperación ante IntegrityError y la migración Alembic del índice."""
import os
import sqlite3
import subprocess
import sys
from decimal import Decimal
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.v1.pagos import service
from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models import Cliente, Orden, Pago, Usuario, Vehiculo
from app.models.usuario import RolUsuario
from app.main import app


@pytest.fixture
def datos():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        admin = Usuario(nombre="A", apellido="B", email="admin@x.com",
                        password_hash=hash_password("x"), rol=RolUsuario.administrador)
        cliente = Cliente(nombre="Juan", apellido="Perez", dni="12345678", email="juan@x.com")
        db.add_all([admin, cliente])
        db.flush()
        vehiculo = Vehiculo(cliente_id=cliente.id, patente="AB123CD",
                            marca="Ford", modelo="Focus")
        db.add(vehiculo)
        db.flush()
        cuenta = Usuario(nombre="Juan", apellido="Perez", email="cuenta@x.com",
                         password_hash=hash_password("x"), rol=RolUsuario.cliente,
                         cliente_id=cliente.id)
        orden = Orden(cliente_id=cliente.id, vehiculo_id=vehiculo.id,
                      creado_por_id=admin.id, codigo="ORD-CONC-1", estado="listo",
                      descripcion_ingreso="Cambio de frenos", costo_final=Decimal("1500.00"))
        db.add_all([cuenta, orden])
        db.flush()
        pago = Pago(orden_id=orden.id, monto=Decimal("1500.00"), estado="pendiente")
        db.add(pago)
        db.commit()
        return {
            "admin": {"Authorization": "Bearer " + create_access_token(admin.id)},
            "cliente": {"Authorization": "Bearer " + create_access_token(cuenta.id)},
            "orden": orden.id,
            "pago": pago.id,
        }


@pytest.fixture
def api():
    with TestClient(app) as cliente:
        yield cliente


def _settings(monkeypatch, **cambios):
    fake = SimpleNamespace(
        debug=True,
        environment="dev",
        mp_access_token=None,
        mp_webhook_secret=None,
        frontend_url="http://front.test",
        backend_public_url=None,
    )
    for clave, valor in cambios.items():
        setattr(fake, clave, valor)
    monkeypatch.setattr(service, "get_settings", lambda: fake)
    return fake


def test_el_indice_impide_un_segundo_pendiente_para_la_misma_orden(datos):
    """La base rechaza dos pagos 'pendiente' sobre la misma orden."""
    with SessionLocal() as db:
        db.add(Pago(orden_id=datos["orden"], monto=Decimal("10.00"), estado="pendiente"))
        with pytest.raises(IntegrityError):
            db.flush()
        db.rollback()


def test_los_estados_que_no_son_pendiente_si_pueden_repetirse(datos):
    """El índice es parcial: rechazados/aprobados conviven con el pendiente."""
    with SessionLocal() as db:
        db.add(Pago(orden_id=datos["orden"], monto=Decimal("10.00"), estado="rechazado"))
        db.add(Pago(orden_id=datos["orden"], monto=Decimal("10.00"), estado="aprobado"))
        db.commit()


def test_crear_pago_reusa_el_pendiente_tras_integrity_error(api, datos, monkeypatch):
    """Si el INSERT choca con el índice, se reusa el pendiente que quedó."""
    _settings(monkeypatch)

    # Simula la lectura vieja: la primera búsqueda no ve el pendiente vigente.
    real_vigente = service._pendiente_vigente
    llamadas = {"n": 0}

    def vigente_que_falla(orden):
        llamadas["n"] += 1
        return None if llamadas["n"] == 1 else real_vigente(orden)

    monkeypatch.setattr(service, "_pendiente_vigente", vigente_que_falla)

    # El INSERT del nuevo pendiente falla como si otro request hubiera ganado.
    real_flush = Session.flush
    fallo = {"disparado": False}

    def flush_que_falla(self, *args, **kwargs):
        if not fallo["disparado"] and any(isinstance(o, Pago) for o in self.new):
            fallo["disparado"] = True
            raise IntegrityError(
                "INSERT INTO pagos", {}, Exception("UNIQUE constraint failed")
            )
        return real_flush(self, *args, **kwargs)

    monkeypatch.setattr(Session, "flush", flush_que_falla)

    respuesta = api.post(
        f"/api/v1/pagos/ordenes/{datos['orden']}", headers=datos["cliente"]
    )
    assert respuesta.status_code == 201
    assert respuesta.json()["pago_id"] == datos["pago"]

    with SessionLocal() as db:
        total = db.scalar(
            select(func.count(Pago.id)).where(Pago.orden_id == datos["orden"])
        )
        assert total == 1


def _indice_presente(db_path: Path) -> bool:
    conexion = sqlite3.connect(db_path)
    try:
        return (
            conexion.execute(
                "SELECT 1 FROM sqlite_master WHERE type='index' "
                "AND name='uq_pagos_orden_pendiente'"
            ).fetchone()
            is not None
        )
    finally:
        conexion.close()


def test_la_migracion_crea_el_indice_y_lo_recrea(tmp_path):
    """alembic upgrade -> downgrade -> upgrade en SQLite deja el índice."""
    db_path = tmp_path / "alembic_test.db"
    entorno = {**os.environ, "DATABASE_URL": f"sqlite:///{db_path.as_posix()}"}
    backend = Path(__file__).resolve().parents[1]

    def _alembic(*args):
        return subprocess.run(
            [sys.executable, "-m", "alembic", *args],
            cwd=backend,
            env=entorno,
            capture_output=True,
            text=True,
        )

    r = _alembic("upgrade", "head")
    assert r.returncode == 0, r.stderr
    assert _indice_presente(db_path)

    r = _alembic("downgrade", "-1")
    assert r.returncode == 0, r.stderr
    assert not _indice_presente(db_path)

    r = _alembic("upgrade", "head")
    assert r.returncode == 0, r.stderr
    assert _indice_presente(db_path)
