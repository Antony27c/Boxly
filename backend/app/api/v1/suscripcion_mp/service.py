"""Cobro automático de la suscripción de cada taller con Mercado Pago.

La cuenta que cobra es la DE BOXLY (BOXLY_MP_ACCESS_TOKEN), distinta de la que
usa cada taller para cobrar a sus clientes (app/api/v1/pagos). Contrato en
docs/Suscripciones.md, tarea S2.

Ojo con los modelos: PagoSuscripcion no es TallerMixin, así que el filtro
automático de taller NO lo alcanza: toda consulta filtra por taller_id a mano.
"""
import logging
import uuid
from decimal import Decimal, InvalidOperation

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.suscripcion import service as suscripcion
from app.api.v1.suscripcion_mp import cliente_mp
from app.core.config import get_settings
from app.core.mercadopago import ID_SEGURO, VENTANA_FIRMA_SEG, firma_valida
from app.db.session import SIN_FILTRO_TALLER, fijar_taller
from app.models.suscripcion import (
    EstadoPagoSuscripcion,
    MedioPagoSuscripcion,
    PagoSuscripcion,
    Plan,
)
from app.models.taller import Taller
from app.models.usuario import Usuario
from app.schemas.suscripcion import CobroAutomaticoResponse, SimularCobroResponse

logger = logging.getLogger(__name__)

DETALLE_SIN_TOKEN = "El cobro automático todavía no está configurado"
DETALLE_MP = "No pudimos comunicarnos con Mercado Pago"

# Topics de webhook de la cuenta de Boxly (docs de MP para preapproval).
_TIPOS_PREAPPROVAL = {"preapproval", "subscription_preapproval"}
_TIPOS_COBRO = {"authorized_payment", "subscription_authorized_payment"}


# Estado de Mercado Pago -> estado del pago de la suscripción. Lo que no está
# acá queda pendiente.
_ESTADOS_MP = {
    "approved": EstadoPagoSuscripcion.aprobado,
    "rejected": EstadoPagoSuscripcion.rechazado,
    "cancelled": EstadoPagoSuscripcion.rechazado,
}
# Estados que acepta el simulador (en inglés, como MP, o en castellano).
_ESTADOS_SIMULADOR = {
    "approved": EstadoPagoSuscripcion.aprobado,
    "rejected": EstadoPagoSuscripcion.rechazado,
    **{e.value: e for e in (EstadoPagoSuscripcion.aprobado, EstadoPagoSuscripcion.rechazado)},
}


def _taller_del_usuario(db: Session, usuario: Usuario) -> Taller:
    return suscripcion.taller_por_id(db, usuario.taller_id)


def _razon_cobro(plan: Plan, taller: Taller) -> str:
    """Texto que ve el taller en Mercado Pago."""
    return f"Boxly · plan {plan.nombre} · {taller.nombre}"


def _token_boxly() -> str:
    token = get_settings().boxly_mp_access_token
    if not token:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, DETALLE_SIN_TOKEN)
    return token


# --- Activar / cancelar (administrador del taller) ----------------------------


def activar_cobro(db: Session, usuario: Usuario) -> CobroAutomaticoResponse:
    """Crea la preapproval mensual del plan del taller y devuelve su init_point."""
    token = _token_boxly()
    settings = get_settings()
    taller = _taller_del_usuario(db, usuario)
    plan = suscripcion.plan_del_taller(db, taller)
    if taller.cobro_automatico:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "El taller ya tiene el cobro automático activo"
        )
    back_url = f"{settings.frontend_url.rstrip('/')}/suscripcion"
    # Pendiente conocido: si la respuesta de MP se pierde después de crear la
    # preapproval (timeout, corte de red), un reintento crea OTRA en MP y la
    # primera queda huérfana (existe en MP pero no en taller.mp_preapproval_id).
    # No se resuelve acá; ver docs/Despliegue.md, "Pendientes conocidos".
    try:
        preapproval = cliente_mp.crear_preapproval(
            token,
            reason=_razon_cobro(plan, taller),
            monto=plan.precio_mensual,
            back_url=back_url,
            external_reference=f"taller-{taller.id}",
            payer_email=usuario.email,
        )
    except cliente_mp.MercadoPagoError:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, DETALLE_MP) from None
    taller.mp_preapproval_id = str(preapproval.get("id") or "") or None
    # Solo queda activo cuando MP la autoriza (avisa por webhook).
    taller.cobro_automatico = preapproval.get("status") == "authorized"
    db.commit()
    return CobroAutomaticoResponse(
        init_point=preapproval.get("init_point") or preapproval.get("sandbox_init_point")
    )


