import hashlib
import hmac
import logging
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.v1.pagos import mercadopago
from app.core.config import get_settings
from app.models.orden import Orden
from app.models.pago import Pago
from app.models.usuario import RolUsuario, Usuario
from app.schemas.pago import PagoResponse, PreferenciaPagoResponse

logger = logging.getLogger(__name__)

PAGABLES = {"listo", "entregado"}
ESTADOS_MP = {
    "approved": "aprobado",
    "rejected": "rechazado",
    "cancelled": "rechazado",
    "refunded": "reembolsado",
    "charged_back": "reembolsado",
}
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


def _orden_bloqueada_del_usuario(db: Session, usuario: Usuario, orden_id: int) -> Orden:
    """Orden con lock de fila: serializa crear_pago concurrentes sobre la misma orden."""
    orden = db.scalar(select(Orden).where(Orden.id == orden_id).with_for_update())
    if orden is None or _es_ajena(usuario, orden):
        raise _no_encontrado("Orden no encontrada")
    return orden


def _pago_del_usuario(db: Session, usuario: Usuario, pago_id: int) -> Pago:
    pago = db.get(Pago, pago_id)
    if pago is None or _es_ajena(usuario, pago.orden):
        raise _no_encontrado("Pago no encontrado")
    return pago


def _pago_bloqueado(db: Session, pago_id: int) -> Pago | None:
    """Pago con lock de fila para actualizarlo (FOR UPDATE; se ignora en SQLite)."""
    return db.scalar(select(Pago).where(Pago.id == pago_id).with_for_update())


def _aplicar_estado(pago: Pago, estado: str, payment_id: str | None) -> None:
    # "aprobado" no vuelve atrás, salvo un reembolso; "reembolsado" es terminal
    # y solo tiene sentido sobre un pago que llegó a cobrarse.
    if pago.estado == "reembolsado":
        return
    if pago.estado == "aprobado" and estado != "reembolsado":
        return
    if estado == "reembolsado" and pago.estado != "aprobado":
        return
    pago.estado = estado
    pago.payment_id = payment_id or pago.payment_id
    if estado == "aprobado":
        pago.fecha_pago = datetime.now(timezone.utc)


def _pendiente_vigente(orden: Orden) -> Pago | None:
    """Pago pendiente reutilizable: sigue pendiente y el monto no cambió."""
    return next(
        (p for p in orden.pagos if p.estado == "pendiente" and p.monto == orden.costo_final),
        None,
    )


def _preferencia_vigente(token: str, pago: Pago) -> dict | None:
    """Preferencia MP ya creada para este pago, si se puede recuperar."""
    if not pago.preference_id:
        return None
    try:
        return mercadopago.obtener_preferencia(token, pago.preference_id)
    except mercadopago.MercadoPagoError:
        return None


def crear_pago(db: Session, usuario: Usuario, orden_id: int) -> PreferenciaPagoResponse:
    orden = _orden_bloqueada_del_usuario(db, usuario, orden_id)
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
    if not settings.mp_access_token and not (
        settings.environment == "dev" and settings.debug
    ):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Los pagos online no están configurados",
        )

    # Se reusa el pendiente vigente; los demás pendientes (monto viejo o
    # duplicados) quedan anulados para no acumular intents de pago.
    pago = _pendiente_vigente(orden)
    for viejo in orden.pagos:
        if viejo.estado == "pendiente" and viejo is not pago:
            viejo.estado = "rechazado"
    if pago is None:
        pago = Pago(orden_id=orden.id, monto=orden.costo_final, estado="pendiente")
        db.add(pago)
        try:
            db.flush()
        except IntegrityError:
            # Otro request ganó la carrera y ya dejó el pendiente: se reusa ese.
            db.rollback()
            orden = _orden_bloqueada_del_usuario(db, usuario, orden_id)
            pago = _pendiente_vigente(orden)
            if pago is None:
                raise

    destino = f"{settings.frontend_url.rstrip('/')}/portal/pago"
    back_urls = {clave: f"{destino}/{estado}?pago_id={pago.id}" for clave, estado in RETORNOS.items()}
    url_pago = back_urls["pending"]
    if settings.mp_access_token:
        notificacion = (
            f"{settings.backend_public_url.rstrip('/')}/api/v1/pagos/webhook"
            if settings.backend_public_url
            else None
        )
        preferencia = _preferencia_vigente(settings.mp_access_token, pago)
        if preferencia is None:
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
        url_pago = (
            preferencia.get("init_point")
            or preferencia.get("sandbox_init_point")
            or back_urls["pending"]
        )

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


def _consultar_mp(token: str, payment_id: str) -> dict:
    try:
        return mercadopago.obtener_pago(token, payment_id)
    except mercadopago.MercadoPagoError:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="No pudimos consultar el pago en Mercado Pago",
        ) from None


