"""Cobro automático de la suscripción de cada taller con Mercado Pago.

La cuenta que cobra es la DE BOXLY (BOXLY_MP_ACCESS_TOKEN), distinta de la que
usa cada taller para cobrar a sus clientes (app/api/v1/pagos). Contrato en
docs/Suscripciones.md, tarea S2.

Ojo con los modelos: PagoSuscripcion no es TallerMixin, así que el filtro
automático de taller NO lo alcanza: toda consulta filtra por taller_id a mano.
"""
import hashlib
import hmac
import logging
import re
import time
import uuid
from calendar import monthrange
from datetime import date, timedelta
from decimal import Decimal, InvalidOperation

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.v1.suscripcion_mp import cliente_mp
from app.core.config import get_settings
from app.db.session import SIN_FILTRO_TALLER, fijar_taller
from app.models.suscripcion import PagoSuscripcion, Plan
from app.models.taller import Taller
from app.models.usuario import Usuario

logger = logging.getLogger(__name__)

DETALLE_SIN_TOKEN = "El cobro automático todavía no está configurado"
DETALLE_MP = "No pudimos comunicarnos con Mercado Pago"

# Topics de webhook de la cuenta de Boxly (docs de MP para preapproval).
_TIPOS_PREAPPROVAL = {"preapproval", "subscription_preapproval"}
_TIPOS_COBRO = {"authorized_payment", "subscription_authorized_payment"}


def _sumar_mes(fecha: date) -> date:
    """Un mes después de `fecha`; si el día no existe, va al último del mes."""
    mes = fecha.month + 1
    anio = fecha.year + (mes - 1) // 12
    mes = (mes - 1) % 12 + 1
    return date(anio, mes, min(fecha.day, monthrange(anio, mes)[1]))


def _periodo(vence_en: date | None, hoy: date | None = None) -> tuple[date, date]:
    """periodo_desde = max(vence_en + 1, hoy); periodo_hasta = +1 mes - 1 día."""
    hoy = hoy or date.today()
    desde = max(vence_en + timedelta(days=1), hoy) if vence_en else hoy
    return desde, _sumar_mes(desde) - timedelta(days=1)


def _taller_del_usuario(db: Session, usuario: Usuario) -> Taller:
    taller = db.get(Taller, usuario.taller_id)
    if taller is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Taller no encontrado")
    return taller


def _plan_del_taller(db: Session, taller: Taller) -> Plan:
    plan = db.get(Plan, taller.plan_codigo)
    if plan is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Plan no encontrado")
    return plan


def _token_boxly() -> str:
    token = get_settings().boxly_mp_access_token
    if not token:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, DETALLE_SIN_TOKEN)
    return token


# --- Activar / cancelar (administrador del taller) ----------------------------


def activar_cobro(db: Session, usuario: Usuario) -> dict:
    """Crea la preapproval mensual del plan del taller y devuelve su init_point."""
    token = _token_boxly()
    settings = get_settings()
    taller = _taller_del_usuario(db, usuario)
    plan = _plan_del_taller(db, taller)
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
            reason=f"Boxly · plan {plan.nombre} · {taller.nombre}",
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
    return {
        "init_point": preapproval.get("init_point")
        or preapproval.get("sandbox_init_point")
    }


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


# Ventana de validez del timestamp de x-signature (segundos Unix). Solo se exige
# en producción; en desarrollo se aceptan firmas de prueba con ts arbitrario.
VENTANA_FIRMA_WEBHOOK_SEG = 300

# El id de la notificación (preapproval o authorized_payment) va dentro de la
# ruta de la API de MP: solo caracteres seguros, con tope de largo.
_ID_NOTIFICACION = re.compile(r"[A-Za-z0-9_-]{1,64}")


def _ts_fresco(ts: str) -> bool:
    """El ts de x-signature de MP viene en segundos Unix (algunos avisos, en ms)."""
    try:
        valor = int(str(ts).strip())
    except (TypeError, ValueError):
        return False
    if valor > 10**12:
        valor //= 1000
    return abs(time.time() - valor) <= VENTANA_FIRMA_WEBHOOK_SEG


