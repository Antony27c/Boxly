from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.api.v1.pagos import mercadopago
from app.core.config import get_settings
from app.models.orden import Orden
from app.models.pago import Pago
from app.models.usuario import RolUsuario, Usuario
from app.schemas.pago import PagoResponse, PreferenciaPagoResponse

PAGABLES = {"listo", "entregado"}
ESTADOS_MP = {"approved": "aprobado", "rejected": "rechazado", "cancelled": "rechazado"}
RETORNOS = {"success": "aprobado", "failure": "rechazado", "pending": "pendiente"}


def puede_pagar(orden: Orden) -> bool:
    return (
        orden.estado in PAGABLES
        and orden.costo_final is not None
        and orden.costo_final > 0
        and not orden.pagada
    )


def _no_encontrado(detalle: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detalle)


def _es_ajena(usuario: Usuario, orden: Orden) -> bool:
    return usuario.rol == RolUsuario.cliente and orden.cliente_id != usuario.cliente_id


def _orden_del_usuario(db: Session, usuario: Usuario, orden_id: int) -> Orden:
    orden = db.get(Orden, orden_id)
    if orden is None or _es_ajena(usuario, orden):
        raise _no_encontrado("Orden no encontrada")
    return orden


def _pago_del_usuario(db: Session, usuario: Usuario, pago_id: int) -> Pago:
    pago = db.get(Pago, pago_id)
    if pago is None or _es_ajena(usuario, pago.orden):
        raise _no_encontrado("Pago no encontrado")
    return pago


def _aplicar_estado(pago: Pago, estado: str, payment_id: str | None) -> None:
    if pago.estado == "aprobado":
        return
    pago.estado = estado
    pago.payment_id = payment_id or pago.payment_id
    if estado == "aprobado":
        pago.fecha_pago = datetime.now(timezone.utc)


def crear_pago(db: Session, usuario: Usuario, orden_id: int) -> PreferenciaPagoResponse:
    orden = _orden_del_usuario(db, usuario, orden_id)
    if orden.pagada:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="La orden ya está pagada")
    if orden.estado not in PAGABLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La orden todavía no está lista para pagar",
        )
    if orden.costo_final is None or orden.costo_final <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La orden todavía no tiene un monto final",
        )
    settings = get_settings()
    if not settings.mp_access_token and not settings.debug:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Los pagos online no están configurados",
        )

    pago = Pago(orden_id=orden.id, monto=orden.costo_final, estado="pendiente")
    db.add(pago)
    db.flush()

    destino = f"{settings.frontend_url.rstrip('/')}/portal/pago"
    back_urls = {clave: f"{destino}/{estado}?pago_id={pago.id}" for clave, estado in RETORNOS.items()}
    url_pago = back_urls["pending"]
    if settings.mp_access_token:
        notificacion = (
            f"{settings.backend_public_url.rstrip('/')}/api/v1/pagos/webhook"
            if settings.backend_public_url
            else None
        )
        try:
            preferencia = mercadopago.crear_preferencia(
                settings.mp_access_token,
                titulo=f"Orden {orden.codigo} - Boxly",
                monto=pago.monto,
                referencia=str(pago.id),
                back_urls=back_urls,
                notification_url=notificacion,
            )
        except mercadopago.MercadoPagoError:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="No pudimos comunicarnos con Mercado Pago",
            ) from None
        pago.preference_id = preferencia.get("id")
        url_pago = preferencia.get("init_point") or preferencia.get("sandbox_init_point")

    db.commit()
    db.refresh(pago)
    return PreferenciaPagoResponse(
        pago_id=pago.id,
        orden_id=orden.id,
        monto=pago.monto,
        estado=pago.estado,
        preference_id=pago.preference_id,
        url_pago=url_pago,
    )


def get_pago(db: Session, usuario: Usuario, pago_id: int) -> PagoResponse:
    return PagoResponse.model_validate(_pago_del_usuario(db, usuario, pago_id))


def procesar_notificacion(db: Session, tipo: str | None, payment_id: str | None) -> None:
    token = get_settings().mp_access_token
    if tipo != "payment" or not payment_id or not token:
        return
    try:
        info = mercadopago.obtener_pago(token, payment_id)
    except mercadopago.MercadoPagoError:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="No pudimos consultar el pago en Mercado Pago",
        ) from None

    referencia = str(info.get("external_reference") or "")
    pago = db.get(Pago, int(referencia)) if referencia.isdigit() else None
    if pago is None:
        return
    estado = ESTADOS_MP.get(info.get("status"), "pendiente")
    try:
        cobrado = Decimal(str(info.get("transaction_amount")))
    except InvalidOperation:
        cobrado = Decimal("0")
    if estado == "aprobado" and cobrado < pago.monto:
        estado = "rechazado"
    _aplicar_estado(pago, estado, str(info.get("id") or payment_id))
    db.commit()


def simular_pago(db: Session, usuario: Usuario, pago_id: int, estado: str) -> PagoResponse:
    if not get_settings().debug:
        raise _no_encontrado("Recurso no encontrado")
    pago = _pago_del_usuario(db, usuario, pago_id)
    _aplicar_estado(pago, estado, f"simulado-{pago.id}")
    db.commit()
    db.refresh(pago)
    return PagoResponse.model_validate(pago)