def _actualizar_desde_mp(pago: Pago, info: dict, payment_id: str) -> None:
    estado = ESTADOS_MP.get(info.get("status"), "pendiente")
    try:
        cobrado = Decimal(str(info.get("transaction_amount")))
    except InvalidOperation:
        cobrado = Decimal("0")
    costo_final = pago.orden.costo_final if pago.orden else None
    esperado = costo_final if costo_final is not None else pago.monto
    if estado == "aprobado" and cobrado != esperado:
        logger.warning(
            "Pago %s: Mercado Pago informa un cobro de %s pero el costo final "
            "de la orden es %s; se rechaza",
            pago.id,
            cobrado,
            esperado,
        )
        estado = "rechazado"
    _aplicar_estado(pago, estado, str(info.get("id") or payment_id))


def _payment_id_ajeno(db: Session, pago: Pago, mp_id: str) -> bool:
    """True si ese payment_id de MP ya quedó asignado a OTRO pago."""
    if not mp_id:
        return False
    return (
        db.scalar(select(Pago.id).where(Pago.payment_id == mp_id, Pago.id != pago.id))
        is not None
    )


def verificar_firma_webhook(
    payment_id: str | None, x_signature: str | None, x_request_id: str | None
) -> None:
    """Valida el header x-signature de Mercado Pago (HMAC-SHA256 del manifest).

    Sin MP_WEBHOOK_SECRET configurado no hay con qué verificar: se avisa y se sigue.
    """
    secret = get_settings().mp_webhook_secret
    if not secret:
        logger.warning(
            "Webhook de Mercado Pago recibido sin MP_WEBHOOK_SECRET: no se valida la firma"
        )
        return
    partes = {}
    for trozo in (x_signature or "").split(","):
        clave, sep, valor = trozo.partition("=")
        if sep:
            partes[clave.strip()] = valor.strip()
    ts, v1 = partes.get("ts"), partes.get("v1")
    if not ts or not v1 or not x_request_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Firma de webhook inválida"
        )
    manifest = f"id:{payment_id or ''};request-id:{x_request_id};ts:{ts};"
    esperado = hmac.new(
        secret.encode("utf-8"), manifest.encode("utf-8"), hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(esperado, v1):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Firma de webhook inválida"
        )


def procesar_notificacion(db: Session, tipo: str | None, payment_id: str | None) -> None:
    token = get_settings().mp_access_token
    if tipo != "payment" or not payment_id or not payment_id.isdigit() or not token:
        return
    try:
        info = mercadopago.obtener_pago(token, payment_id)
    except mercadopago.MercadoPagoError as exc:
        # El webhook responde 200 igual: si MP reintenta, lo hace por su cuenta.
        logger.warning("No se pudo consultar el pago %s en Mercado Pago: %s", payment_id, exc)
        return
    referencia = str(info.get("external_reference") or "")
    pago = _pago_bloqueado(db, int(referencia)) if referencia.isdigit() else None
    if pago is None:
        return
    mp_id = str(info.get("id") or payment_id)
    if _payment_id_ajeno(db, pago, mp_id):
        logger.warning(
            "El pago de Mercado Pago %s ya está asignado a otro pago; se ignora",
            mp_id,
        )
        return
    _actualizar_desde_mp(pago, info, payment_id)
    db.commit()


def confirmar_pago(db: Session, usuario: Usuario, pago_id: int, payment_id: str) -> PagoResponse:
    pago = _pago_bloqueado(db, pago_id)
    if pago is None or _es_ajena(usuario, pago.orden):
        raise _no_encontrado("Pago no encontrado")
    token = get_settings().mp_access_token
    if token and payment_id.isdigit() and pago.estado not in ("aprobado", "reembolsado"):
        info = _consultar_mp(token, payment_id)
        if str(info.get("external_reference") or "") != str(pago.id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El pago de Mercado Pago no corresponde a este pago",
            )
        mp_id = str(info.get("id") or payment_id)
        if _payment_id_ajeno(db, pago, mp_id):
            logger.warning(
                "El pago de Mercado Pago %s ya está asignado a otro pago; se ignora",
                mp_id,
            )
        else:
            _actualizar_desde_mp(pago, info, payment_id)
            db.commit()
            db.refresh(pago)
    return PagoResponse.model_validate(pago)


def simular_pago(db: Session, usuario: Usuario, pago_id: int, estado: str) -> PagoResponse:
    # Herramienta de desarrollo: fuera de dev+debug "no existe" y nunca es para clientes.
    settings = get_settings()
    if not (settings.environment == "dev" and settings.debug):
        raise _no_encontrado("Recurso no encontrado")
    if usuario.rol != RolUsuario.administrador:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tenés permisos para esta acción",
        )
    pago = _pago_del_usuario(db, usuario, pago_id)
    _aplicar_estado(pago, estado, f"simulado-{pago.id}")
    db.commit()
    db.refresh(pago)
    return PagoResponse.model_validate(pago)