def verificar_firma_webhook(
    data_id: str | None, x_signature: str | None, x_request_id: str | None
) -> None:
    """Valida el header x-signature igual que el webhook de pagos, pero con el
    secreto de la cuenta de Boxly. Sin secreto configurado no hay con qué
    verificar: en producción se rechaza; en desarrollo se avisa y se sigue.
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
    partes = {}
    for trozo in (x_signature or "").split(","):
        clave, sep, valor = trozo.partition("=")
        if sep:
            partes[clave.strip()] = valor.strip()
    ts, v1 = partes.get("ts"), partes.get("v1")
    if not ts or not v1 or not x_request_id:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, "Firma de webhook inválida"
        )
    if settings.environment == "prod" and not _ts_fresco(ts):
        # Una firma válida pero vieja no se puede reenviar: el ts es parte del manifest.
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, "Firma de webhook inválida"
        )
    manifest = f"id:{data_id or ''};request-id:{x_request_id};ts:{ts};"
    esperado = hmac.new(
        secret.encode("utf-8"), manifest.encode("utf-8"), hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(esperado, v1):
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
    estado: str,
    mp_payment_id: str,
    referencia: str,
    registrado_por_id: int | None = None,
) -> PagoSuscripcion | None:
    """Crea la fila de pagos_suscripcion; None si ese cobro ya estaba (idempotente)."""
    ya_existe = db.scalar(
        select(PagoSuscripcion.id).where(PagoSuscripcion.mp_payment_id == mp_payment_id)
    )
    if ya_existe is not None:
        return None
    desde, hasta = _periodo(taller.suscripcion_vence_en)
    pago = PagoSuscripcion(
        taller_id=taller.id,
        monto=monto,
        periodo_desde=desde,
        periodo_hasta=hasta,
        medio="mercadopago",
        estado=estado,
        referencia=referencia,
        mp_payment_id=mp_payment_id,
        registrado_por_id=registrado_por_id,
    )
    db.add(pago)
    try:
        db.flush()
    except IntegrityError:
        # Otro request/webhook ganó la carrera con el mismo mp_payment_id.
        db.rollback()
        fijar_taller(db, taller.id)
        return None
    if estado == "aprobado":
        taller.suscripcion_vence_en = hasta
    return pago


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
    if estado_mp == "approved":
        estado = "aprobado"
    elif estado_mp in ("rejected", "cancelled"):
        estado = "rechazado"
    else:
        estado = "pendiente"
    plan = _plan_del_taller(db, taller)
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
    if not token or not data_id or not _ID_NOTIFICACION.fullmatch(data_id):
        return
    if tipo in _TIPOS_PREAPPROVAL:
        _procesar_preapproval(db, token, data_id)
    elif tipo in _TIPOS_COBRO:
        _procesar_cobro(db, token, data_id)


# --- Simulador de desarrollo ----------------------------------------------------


def simular_cobro(db: Session, usuario: Usuario, estado: str | None) -> dict:
    """Simula un cobro de suscripción aprobado o rechazado (solo dev + debug)."""
    settings = get_settings()
    if not (settings.environment == "dev" and settings.debug):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Recurso no encontrado")
    estado = (estado or "").strip().lower()
    if estado in ("approved", "aprobado"):
        estado = "aprobado"
    elif estado in ("rejected", "rechazado"):
        estado = "rechazado"
    else:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "Estado inválido: usá aprobado o rechazado"
        )
    taller = _taller_del_usuario(db, usuario)
    plan = _plan_del_taller(db, taller)
    pago = _registrar_cobro(
        db,
        taller,
        monto=plan.precio_mensual,
        estado=estado,
        mp_payment_id=f"simulado-{uuid.uuid4().hex[:20]}",
        referencia="simulador",
        registrado_por_id=usuario.id,
    )
    db.commit()
    return {
        "id": pago.id if pago else None,
        "estado": estado,
        "duplicado": pago is None,
        "monto": str(plan.precio_mensual),
        "periodo_desde": pago.periodo_desde.isoformat() if pago else None,
        "periodo_hasta": pago.periodo_hasta.isoformat() if pago else None,
    }


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
            reason=f"Boxly · plan {plan.nombre} · {taller.nombre}",
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
