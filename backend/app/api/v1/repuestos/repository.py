from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.detalle_orden import DetalleOrden
from app.models.repuesto import Repuesto


def get_by_id(db: Session, repuesto_id: int) -> Repuesto | None:
    return db.get(Repuesto, repuesto_id)


def get_by_codigo(db: Session, codigo: str) -> Repuesto | None:
    return db.scalar(select(Repuesto).where(Repuesto.codigo == codigo))


def list_repuestos(db: Session, *, solo_activos: bool = False) -> list[Repuesto]:
    stmt = select(Repuesto).order_by(Repuesto.nombre)
    if solo_activos:
        stmt = stmt.where(Repuesto.activo.is_(True))
    return list(db.scalars(stmt).all())


def list_stock_bajo(db: Session) -> list[Repuesto]:
    stmt = (
        select(Repuesto)
        .where(Repuesto.activo.is_(True), Repuesto.stock <= Repuesto.stock_minimo)
        .order_by(Repuesto.stock, Repuesto.nombre)
    )
    return list(db.scalars(stmt).all())


def create(db: Session, data: dict) -> Repuesto:
    repuesto = Repuesto(**data)
    db.add(repuesto)
    db.commit()
    db.refresh(repuesto)
    return repuesto


def update(db: Session, repuesto: Repuesto, data: dict) -> Repuesto:
    for key, value in data.items():
        setattr(repuesto, key, value)
    db.add(repuesto)
    db.commit()
    db.refresh(repuesto)
    return repuesto


def tiene_detalles(db: Session, repuesto_id: int) -> bool:
    return (
        db.scalar(
            select(DetalleOrden.id).where(DetalleOrden.repuesto_id == repuesto_id).limit(1)
        )
        is not None
    )


def delete(db: Session, repuesto: Repuesto) -> None:
    db.delete(repuesto)
    db.commit()
