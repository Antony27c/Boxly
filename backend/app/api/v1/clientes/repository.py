from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.cliente import Cliente
from app.models.orden import Orden
from app.models.turno import Turno
from app.models.usuario import Usuario
from app.models.vehiculo import Vehiculo


def get_by_id(db: Session, cliente_id: int) -> Cliente | None:
    return db.get(Cliente, cliente_id)


def tiene_orden_del_mecanico(db: Session, cliente_id: int, mecanico_id: int) -> bool:
    stmt = (
        select(Orden.id)
        .where(Orden.cliente_id == cliente_id, Orden.mecanico_id == mecanico_id)
        .limit(1)
    )
    return db.scalar(stmt) is not None


def get_by_dni(db: Session, dni: str) -> Cliente | None:
    stmt = select(Cliente).where(Cliente.dni == dni)
    return db.scalar(stmt)


def _condiciones_filtro(q: str | None, mecanico_id: int | None) -> list:
    condiciones = []
    if mecanico_id is not None:
        condiciones.append(
            Cliente.id.in_(
                select(Orden.cliente_id).where(Orden.mecanico_id == mecanico_id)
            )
        )
    if q:
        patron = f"%{q.strip()}%"
        condiciones.append(
            Cliente.nombre.ilike(patron)
            | Cliente.apellido.ilike(patron)
            | Cliente.dni.ilike(patron)
        )
    return condiciones


def list_clientes(
    db: Session,
    *,
    q: str | None = None,
    mecanico_id: int | None = None,
    limit: int | None = None,
    offset: int = 0,
) -> tuple[list[Cliente], int]:
    """Devuelve (clientes de la página, total sin paginar)."""
    condiciones = _condiciones_filtro(q, mecanico_id)
    total = db.scalar(
        select(func.count(Cliente.id)).where(*condiciones)
    ) or 0
    stmt = (
        select(Cliente)
        .options(selectinload(Cliente.usuarios))
        .where(*condiciones)
        .order_by(Cliente.apellido, Cliente.nombre, Cliente.id)
    )
    if limit is not None:
        stmt = stmt.limit(limit)
    if offset:
        stmt = stmt.offset(offset)
    return list(db.scalars(stmt).all()), total


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
        "usuarios": db.scalar(
            select(func.count(Usuario.id)).where(Usuario.cliente_id == cliente_id)
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
