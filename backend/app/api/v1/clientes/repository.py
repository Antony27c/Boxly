from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.cliente import Cliente
from app.models.orden import Orden
from app.models.turno import Turno
from app.models.vehiculo import Vehiculo


def get_by_id(db: Session, cliente_id: int) -> Cliente | None:
    return db.get(Cliente, cliente_id)


def get_by_dni(db: Session, dni: str) -> Cliente | None:
    stmt = select(Cliente).where(Cliente.dni == dni)
    return db.scalar(stmt)


def list_clientes(db: Session, *, q: str | None = None) -> list[Cliente]:
    stmt = select(Cliente).order_by(Cliente.apellido, Cliente.nombre)
    if q:
        patron = f"%{q.strip()}%"
        stmt = stmt.where(
            Cliente.nombre.ilike(patron)
            | Cliente.apellido.ilike(patron)
            | Cliente.dni.ilike(patron)
        )
    return list(db.scalars(stmt).all())


def create(db: Session, data: dict) -> Cliente:
    cliente = Cliente(**data)
    db.add(cliente)
    db.commit()
    db.refresh(cliente)
    return cliente


def update(db: Session, cliente: Cliente, data: dict) -> Cliente:
    for key, value in data.items():
        setattr(cliente, key, value)
    db.add(cliente)
    db.commit()
    db.refresh(cliente)
    return cliente


def contar_relacionados(db: Session, cliente_id: int) -> dict[str, int]:
    return {
        "vehiculos": db.scalar(
            select(func.count(Vehiculo.id)).where(Vehiculo.cliente_id == cliente_id)
        ),
        "ordenes": db.scalar(
            select(func.count(Orden.id)).where(Orden.cliente_id == cliente_id)
        ),
    }


def delete(db: Session, cliente: Cliente) -> None:
    # Los turnos del cliente se borran junto con él (agenda sin historia que
    # preservar); vehículos y órdenes se validan antes en el service.
    stmt = select(Turno.id).where(Turno.cliente_id == cliente.id)
    for turno_id in db.scalars(stmt).all():
        db.delete(db.get(Turno, turno_id))
    db.delete(cliente)
    db.commit()
