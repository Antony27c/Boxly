from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.orden import Orden


def _stmt_ordenes(cliente_id: int, vehiculo_id: int | None = None):
    stmt = (
        select(Orden)
        .where(Orden.cliente_id == cliente_id)
        .order_by(Orden.fecha_ingreso.desc(), Orden.id.desc())
    )
    if vehiculo_id is not None:
        stmt = stmt.where(Orden.vehiculo_id == vehiculo_id)
    return stmt


def list_ordenes(db: Session, cliente_id: int, *, vehiculo_id: int | None = None) -> list[Orden]:
    return list(db.scalars(_stmt_ordenes(cliente_id, vehiculo_id)).all())


def list_ordenes_resumen(
    db: Session, cliente_id: int, *, vehiculo_id: int | None = None
) -> list[Orden]:
    # El resumen del portal serializa vehiculo y pagada (pagos): se cargan
    # juntos para no hacer una query por orden.
    stmt = _stmt_ordenes(cliente_id, vehiculo_id).options(
        selectinload(Orden.vehiculo),
        selectinload(Orden.pagos),
    )
    return list(db.scalars(stmt).all())


def get_orden(db: Session, cliente_id: int, orden_id: int) -> Orden | None:
    stmt = select(Orden).where(Orden.id == orden_id, Orden.cliente_id == cliente_id)
    return db.scalar(stmt)
