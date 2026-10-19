from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.api.v1.repuestos import repository
from app.schemas.repuesto import RepuestoCreate, RepuestoResponse, RepuestoUpdate


def _to_response(repuesto) -> RepuestoResponse:
    respuesta = RepuestoResponse.model_validate(repuesto)
    respuesta.stock_bajo = repuesto.stock <= repuesto.stock_minimo
    return respuesta


def _get_or_404(db: Session, repuesto_id: int):
    repuesto = repository.get_by_id(db, repuesto_id)
    if repuesto is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Repuesto no encontrado",
        )
    return repuesto


def _validar_codigo_unico(db: Session, codigo: str, excluir_id: int | None) -> None:
    repetido = repository.get_by_codigo(db, codigo)
    if repetido and repetido.id != excluir_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya hay un repuesto cargado con ese código.",
        )


def list_repuestos(db: Session, *, solo_activos: bool = False) -> list[RepuestoResponse]:
    return [_to_response(r) for r in repository.list_repuestos(db, solo_activos=solo_activos)]


def list_stock_bajo(db: Session) -> list[RepuestoResponse]:
    return [_to_response(r) for r in repository.list_stock_bajo(db)]


def get_repuesto(db: Session, repuesto_id: int) -> RepuestoResponse:
    return _to_response(_get_or_404(db, repuesto_id))


def create_repuesto(db: Session, data: RepuestoCreate) -> RepuestoResponse:
    payload = data.model_dump()
    _validar_codigo_unico(db, payload["codigo"], excluir_id=None)
    return _to_response(repository.create(db, payload))


def update_repuesto(db: Session, repuesto_id: int, data: RepuestoUpdate) -> RepuestoResponse:
    repuesto = _get_or_404(db, repuesto_id)
    payload = data.model_dump(exclude_unset=True)
    for campo in ("codigo", "nombre", "stock", "stock_minimo", "precio", "activo"):
        if campo in payload and payload[campo] is None:
            payload.pop(campo)
    if "codigo" in payload:
        _validar_codigo_unico(db, payload["codigo"], excluir_id=repuesto.id)
    return _to_response(repository.update(db, repuesto, payload))


def delete_repuesto(db: Session, repuesto_id: int) -> None:
    repuesto = _get_or_404(db, repuesto_id)
    if repository.tiene_detalles(db, repuesto.id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se puede eliminar: el repuesto se usó en órdenes. Desactivalo.",
        )
    repository.delete(db, repuesto)
