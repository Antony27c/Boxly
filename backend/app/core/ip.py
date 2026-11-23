"""IP del cliente: una sola función para la auditoría y los límites por IP.

La IP es SIEMPRE la de la conexión (``scope["client"]``, o sea ``request.client.host``).
Los encabezados del proxy (``X-Forwarded-For``) no se leen acá a mano: cualquiera
puede mandarlos y falsear la IP auditada o saltear un límite.

Detrás de un proxy (Caddy en docker compose) la IP real la pone uvicorn: con
``--proxy-headers`` (activo por defecto) y ``--forwarded-allow-ips`` (en gunicorn,
la variable de entorno ``FORWARDED_ALLOW_IPS``), uvicorn reescribe ``client`` con la
IP que informa el proxy, pero solo cuando la conexión viene de un proxy de confianza.
Ver docs/Despliegue.md, sección "Proxy e IP del cliente".
"""
from starlette.requests import Request
from starlette.types import Scope

# Largo de las columnas ``ip`` (auditoría y solicitudes de contacto): entra una IPv6.
_LARGO_IP = 45


def ip_de_scope(scope: Scope) -> str | None:
    """IP de la conexión a partir del scope ASGI (para middlewares)."""
    cliente = scope.get("client")
    if not cliente or not cliente[0]:
        return None
    return str(cliente[0])[:_LARGO_IP]


def ip_cliente(request: Request) -> str | None:
    """IP de la conexión de la request (para routers, servicios y límites)."""
    return ip_de_scope(request.scope)
