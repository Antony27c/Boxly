from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.orden import Orden


def list_ordenes(db: Session, cliente_id: int, *, vehiculo_id: int | None = None) -> list[Orden]:
    stmt = (
        select(Orden)
        .where(Orden.cliente_id == cliente_id)
        .order_by(Orden.fecha_ingreso.desc(), Orden.id.desc())
    )
    if vehiculo_id is not None:
        stmt = stmt.where(Orden.vehiculo_id == vehiculo_id)
    return list(db.scalars(stmt).all())


def get_orden(db: Session, cliente_id: int, orden_id: int) -> Orden | None:
    stmt = select(Orden).where(Orden.id == orden_id, Orden.cliente_id == cliente_id)
    return db.scalar(stmt)
