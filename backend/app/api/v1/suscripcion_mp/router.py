from typing import Annotated

from fastapi import APIRouter, Body, Depends, Header, Query, status

from app.api.v1.suscripcion_mp import service
from app.core.dependencies import DbSession, require_roles
from app.models.usuario import RolUsuario, Usuario
from app.schemas.usuario import MessageResponse

# Tarea S2 (contrato en docs/Suscripciones.md): cobro automático de la
# suscripción con la cuenta de Mercado Pago DE BOXLY (no la de los talleres).
router = APIRouter(prefix="/suscripcion", tags=["Suscripción: Mercado Pago"])

AdminUser = Annotated[Usuario, Depends(require_roles(RolUsuario.administrador))]


@router.post(
    "/cobro-automatico",
    status_code=status.HTTP_201_CREATED,
    summary="Activar el cobro automático de la suscripción",
)
def activar_cobro(db: DbSession, usuario: AdminUser) -> dict:
    return service.activar_cobro(db, usuario)


@router.delete(
    "/cobro-automatico",
    response_model=MessageResponse,
    summary="Cancelar el cobro automático de la suscripción",
)
def cancelar_cobro(db: DbSession, usuario: AdminUser) -> MessageResponse:
    service.cancelar_cobro(db, usuario)
    return MessageResponse(detail="Cobro automático cancelado")


@router.post(
    "/webhook",
    response_model=MessageResponse,
    summary="Notificaciones de Mercado Pago (cuenta de Boxly)",
)
def webhook(
    db: DbSession,
    datos: Annotated[dict | None, Body()] = None,
    tipo: str | None = Query(default=None, alias="type"),
    topic: str | None = Query(default=None),
    data_id: str | None = Query(default=None, alias="data.id"),
    id_ipn: str | None = Query(default=None, alias="id"),
    x_signature: Annotated[str | None, Header(alias="x-signature")] = None,
    x_request_id: Annotated[str | None, Header(alias="x-request-id")] = None,
) -> MessageResponse:
    datos = datos or {}
    data = datos.get("data") if isinstance(datos.get("data"), dict) else {}
    recurso_id = str(data.get("id") or data_id or id_ipn or "") or None
    service.verificar_firma_webhook(recurso_id, x_signature, x_request_id)
    service.procesar_notificacion(
        db,
        tipo=datos.get("type") or tipo or topic,
        data_id=recurso_id,
    )
    return MessageResponse(detail="ok")


@router.post(
    "/simular-cobro",
    summary="Simular un cobro de suscripción (solo dev + debug)",
)
def simular_cobro(
    db: DbSession,
    usuario: AdminUser,
    datos: Annotated[dict | None, Body()] = None,
) -> dict:
    estado = (datos or {}).get("estado")
    return service.simular_cobro(db, usuario, estado)
