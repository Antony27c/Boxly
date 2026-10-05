from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.api.v1.clientes import repository
from app.models.cliente import Cliente
from app.schemas.cliente import ClienteCreate, ClienteUpdate


def _buscar(db: Session, cliente_id: int) -> Cliente:
    cliente = repository.obtener(db, cliente_id)
    if cliente is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No encontramos ese cliente",
        )
    return cliente


def _validar_dni_unico(db: Session, dni: str, id_actual: int | None = None) -> None:
    existente = repository.obtener_por_dni(db, dni)
    if existente and existente.id != id_actual:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un cliente con ese DNI/CUIT",
        )


def listar(db: Session) -> list[Cliente]:
    return repository.listar(db)


def obtener(db: Session, cliente_id: int) -> Cliente:
    return _buscar(db, cliente_id)


def crear(db: Session, data: ClienteCreate) -> Cliente:
    _validar_dni_unico(db, data.dni)
    return repository.crear(db, data.model_dump())


def actualizar(db: Session, cliente_id: int, data: ClienteUpdate) -> Cliente:
    cliente = _buscar(db, cliente_id)
    _validar_dni_unico(db, data.dni, cliente.id)
    return repository.actualizar(db, cliente, data.model_dump())


def eliminar(db: Session, cliente_id: int) -> None:
    cliente = _buscar(db, cliente_id)
    if cliente.vehiculos or cliente.ordenes or cliente.turnos:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se puede eliminar: el cliente tiene vehículos, órdenes o turnos asociados",
        )
    repository.eliminar(db, cliente)
