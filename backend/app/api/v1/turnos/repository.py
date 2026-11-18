from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.turno import Turno


def get_by_id(db: Session, turno_id: int) -> Turno | None:
    return db.get(Turno, turno_id)


def list_turnos(
    db: Session,
    *,
    estado: str | None = None,
    cliente_id: int | None = None,
    mecanico_id: int | None = None,
    desde: datetime | None = None,
    hasta: datetime | None = None,
    limit: int | None = None,
    offset: int = 0,
) -> tuple[list[Turno], int]:
    """Devuelve (turnos de la página, total sin paginar)."""
    condiciones = []
    if estado is not None:
        condiciones.append(Turno.estado == estado)
    if cliente_id is not None:
        condiciones.append(Turno.cliente_id == cliente_id)
    if mecanico_id is not None:
        condiciones.append(Turno.mecanico_id == mecanico_id)
    if desde is not None:
        condiciones.append(Turno.fecha_hora >= desde)
    if hasta is not None:
        condiciones.append(Turno.fecha_hora <= hasta)
    total = db.scalar(
        select(func.count(Turno.id)).where(*condiciones)
    ) or 0
    stmt = (
        select(Turno)
        .where(*condiciones)
        .order_by(Turno.fecha_hora, Turno.id)
    )
    if limit is not None:
        stmt = stmt.limit(limit)
    if offset:
        stmt = stmt.offset(offset)
    return list(db.scalars(stmt).all()), total


def horario_ocupado(
    db: Session,
    fecha_hora: datetime,
    mecanico_id: int | None = None,
    excluir_id: int | None = None,
) -> bool:
    # Con mecánico asignado solo cuenta su agenda; sin mecánico, cualquier
    # turno no cancelado ocupa el horario del taller.
    stmt = select(Turno.id).where(
        Turno.fecha_hora == fecha_hora,
        Turno.estado != "cancelado",
    )
    if mecanico_id is not None:
        stmt = stmt.where(Turno.mecanico_id == mecanico_id)
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
