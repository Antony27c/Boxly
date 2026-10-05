from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.cliente import Cliente


def listar(db: Session) -> list[Cliente]:
    stmt = select(Cliente).order_by(Cliente.apellido, Cliente.nombre)
    return list(db.scalars(stmt).all())


def obtener(db: Session, cliente_id: int) -> Cliente | None:
    return db.get(Cliente, cliente_id)


def obtener_por_dni(db: Session, dni: str) -> Cliente | None:
    return db.scalar(select(Cliente).where(Cliente.dni == dni))


def crear(db: Session, datos: dict) -> Cliente:
    cliente = Cliente(**datos)
    db.add(cliente)
    db.commit()
    db.refresh(cliente)
    return cliente


def actualizar(db: Session, cliente: Cliente, datos: dict) -> Cliente:
    for campo, valor in datos.items():
        setattr(cliente, campo, valor)
    db.commit()
    db.refresh(cliente)
    return cliente


def eliminar(db: Session, cliente: Cliente) -> None:
    db.delete(cliente)
    db.commit()
