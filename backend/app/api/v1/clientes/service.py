import anyio
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.api.v1.clientes import repository
from app.api.v1.users import repository as users_repository
from app.core.config import get_settings
from app.core.email import enviar_invitacion_portal
from app.core.security import create_invitation_token
from app.db.session import SessionLocal
from app.schemas.cliente import ClienteCreate, ClienteResponse, ClienteUpdate
from app.schemas.usuario import MessageResponse


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
    if relacionados["usuarios"]:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se puede eliminar: el cliente tiene un usuario de acceso.",
        )
    repository.delete(db, cliente)


def _enviar_invitacion(db: Session, cliente_id: int):
    """Valida y manda la invitación. Devuelve el resultado del envío."""
    cliente = _get_or_404(db, cliente_id)
    if not cliente.email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El cliente no tiene un correo cargado.",
        )
    if users_repository.get_by_cliente_id(db, cliente.id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El cliente ya activó su cuenta.",
        )
    if users_repository.get_by_email(db, cliente.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ese correo ya pertenece a otro usuario del sistema.",
        )
    enlace = (
        f"{get_settings().frontend_url.rstrip('/')}/activar"
        f"?token={create_invitation_token(cliente.id, cliente.email)}"
    )
    return anyio.from_thread.run(
        enviar_invitacion_portal, cliente.email, f"{cliente.nombre} {cliente.apellido}", enlace
    )


def invitar_al_portal(db: Session, cliente_id: int) -> MessageResponse:
    """Botón "Invitar al portal": el administrador ve enseguida si el correo salió."""
    envio = _enviar_invitacion(db, cliente_id)
    if envio.resultado != "enviado":
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"No se pudo enviar el correo: {envio.error}",
        )
    return MessageResponse(detail="Invitación enviada.")


def invitar_en_segundo_plano(cliente_id: int) -> None:
    """Al dar de alta un cliente con correo: invitación automática, sin frenar la respuesta."""
    with SessionLocal() as db:
        try:
            _enviar_invitacion(db, cliente_id)
        except HTTPException:
            return
