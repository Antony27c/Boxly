"""Cliente HTTP y firma de webhooks de Mercado Pago, compartidos.

Hay dos cuentas de MP con flujos distintos que usan esto mismo:

- la de cada taller, para cobrar sus órdenes (app/api/v1/pagos);
- la de Boxly, para cobrar la suscripción de los talleres
  (app/api/v1/suscripcion_mp).

Cada una pasa su propio token de acceso y su propio secreto de webhook; la
lógica de firma (x-signature) y de HTTP es idéntica y vive acá una sola vez.
"""
import hashlib
import hmac
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

API_URL = "https://api.mercadopago.com"


class MercadoPagoError(Exception):
    pass


# Los ids de MP van dentro de la ruta de la API: solo caracteres seguros.
ID_SEGURO = re.compile(r"[A-Za-z0-9_-]{1,64}")

# Ventana de validez del timestamp de x-signature (segundos Unix). Solo se exige
# en producción; en desarrollo se aceptan firmas de prueba con ts arbitrario.
VENTANA_FIRMA_SEG = 300


def request(method: str, path: str, token: str, body: dict | None = None) -> dict[str, Any]:
    """Request autenticado a la API de MP. Los errores de red/JSON se traducen
    a MercadoPagoError para que el llamador no filtre detalles internos."""
    req = urllib.request.Request(
        f"{API_URL}{path}",
        data=json.dumps(body).encode() if body is not None else None,
        method=method,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            return json.loads(response.read())
    except (urllib.error.URLError, TimeoutError, ValueError) as exc:
        raise MercadoPagoError(str(exc)) from exc


def listar_preapprovals(token: str, *, limite: int = 50, offset: int = 0) -> dict[str, Any]:
    """Una página de ``GET /preapproval/search`` de la cuenta dueña del token.

    La búsqueda no filtra por ``external_reference`` (no es un parámetro
    documentado de la API): el llamador filtra los ``results`` que devuelve.
    """
    query = urllib.parse.urlencode({"limit": limite, "offset": offset})
    return request("GET", f"/preapproval/search?{query}", token)


def _ts_fresco(ts: str, ventana_seg: int) -> bool:
    """El ts de x-signature de MP viene en segundos Unix (algunos avisos, en ms)."""
    try:
        valor = int(str(ts).strip())
    except (TypeError, ValueError):
        return False
    if valor > 10**12:
        valor //= 1000
    return abs(time.time() - valor) <= ventana_seg


def firma_valida(
    secret: str,
    data_id: str | None,
    x_signature: str | None,
    x_request_id: str | None,
    *,
    ventana_seg: int | None = None,
) -> bool:
    """True si el header x-signature de MP es válido para esta notificación.

    El manifest es ``id:<data.id>;request-id:<x-request-id>;ts:<ts>;`` y la
    comparación es en tiempo constante. Con ``ventana_seg`` se exige además que
    el ts sea reciente (producción, anti-replay); con ``None`` no se mira la
    fecha (desarrollo, firmas de prueba).
    """
    partes = {}
    for trozo in (x_signature or "").split(","):
        clave, sep, valor = trozo.partition("=")
        if sep:
            partes[clave.strip()] = valor.strip()
    ts, v1 = partes.get("ts"), partes.get("v1")
    if not ts or not v1 or not x_request_id:
        return False
    if ventana_seg is not None and not _ts_fresco(ts, ventana_seg):
        return False
    manifest = f"id:{data_id or ''};request-id:{x_request_id};ts:{ts};"
    esperado = hmac.new(
        secret.encode("utf-8"), manifest.encode("utf-8"), hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(esperado, v1)