def cancelar_cobro(db: Session, usuario: Usuario) -> None:
    """Cancela la preapproval en MP y desactiva el cobro automático local."""
    token = _token_boxly()
    taller = _taller_del_usuario(db, usuario)
    if not taller.mp_preapproval_id:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, "El taller no tiene cobro automático configurado"
        )
    try:
        cliente_mp.cancelar_preapproval(token, taller.mp_preapproval_id)
    except cliente_mp.MercadoPagoError:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, DETALLE_MP) from None
    taller.cobro_automatico = False
    taller.mp_preapproval_id = None
    db.commit()


# --- Webhook (sin usuario) ------------------------------------------------------


def verificar_firma_webhook(
    data_id: str | None, x_signature: str | None, x_request_id: str | None
) -> None:
    """Valida el header x-signature con el secreto de la cuenta de Boxly.

    Sin secreto configurado no hay con qué verificar: en producción se rechaza;
    en desarrollo se avisa y se sigue. La comparación y la frescura del
    timestamp son las de app/core/mercadopago.py (compartidas con el webhook de
    pagos de los talleres).
    """
    settings = get_settings()
    secret = settings.boxly_mp_webhook_secret
    if not secret:
        if settings.environment == "prod":
            raise HTTPException(
                status.HTTP_401_UNAUTHORIZED, "Firma de webhook inválida"
            )
        logger.warning(
            "Webhook de suscripción recibido sin BOXLY_MP_WEBHOOK_SECRET: "
            "no se valida la firma"
        )
        return
    # En producción el ts tiene que ser reciente: una firma vieja no se puede
    # reenviar (el ts es parte del manifest firmado).
    ventana = VENTANA_FIRMA_SEG if settings.environment == "prod" else None
    if not firma_valida(
        secret, data_id, x_signature, x_request_id, ventana_seg=ventana
    ):
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, "Firma de webhook inválida"
        )


def _taller_por_referencia(
    db: Session, preapproval_id: str | None, external_reference: str | None
) -> Taller | None:
    """Busca el taller dueño de la preapproval, en toda la plataforma.

    La sesión del webhook no tiene usuario ni taller: se busca sin filtro y
    después se fija el taller antes de escribir.
    """
    opciones = {SIN_FILTRO_TALLER: True}
    if preapproval_id:
        taller = db.scalar(
            select(Taller)
            .where(Taller.mp_preapproval_id == str(preapproval_id))
            .execution_options(**opciones)
        )
        if taller is not None:
            return taller
    external_reference = str(external_reference or "")
    if external_reference.startswith("taller-"):
        ref = external_reference.removeprefix("taller-")
        if ref.isdigit():
            return db.get(Taller, int(ref))
    return None


def _procesar_preapproval(db: Session, token: str, data_id: str) -> None:
    try:
        info = cliente_mp.obtener_preapproval(token, data_id)
    except cliente_mp.MercadoPagoError as exc:
        logger.warning("No se pudo consultar la preapproval %s: %s", data_id, exc)
        return
    nuevo_id = str(info.get("id") or data_id)
    taller = _taller_por_referencia(
        db, nuevo_id, info.get("external_reference")
    )
    if taller is None:
        logger.warning("Webhook de suscripción para preapproval desconocida %s", data_id)
        return
    # Si el taller ya tiene OTRA preapproval vigente, este aviso es de una vieja.
    if taller.mp_preapproval_id and taller.mp_preapproval_id != nuevo_id:
        return
    fijar_taller(db, taller.id)
    taller.mp_preapproval_id = nuevo_id
    taller.cobro_automatico = info.get("status") == "authorized"
    db.commit()


def _monto_cobro(info: dict, pago_mp: dict, plan: Plan) -> Decimal:
    for fuente in (pago_mp.get("transaction_amount"), info.get("transaction_amount")):
        try:
            monto = Decimal(str(fuente))
        except InvalidOperation:
            continue
        if monto > 0:
            return monto
    return plan.precio_mensual


def _registrar_cobro(
    db: Session,
    taller: Taller,
    *,
    monto: Decimal,
    estado: EstadoPagoSuscripcion,
    mp_payment_id: str,
    referencia: str,
) -> PagoSuscripcion | None:
    """Cobro de Mercado Pago: MP avisa el mismo cobro más de una vez (primero
    pendiente y después aprobado o rechazado). La idempotencia por
    ``mp_payment_id`` y la extensión del vencimiento son las de
    ``suscripcion.registrar_pago``. None cuando el cobro ya estaba en estado
    final o lo registró otro request. Un cobro de Mercado Pago (real o
    simulado) no lo registra una persona: registrado_por queda NULL."""
    return suscripcion.registrar_pago(
        db,
        taller,
        monto=monto,
        medio=MedioPagoSuscripcion.mercadopago,
        estado=estado,
        referencia=referencia,
        mp_payment_id=mp_payment_id,
    )


