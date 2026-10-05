from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.api.v1.clientes import repository
from app.schemas.cliente import ClienteCreate, ClienteResponse, ClienteUpdate


def _to_response(cliente) -> ClienteResponse:
    return ClienteResponse.model_validate(cliente)


def _get_or_404(db: Session, cliente_id: int):
    cliente = repository.get_by_id(db, cliente_id)
    if cliente is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cliente no encontrado",
        )
    return cliente


def list_clientes(db: Session, *, q: str | None = None) -> list[ClienteResponse]:
    return [_to_response(c) for c in repository.list_clientes(db, q=q)]


def get_cliente(db: Session, cliente_id: int) -> ClienteResponse:
    return _to_response(_get_or_404(db, cliente_id))


def create_cliente(db: Session, data: ClienteCreate) -> ClienteResponse:
    payload = data.model_dump()
    payload["dni"] = payload["dni"].strip()
    if repository.get_by_dni(db, payload["dni"]):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un cliente con ese DNI/CUIT.",
        )
    return _to_response(repository.create(db, payload))


def update_cliente(db: Session, cliente_id: int, data: ClienteUpdate) -> ClienteResponse:
    cliente = _get_or_404(db, cliente_id)

    payload = data.model_dump(exclude_unset=True)
    if "dni" in payload:
        dni = payload["dni"].strip()
        repetido = repository.get_by_dni(db, dni)
        if repetido and repetido.id != cliente.id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ya existe un cliente con ese DNI/CUIT.",
            )
        payload["dni"] = dni

    return _to_response(repository.update(db, cliente, payload))


def delete_cliente(db: Session, cliente_id: int) -> None:
    cliente = _get_or_404(db, cliente_id)

    relacionados = repository.contar_relacionados(db, cliente.id)
    if relacionados["vehiculos"]:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se puede eliminar: el cliente tiene vehículos asociados.",
        )
    if relacionados["ordenes"]:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se puede eliminar: el cliente tiene órdenes asociadas.",
        )
    repository.delete(db, cliente)
