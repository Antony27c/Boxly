import json
import urllib.error
import urllib.request
from decimal import Decimal

API_URL = "https://api.mercadopago.com"


class MercadoPagoError(Exception):
    pass


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


def crear_preferencia(
    token: str,
    *,
    titulo: str,
    monto: Decimal,
    referencia: str,
    back_urls: dict[str, str],
    notification_url: str | None = None,
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
    return _request("POST", "/checkout/preferences", token, body)


def obtener_pago(token: str, payment_id: str) -> dict:
    return _request("GET", f"/v1/payments/{payment_id}", token)
