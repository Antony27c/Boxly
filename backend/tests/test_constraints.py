"""Constraints e índices de integridad a nivel base de datos."""
from datetime import datetime
from decimal import Decimal

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from app.core.security import hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models import Cliente, Orden, Pago, Repuesto, Turno, Usuario, Vehiculo
from app.models.usuario import RolUsuario


@pytest.fixture
def datos():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        admin = Usuario(
            nombre="Admin", apellido="Taller", email="admin@x.com",
            password_hash=hash_password("x"), rol=RolUsuario.administrador,
        )
        mecanico = Usuario(
            nombre="Mecanico", apellido="Uno", email="mec@x.com",
            password_hash=hash_password("x"), rol=RolUsuario.mecanico,
        )
        cliente = Cliente(nombre="Juan", apellido="Perez", dni="30111222")
        db.add_all([admin, mecanico, cliente])
        db.flush()
        vehiculo = Vehiculo(cliente_id=cliente.id, patente="ABC123", marca="VW", modelo="Gol")
        repuesto = Repuesto(codigo="ACEITE", nombre="Aceite 5W30", stock=5, precio=Decimal("100"))
        db.add_all([vehiculo, repuesto])
        db.flush()
        orden = Orden(
            cliente_id=cliente.id, vehiculo_id=vehiculo.id, creado_por_id=admin.id,
            mecanico_id=mecanico.id, codigo="OT-1", estado="pendiente",
            descripcion_ingreso="Cambio de aceite",
        )
        db.add(orden)
        db.flush()
        db.commit()
        return {
            "admin": admin.id, "mecanico": mecanico.id, "cliente": cliente.id,
            "vehiculo": vehiculo.id, "repuesto": repuesto.id, "orden": orden.id,
        }


def test_stock_negativo_por_sql_directo_falla(datos):
    with SessionLocal() as db:
        with pytest.raises(IntegrityError):
            db.execute(
                text("UPDATE repuestos SET stock = -1 WHERE id = :id"),
                {"id": datos["repuesto"]},
            )
        db.rollback()


def test_stock_cero_sigue_siendo_valido(datos):
    with SessionLocal() as db:
        db.execute(text("UPDATE repuestos SET stock = 0 WHERE id = :id"), {"id": datos["repuesto"]})
        db.commit()
        assert db.get(Repuesto, datos["repuesto"]).stock == 0


def test_estado_de_orden_invalido_falla(datos):
    with SessionLocal() as db:
        with pytest.raises(IntegrityError):
            db.execute(
                text("UPDATE ordenes SET estado = 'volando' WHERE id = :id"),
                {"id": datos["orden"]},
            )
        db.rollback()


def test_estado_de_turno_invalido_falla(datos):
    with SessionLocal() as db:
        turno = Turno(
            cliente_id=datos["cliente"], registrado_por_id=datos["admin"],
            fecha_hora=datetime(2030, 1, 7, 10, 0), estado="inventado",
        )
        db.add(turno)
        with pytest.raises(IntegrityError):
            db.commit()
        db.rollback()


def _turno(datos, estado="confirmado", mecanico=True, hora=datetime(2030, 1, 7, 10, 0)):
    return Turno(
        cliente_id=datos["cliente"], registrado_por_id=datos["admin"],
        mecanico_id=datos["mecanico"] if mecanico else None,
        fecha_hora=hora, estado=estado,
    )


def test_turno_duplicado_del_mismo_mecanico_falla(datos):
    with SessionLocal() as db:
        db.add(_turno(datos))
        db.commit()
    with SessionLocal() as db:
        db.add(_turno(datos))
        with pytest.raises(IntegrityError):
            db.commit()
        db.rollback()


def test_turno_cancelado_no_choca_con_el_indice(datos):
    with SessionLocal() as db:
        db.add(_turno(datos, estado="confirmado"))
        db.add(_turno(datos, estado="cancelado"))
        db.commit()


def test_turnos_sin_mecanico_pueden_repetir_horario(datos):
    with SessionLocal() as db:
        db.add(_turno(datos, mecanico=False))
        db.add(_turno(datos, mecanico=False))
        db.commit()


def test_estado_de_pago_invalido_falla(datos):
    with SessionLocal() as db:
        pago = Pago(orden_id=datos["orden"], monto=Decimal("100"), estado="pagado")
        db.add(pago)
        with pytest.raises(IntegrityError):
            db.commit()
        db.rollback()


def test_payment_id_duplicado_falla_y_nulos_repetidos_pasan(datos):
    # estado="rechazado" para no violar el índice de un solo pendiente por orden;
    # lo que se prueba acá es la unicidad de payment_id, no el estado.
    with SessionLocal() as db:
        db.add(Pago(orden_id=datos["orden"], monto=Decimal("100"), estado="rechazado", payment_id="MP-1"))
        db.add(Pago(orden_id=datos["orden"], monto=Decimal("100"), estado="rechazado"))
        db.add(Pago(orden_id=datos["orden"], monto=Decimal("100"), estado="rechazado"))
        db.commit()
    with SessionLocal() as db:
        db.add(Pago(orden_id=datos["orden"], monto=Decimal("100"), estado="rechazado", payment_id="MP-1"))
        with pytest.raises(IntegrityError):
            db.commit()
        db.rollback()
