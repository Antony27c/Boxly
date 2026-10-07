from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.api.v1.clientes import repository as clientes_repository
from app.api.v1.vehiculos import repository
from app.schemas.orden import OrdenResponse
from app.schemas.vehiculo import VehiculoCreate, VehiculoResponse, VehiculoUpdate


def _to_response(vehiculo) -> VehiculoResponse:
    return VehiculoResponse.model_validate(vehiculo)


def _get_or_404(db: Session, vehiculo_id: int):
    vehiculo = repository.get_by_id(db, vehiculo_id)
    if vehiculo is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vehículo no encontrado",
        )
    return vehiculo


def _validar_cliente(db: Session, cliente_id: int) -> None:
    if clientes_repository.get_by_id(db, cliente_id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No encontramos ese cliente.",
        )


def _validar_patente_unica(db: Session, patente: str, excluir_id: int | None) -> None:
    repetido = repository.get_by_patente(db, patente)
    if repetido and repetido.id != excluir_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya hay un vehículo cargado con esa patente.",
        )


def list_vehiculos(
    db: Session, *, cliente_id: int | None = None
) -> list[VehiculoResponse]:
    return [
        _to_response(v) for v in repository.list_vehiculos(db, cliente_id=cliente_id)
    ]


def get_vehiculo(db: Session, vehiculo_id: int) -> VehiculoResponse:
    return _to_response(_get_or_404(db, vehiculo_id))


def historial_ordenes(db: Session, vehiculo_id: int) -> list[OrdenResponse]:
    _get_or_404(db, vehiculo_id)
    ordenes = repository.list_ordenes(db, vehiculo_id)
    return [OrdenResponse.model_validate(o) for o in ordenes]


def create_vehiculo(db: Session, data: VehiculoCreate) -> VehiculoResponse:
    payload = data.model_dump()
    _validar_cliente(db, payload["cliente_id"])
    _validar_patente_unica(db, payload["patente"], excluir_id=None)
    return _to_response(repository.create(db, payload))


def update_vehiculo(
    db: Session, vehiculo_id: int, data: VehiculoUpdate
) -> VehiculoResponse:
    vehiculo = _get_or_404(db, vehiculo_id)

    payload = data.model_dump(exclude_unset=True)
    if "cliente_id" in payload:
        _validar_cliente(db, payload["cliente_id"])
    if "patente" in payload:
        _validar_patente_unica(db, payload["patente"], excluir_id=vehiculo.id)

    return _to_response(repository.update(db, vehiculo, payload))


def delete_vehiculo(db: Session, vehiculo_id: int) -> None:
    vehiculo = _get_or_404(db, vehiculo_id)

    if repository.contar_ordenes(db, vehiculo.id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se puede eliminar: el vehículo tiene órdenes asociadas.",
        )
    repository.delete(db, vehiculo)
