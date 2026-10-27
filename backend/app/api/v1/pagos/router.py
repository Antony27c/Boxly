from typing import Annotated

from fastapi import APIRouter, Body, Depends, Query, status

from app.api.v1.pagos import service
from app.core.dependencies import DbSession, require_roles
from app.models.usuario import RolUsuario, Usuario
from app.schemas.pago import (
    ConfirmarPagoRequest,
    PagoResponse,
    PreferenciaPagoResponse,
    SimularPagoRequest,
)
from app.schemas.usuario import MessageResponse

router = APIRouter(prefix="/pagos", tags=["Pagos"])

PagadorUser = Annotated[
    Usuario,
    Depends(require_roles(RolUsuario.administrador, RolUsuario.cliente)),
]


@router.post(
    "/webhook",
    response_model=MessageResponse,
    summary="Notificaciones de Mercado Pago",
)
def webhook(
    db: DbSession,
    datos: dict | None = Body(default=None),
    tipo: str | None = Query(default=None, alias="type"),
    topic: str | None = Query(default=None),
    data_id: str | None = Query(default=None, alias="data.id"),
    id_ipn: str | None = Query(default=None, alias="id"),
) -> MessageResponse:
    datos = datos or {}
    service.procesar_notificacion(
        db,
        tipo=datos.get("type") or tipo or topic,
        payment_id=str((datos.get("data") or {}).get("id") or data_id or id_ipn or "") or None,
    )
    return MessageResponse(detail="ok")


@router.post(
    "/ordenes/{orden_id}",
    response_model=PreferenciaPagoResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Crear el pago online de una orden",
)
def crear_pago(orden_id: int, db: DbSession, usuario: PagadorUser) -> PreferenciaPagoResponse:
    return service.crear_pago(db, usuario, orden_id)


@router.get(
    "/{pago_id}",
    response_model=PagoResponse,
    summary="Estado de un pago",
)
def obtener_pago(pago_id: int, db: DbSession, usuario: PagadorUser) -> PagoResponse:
    return service.get_pago(db, usuario, pago_id)


@router.post(
    "/{pago_id}/confirmar",
    response_model=PagoResponse,
    summary="Confirmar un pago al volver de Mercado Pago",
)
def confirmar_pago(
    pago_id: int,
    datos: ConfirmarPagoRequest,
    db: DbSession,
    usuario: PagadorUser,
) -> PagoResponse:
    return service.confirmar_pago(db, usuario, pago_id, datos.payment_id)


@router.post(
    "/{pago_id}/simular",
    response_model=PagoResponse,
    summary="Simular el resultado de un pago (solo DEBUG)",
)
def simular_pago(
    pago_id: int,
    datos: SimularPagoRequest,
    db: DbSession,
    usuario: PagadorUser,
) -> PagoResponse:
    return service.simular_pago(db, usuario, pago_id, datos.estado)
