from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.orden import Orden
from app.models.turno import Turno
from app.models.vehiculo import Vehiculo


def get_by_id(db: Session, vehiculo_id: int) -> Vehiculo | None:
    return db.get(Vehiculo, vehiculo_id)


def get_by_patente(db: Session, patente: str) -> Vehiculo | None:
    stmt = select(Vehiculo).where(Vehiculo.patente == patente)
    return db.scalar(stmt)


def list_vehiculos(db: Session, *, cliente_id: int | None = None) -> list[Vehiculo]:
    stmt = select(Vehiculo).order_by(Vehiculo.patente)
    if cliente_id is not None:
        stmt = stmt.where(Vehiculo.cliente_id == cliente_id)
    return list(db.scalars(stmt).all())


def list_ordenes(db: Session, vehiculo_id: int) -> list[Orden]:
    stmt = (
        select(Orden)
        .where(Orden.vehiculo_id == vehiculo_id)
        .order_by(Orden.fecha_ingreso.desc())
    )
    return list(db.scalars(stmt).all())


def create(db: Session, data: dict) -> Vehiculo:
    vehiculo = Vehiculo(**data)
    db.add(vehiculo)
    db.commit()
    db.refresh(vehiculo)
    return vehiculo


def update(db: Session, vehiculo: Vehiculo, data: dict) -> Vehiculo:
    for key, value in data.items():
        setattr(vehiculo, key, value)
    db.add(vehiculo)
    db.commit()
    db.refresh(vehiculo)
    return vehiculo


def contar_ordenes(db: Session, vehiculo_id: int) -> int:
    return db.scalar(
        select(func.count(Orden.id)).where(Orden.vehiculo_id == vehiculo_id)
    )


def delete(db: Session, vehiculo: Vehiculo) -> None:
    stmt = select(Turno.id).where(Turno.vehiculo_id == vehiculo.id)
    for turno_id in db.scalars(stmt).all():
        db.delete(db.get(Turno, turno_id))
    db.delete(vehiculo)
    db.commit()
