"""Cliente de la cuenta de Mercado Pago DE BOXLY (suscripciones).

Es una cuenta distinta de la que usan los talleres para cobrar sus órdenes
(app/api/v1/pagos/mercadopago.py): acá se crean las preapproval (suscripciones
recurrentes) que le cobran el plan mensual a cada taller. El HTTP, el error y
la validación de ids son los de app/core/mercadopago.py, compartidos.
"""
from decimal import Decimal

from app.core.mercadopago import API_URL, ID_SEGURO, MercadoPagoError, request

__all__ = ["API_URL", "MercadoPagoError"]


def _id_mp(valor: str, que: str) -> str:
    """Los ids de MP van dentro de la ruta de la API: solo caracteres seguros."""
    if not isinstance(valor, str) or not ID_SEGURO.fullmatch(valor):
        raise MercadoPagoError(f"{que} inválido")
    return valor


def _auto_recurrente(monto: Decimal) -> dict:
    return {
        "frequency": 1,
        "frequency_type": "months",
        "transaction_amount": float(monto),
        "currency_id": "ARS",
    }


def crear_preapproval(
    token: str,
    *,
    reason: str,
    monto: Decimal,
    back_url: str,
    external_reference: str,
    payer_email: str | None = None,
) -> dict:
    """Crea una suscripción mensual (preapproval) en la cuenta de Boxly."""
    body = {
        "reason": reason,
        "external_reference": external_reference,
        "auto_recurring": _auto_recurrente(monto),
        "back_url": back_url,
        "status": "pending",
    }
    if payer_email:
        body["payer_email"] = payer_email
    return request("POST", "/preapproval", token, body)


def obtener_preapproval(token: str, preapproval_id: str) -> dict:
    return request("GET", f"/preapproval/{_id_mp(preapproval_id, 'preapproval_id')}", token)


def actualizar_preapproval(
    token: str,
    preapproval_id: str,
    *,
    monto: Decimal | None = None,
    reason: str | None = None,
) -> dict:
    """Actualiza monto y/o motivo de una preapproval (cambio de plan)."""
    body: dict = {}
    if monto is not None:
        body["auto_recurring"] = _auto_recurrente(monto)
    if reason is not None:
        body["reason"] = reason
    return request(
        "PUT", f"/preapproval/{_id_mp(preapproval_id, 'preapproval_id')}", token, body
    )


def cancelar_preapproval(token: str, preapproval_id: str) -> dict:
    return request(
        "PUT",
        f"/preapproval/{_id_mp(preapproval_id, 'preapproval_id')}",
        token,
        {"status": "cancelled"},
    )


def obtener_pago_autorizado(token: str, authorized_payment_id: str) -> dict:
    """Trae un cobro de una preapproval (autorizado_pago) con su pago asociado."""
    return request(
        "GET",
        f"/authorized_payments/{_id_mp(authorized_payment_id, 'authorized_payment_id')}",
        token,
    )
