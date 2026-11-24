import logging
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.v1.pagos import mercadopago
from app.core.config import get_settings
from app.core.mercadopago import VENTANA_FIRMA_SEG, firma_valida
from app.db.session import SIN_FILTRO_TALLER, fijar_taller
from app.models.auditoria import Auditoria
from app.models.orden import Orden
from app.models.pago import Pago
from app.models.taller import TALLER_PRINCIPAL_ID
from app.models.usuario import RolUsuario, Usuario, es_admin
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


def _pago_bloqueado(db: Session, pago_id: int, *, sin_filtro: bool = False) -> Pago | None:
    """Pago con lock de fila para actualizarlo (FOR UPDATE; se ignora en SQLite)."""
    stmt = select(Pago).where(Pago.id == pago_id).with_for_update()
    if sin_filtro:
        stmt = stmt.execution_options(**{SIN_FILTRO_TALLER: True})
    return db.scalar(stmt)


def _aplicar_estado(pago: Pago, estado: str, payment_id: str | None) -> None:
    # "aprobado" no vuelve atrás, salvo un reembolso; "reembolsado" es terminal
    # y solo tiene sentido sobre un pago que llegó a cobrarse. "duplicado"
    # también es terminal: el cobro existe en MP pero la orden ya estaba paga.
    if pago.estado in ("reembolsado", "duplicado"):
        return
    if pago.estado == "aprobado" and estado != "reembolsado":
        return
    if estado == "reembolsado" and pago.estado != "aprobado":
        return
    pago.estado = estado
    pago.payment_id = payment_id or pago.payment_id
    if estado == "aprobado":
        pago.fecha_pago = datetime.now(timezone.utc)


def marcar_aprobado(pago: Pago, payment_id: str | None = None) -> None:
    """Deja el pago aprobado y, con él, la orden pagada (`Orden.pagada`).

    Es el mismo camino para el pago online aprobado y para el registrado en el
    local: fija la fecha del pago, que es la que cuentan las métricas.
    """
    _aplicar_estado(pago, "aprobado", payment_id)


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
    # Cobro online solo en el taller principal: los demás talleres todavía no
    # tienen credenciales propias de Mercado Pago (docs/Plataforma.md, P3).
    if orden.taller_id != TALLER_PRINCIPAL_ID:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Este taller todavía no tiene cobro online",
        )
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


def _marcar_duplicado(db: Session, pago: Pago, orden: Orden, mp_id: str, origen: str) -> None:
    """El cobro online llegó aprobado pero la orden ya estaba paga (p. ej. el
    cliente pagó en el local): no se aprueba — queda 'duplicado' para que el
    taller devuelva la plata a mano, con una fila en su auditoría."""
    logger.error(
        "Pago %s de la orden %s: Mercado Pago aprobó el cobro %s pero la orden "
        "ya estaba paga; queda 'duplicado' para devolución manual",
        pago.id,
        orden.id,
        mp_id,
    )
    pago.estado = "duplicado"
    pago.payment_id = mp_id or pago.payment_id
    ruta = (
        "/api/v1/pagos/webhook"
        if origen == "webhook"
        else f"/api/v1/pagos/{pago.id}/confirmar"
    )
    db.add(
        Auditoria(
            taller_id=pago.taller_id,
            soporte=False,
            metodo="POST",
            ruta=ruta,
            entidad="pago",
            entidad_id=pago.id,
            estado_http=200,
            detalle=(
                f"Pago online {mp_id} aprobado en Mercado Pago pero la orden "
                f"{orden.codigo} ya estaba paga: marcado 'duplicado' para "
                "devolución manual"
            )[:500],
        )
    )


def _actualizar_desde_mp(
    db: Session, pago: Pago, info: dict, payment_id: str, *, origen: str
) -> None:
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
    mp_id = str(info.get("id") or payment_id)
    if estado == "aprobado" and pago.estado in ("pendiente", "rechazado"):
        # Lock de la orden: el chequeo de "ya está paga" queda serializado con
        # el pago local y con otros webhooks de la misma orden (en Postgres;
        # en SQLite el FOR UPDATE se ignora).
        orden = db.scalar(
            select(Orden).where(Orden.id == pago.orden_id).with_for_update()
        )
        if orden is not None and any(
            p.estado == "aprobado" for p in orden.pagos if p.id != pago.id
        ):
            _marcar_duplicado(db, pago, orden, mp_id, origen)
            return
    _aplicar_estado(pago, estado, mp_id)


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

    Sin MP_WEBHOOK_SECRET configurado no hay con qué verificar: en producción se
    rechaza; en desarrollo se avisa y se sigue. La comparación y la frescura
    del timestamp son las de app/core/mercadopago.py (compartidas con el webhook
    de suscripciones).
    """
    settings = get_settings()
    secret = settings.mp_webhook_secret
    if not secret:
        if settings.environment == "prod":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Firma de webhook inválida",
            )
        logger.warning(
            "Webhook de Mercado Pago recibido sin MP_WEBHOOK_SECRET: no se valida la firma"
        )
        return
    # En producción el ts tiene que ser reciente: una firma vieja no se puede
    # reenviar (el ts es parte del manifest firmado).
    ventana = VENTANA_FIRMA_SEG if settings.environment == "prod" else None
    if not firma_valida(
        secret, payment_id, x_signature, x_request_id, ventana_seg=ventana
    ):
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
    # El webhook no tiene usuario: el pago se busca en toda la plataforma y
    # después la sesión queda en el taller del pago antes de tocar nada.
    pago = (
        _pago_bloqueado(db, int(referencia), sin_filtro=True)
        if referencia.isdigit()
        else None
    )
    if pago is None:
        return
    fijar_taller(db, pago.taller_id)
    mp_id = str(info.get("id") or payment_id)
    if _payment_id_ajeno(db, pago, mp_id):
        logger.warning(
            "El pago de Mercado Pago %s ya está asignado a otro pago; se ignora",
            mp_id,
        )
        return
    _actualizar_desde_mp(db, pago, info, payment_id, origen="webhook")
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
            _actualizar_desde_mp(db, pago, info, payment_id, origen="confirmar")
            db.commit()
            db.refresh(pago)
    return PagoResponse.model_validate(pago)


def simular_pago(db: Session, usuario: Usuario, pago_id: int, estado: str) -> PagoResponse:
    # Herramienta de desarrollo: fuera de dev+debug "no existe" y nunca es para clientes.
    settings = get_settings()
    if not (settings.environment == "dev" and settings.debug):
        raise _no_encontrado("Recurso no encontrado")
    if not es_admin(usuario):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tenés permisos para esta acción",
        )
    pago = _pago_del_usuario(db, usuario, pago_id)
    _aplicar_estado(pago, estado, f"simulado-{pago.id}")
    db.commit()
    db.refresh(pago)
    return PagoResponse.model_validate(pago)
