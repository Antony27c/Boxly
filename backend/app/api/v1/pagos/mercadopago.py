"""Cliente de la cuenta de Mercado Pago de cada taller (cobro de órdenes).

La lógica HTTP, el error y la validación de ids viven en
app/core/mercadopago.py, compartida con la cuenta de Boxly
(app/api/v1/suscripcion_mp/cliente_mp.py).
"""
from decimal import Decimal

from app.core.mercadopago import API_URL, ID_SEGURO, MercadoPagoError, request

__all__ = ["API_URL", "MercadoPagoError", "crear_preferencia", "obtener_pago", "obtener_preferencia"]


def crear_preferencia(
    token: str,
    *,
    titulo: str,
    monto: Decimal,
    referencia: str,
    back_urls: dict[str, str],
    notification_url: str | None = None,
    idempotency_key: str | None = None,
) -> dict:
    body = {
        "items": [
            {"title": titulo, "quantity": 1, "unit_price": float(monto), "currency_id": "ARS"}
        ],
        "external_reference": referencia,
        "back_urls": back_urls,
    }
    if back_urls["success"].startswith("https://"):
        body["auto_return"] = "approved"
    if notification_url:
        body["notification_url"] = notification_url
    # Con X-Idempotency-Key, si la respuesta se pierde y se reintenta, MP
    # devuelve la misma preferencia en vez de crear otra huérfana.
    headers = {"X-Idempotency-Key": idempotency_key} if idempotency_key else None
    return request("POST", "/checkout/preferences", token, body, headers=headers)


def obtener_preferencia(token: str, preference_id: str) -> dict:
    # El id va dentro de la ruta de la API: solo caracteres seguros.
    if not ID_SEGURO.fullmatch(preference_id or ""):
        raise MercadoPagoError("preference_id inválido")
    return request("GET", f"/checkout/preferences/{preference_id}", token)


def obtener_pago(token: str, payment_id: str) -> dict:
    # Defensa en profundidad: el id va dentro de la URL, solo dígitos.
    if not payment_id.isdigit():
        raise MercadoPagoError("payment_id inválido")
    return request("GET", f"/v1/payments/{payment_id}", token)
