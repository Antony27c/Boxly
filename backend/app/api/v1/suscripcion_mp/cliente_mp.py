"""Cliente HTTP de la cuenta de Mercado Pago DE BOXLY (suscripciones).

Es una cuenta distinta de la que usan los talleres para cobrar sus órdenes
(app/api/v1/pagos/mercadopago.py): acá se crean las preapproval (suscripciones
recurrentes) que le cobran el plan mensual a cada taller. Mismo estilo de
cliente que el de pagos: urllib, timeout corto y MercadoPagoError propio.
"""
import json
import re
import urllib.error
import urllib.request
from decimal import Decimal

API_URL = "https://api.mercadopago.com"


class MercadoPagoError(Exception):
    pass


def _id_mp(valor: str, que: str) -> str:
    """Los ids de MP van dentro de la ruta de la API: solo caracteres seguros."""
    if not isinstance(valor, str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,64}", valor):
        raise MercadoPagoError(f"{que} inválido")
    return valor


def _request(method: str, path: str, token: str, body: dict | None = None) -> dict:
    request = urllib.request.Request(
        f"{API_URL}{path}",
        data=json.dumps(body).encode() if body is not None else None,
        method=method,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            return json.loads(response.read())
    except (urllib.error.URLError, TimeoutError, ValueError) as exc:
        raise MercadoPagoError(str(exc)) from exc


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
        "auto_recurring": {
            "frequency": 1,
            "frequency_type": "months",
            "transaction_amount": float(monto),
            "currency_id": "ARS",
        },
        "back_url": back_url,
        "status": "pending",
    }
    if payer_email:
        body["payer_email"] = payer_email
    return _request("POST", "/preapproval", token, body)


def obtener_preapproval(token: str, preapproval_id: str) -> dict:
    return _request("GET", f"/preapproval/{_id_mp(preapproval_id, 'preapproval_id')}", token)


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
        body["auto_recurring"] = {
            "frequency": 1,
            "frequency_type": "months",
            "transaction_amount": float(monto),
            "currency_id": "ARS",
        }
    if reason is not None:
        body["reason"] = reason
    return _request(
        "PUT", f"/preapproval/{_id_mp(preapproval_id, 'preapproval_id')}", token, body
    )


def cancelar_preapproval(token: str, preapproval_id: str) -> dict:
    return _request(
        "PUT",
        f"/preapproval/{_id_mp(preapproval_id, 'preapproval_id')}",
        token,
        {"status": "cancelled"},
    )


def obtener_pago_autorizado(token: str, authorized_payment_id: str) -> dict:
    """Trae un cobro de una preapproval (autorizado_pago) con su pago asociado."""
    return _request(
        "GET",
        f"/authorized_payments/{_id_mp(authorized_payment_id, 'authorized_payment_id')}",
        token,
    )
