from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.turno import Turno


def get_by_id(db: Session, turno_id: int) -> Turno | None:
    return db.get(Turno, turno_id)


def list_turnos(
    db: Session,
    *,
    estado: str | None = None,
    cliente_id: int | None = None,
) -> list[Turno]:
    stmt = select(Turno).order_by(Turno.fecha_hora)
    if estado is not None:
        stmt = stmt.where(Turno.estado == estado)
    if cliente_id is not None:
        stmt = stmt.where(Turno.cliente_id == cliente_id)
    return list(db.scalars(stmt).all())


def horario_ocupado(
    db: Session, fecha_hora: datetime, excluir_id: int | None = None
) -> bool:
    stmt = select(Turno.id).where(
        Turno.fecha_hora == fecha_hora,
        Turno.estado != "cancelado",
    )
    if excluir_id is not None:
        stmt = stmt.where(Turno.id != excluir_id)
    return db.scalar(stmt) is not None


def create(db: Session, data: dict) -> Turno:
    turno = Turno(**data)
    db.add(turno)
    db.commit()
    db.refresh(turno)
    return turno


def update(db: Session, turno: Turno, data: dict) -> Turno:
    for key, value in data.items():
        setattr(turno, key, value)
    db.add(turno)
    db.commit()
    db.refresh(turno)
    return turno


def delete(db: Session, turno: Turno) -> None:
    db.delete(turno)
    db.commit()