def _procesar_cobro(db: Session, token: str, data_id: str) -> None:
    try:
        info = cliente_mp.obtener_pago_autorizado(token, data_id)
    except cliente_mp.MercadoPagoError as exc:
        logger.warning("No se pudo consultar el cobro %s: %s", data_id, exc)
        return
    pago_mp = info.get("payment") if isinstance(info.get("payment"), dict) else {}
    preapproval_id = info.get("preapproval_id") or pago_mp.get("preapproval_id")
    taller = _taller_por_referencia(
        db,
        str(preapproval_id) if preapproval_id else None,
        info.get("external_reference"),
    )
    if taller is None:
        logger.warning("Webhook de suscripción para cobro desconocido %s", data_id)
        return
    fijar_taller(db, taller.id)
    mp_payment_id = str(
        pago_mp.get("id") or info.get("payment_id") or info.get("id") or data_id
    )
    estado_mp = str(pago_mp.get("status") or "").lower()
    if not estado_mp:
        # Sin pago anidado, el estado del authorized_payment manda:
        # "processed" = el cobro se procesó bien.
        estado_mp = str(info.get("status") or "").lower()
        if estado_mp == "processed":
            estado_mp = "approved"
    estado = _ESTADOS_MP.get(estado_mp, EstadoPagoSuscripcion.pendiente)
    plan = suscripcion.plan_del_taller(db, taller)
    monto = _monto_cobro(info, pago_mp, plan)
    pago = _registrar_cobro(
        db,
        taller,
        monto=monto,
        estado=estado,
        mp_payment_id=mp_payment_id,
        referencia=f"authorized_payment:{data_id}",
    )
    if pago is not None:
        db.commit()


def procesar_notificacion(db: Session, tipo: str | None, data_id: str | None) -> None:
    """Procesa un webhook de la cuenta de Boxly. Siempre responde 200: si MP
    reintenta, lo hace por su cuenta (mismo criterio que el webhook de pagos).
    """
    settings = get_settings()
    token = settings.boxly_mp_access_token
    if not token or not data_id or not ID_SEGURO.fullmatch(data_id):
        return
    if tipo in _TIPOS_PREAPPROVAL:
        _procesar_preapproval(db, token, data_id)
    elif tipo in _TIPOS_COBRO:
        _procesar_cobro(db, token, data_id)


# --- Simulador de desarrollo ----------------------------------------------------


def simular_cobro(db: Session, usuario: Usuario, estado: str | None) -> SimularCobroResponse:
    """Simula un cobro de suscripción aprobado o rechazado (solo dev + debug)."""
    settings = get_settings()
    if not (settings.environment == "dev" and settings.debug):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Recurso no encontrado")
    estado_pago = _ESTADOS_SIMULADOR.get((estado or "").strip().lower())
    if estado_pago is None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "Estado inválido: usá aprobado o rechazado"
        )
    taller = _taller_del_usuario(db, usuario)
    plan = suscripcion.plan_del_taller(db, taller)
    pago = _registrar_cobro(
        db,
        taller,
        monto=plan.precio_mensual,
        estado=estado_pago,
        mp_payment_id=f"simulado-{uuid.uuid4().hex[:20]}",
        referencia="simulador",
    )
    db.commit()
    return SimularCobroResponse(
        id=pago.id if pago else None,
        estado=estado_pago,
        duplicado=pago is None,
        monto=str(plan.precio_mensual),
        periodo_desde=pago.periodo_desde.isoformat() if pago else None,
        periodo_hasta=pago.periodo_hasta.isoformat() if pago else None,
    )


# --- Cambio de plan (lo llama S1) ------------------------------------------------


def actualizar_monto_preapproval(taller: Taller, plan: Plan) -> bool:
    """Actualiza el monto de la preapproval tras un cambio de plan.

    La llama el servicio de suscripción (S1) después de guardar el plan nuevo,
    solo si el taller tiene cobro automático. Sin token o sin preapproval no hay
    nada que hacer: devuelve False. Si Mercado Pago falla también devuelve
    False (el cambio de plan ya quedó guardado; el monto se corrige a mano en
    la cuenta de Boxly) y deja un warning en el log.
    """
    token = get_settings().boxly_mp_access_token
    if not token or not taller.mp_preapproval_id:
        return False
    try:
        cliente_mp.actualizar_preapproval(
            token,
            taller.mp_preapproval_id,
            monto=plan.precio_mensual,
            reason=_razon_cobro(plan, taller),
        )
    except cliente_mp.MercadoPagoError as exc:
        logger.warning(
            "No se pudo actualizar la preapproval %s del taller %s: %s",
            taller.mp_preapproval_id,
            taller.id,
            exc,
        )
        return False
    return True


@suscripcion.al_cambiar_plan
def _sincronizar_monto(taller: Taller, plan: Plan) -> None:
    """Con cobro automático, la preapproval cobra el precio del plan: tras un
    cambio de plan se actualiza el monto (docs/Suscripciones.md, S2)."""
    if taller.cobro_automatico:
        actualizar_monto_preapproval(taller, plan)
