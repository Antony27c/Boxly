"""Límite de tamaño del body de los requests (tarea S14b).

Dos niveles:

- global: ``LIMITE_GLOBAL_BYTES`` (1 MB) para cualquier request;
- rutas sensibles sin autenticación (webhooks de Mercado Pago, contacto de la
  landing, login): ``LIMITE_RUTA_SENSIBLE_BYTES`` (64 KB);
- subida de imágenes de órdenes: ``LIMITE_IMAGEN_BYTES`` (el archivo de 5 MB
  más el overhead del multipart).

Se mira ``Content-Length`` y además se cuentan los bytes reales del stream: un
cliente que miente el tamaño declarado (o manda chunked) igual se corta con
413 antes de que la app parse el body.
"""
from starlette.types import Message, Receive, Scope, Send

from app.core.imagenes import MAX_BYTES_IMAGEN

LIMITE_GLOBAL_BYTES = 1024 * 1024
LIMITE_RUTA_SENSIBLE_BYTES = 64 * 1024
# 5 MB de imagen + margen para el multipart (boundary, campos, headers).
LIMITE_IMAGEN_BYTES = MAX_BYTES_IMAGEN + 1024 * 1024

_RUTAS_SENSIBLES = {
    ("POST", "/api/v1/pagos/webhook"),
    ("POST", "/api/v1/suscripcion/webhook"),
    ("POST", "/api/v1/publico/contacto"),
    ("POST", "/api/v1/auth/login"),
}


def _limite_para(method: str, path: str) -> int:
    if (method, path) in _RUTAS_SENSIBLES:
        return LIMITE_RUTA_SENSIBLE_BYTES
    if (
        method == "POST"
        and path.startswith("/api/v1/ordenes/")
        and path.endswith("/imagenes")
    ):
        return LIMITE_IMAGEN_BYTES
    return LIMITE_GLOBAL_BYTES


async def _respuesta_413(send: Send) -> None:
    await send(
        {
            "type": "http.response.start",
            "status": 413,
            "headers": [(b"content-type", b"application/json")],
        }
    )
    await send(
        {
            "type": "http.response.body",
            "body": b'{"detail":"El cuerpo del pedido es demasiado grande"}',
        }
    )


class LimiteTamanoBody:
    """Middleware ASGI: lee el body una vez, lo cuenta y lo replay a la app.

    Si el total supera el límite de la ruta responde 413 sin llamar a la app.
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        limite = _limite_para(scope.get("method", ""), scope.get("path", ""))

        # Content-Length declarado: si ya se pasa, ni se lee el stream.
        for nombre, valor in scope.get("headers", []):
            if nombre == b"content-length":
                try:
                    if int(valor) > limite:
                        await _respuesta_413(send)
                        return
                except (TypeError, ValueError):
                    pass

        # Lectura real del stream: el límite se aplica a los bytes que llegan,
        # no a lo que el cliente declara.
        cuerpo = bytearray()
        while True:
            mensaje = await receive()
            if mensaje["type"] == "http.disconnect":
                return
            if mensaje["type"] != "http.request":
                continue
            cuerpo += mensaje.get("body", b"")
            if len(cuerpo) > limite:
                await _respuesta_413(send)
                return
            if not mensaje.get("more_body", False):
                break

        # Replay del body bufferizado para que la app lo lea como siempre.
        replay_enviado = False

        async def receive_replay() -> Message:
            nonlocal replay_enviado
            if not replay_enviado:
                replay_enviado = True
                return {
                    "type": "http.request",
                    "body": bytes(cuerpo),
                    "more_body": False,
                }
            return await receive()

        await self.app(scope, receive_replay, send)
