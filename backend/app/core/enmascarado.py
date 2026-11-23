"""Enmascarado de datos personales en modo soporte (tarea P2).

Middleware ASGI puro: cuando la request entró en modo soporte (el header
``X-Taller-Soporte`` con acceso vigente, marcado por app.core.dependencies en
``scope["state"]["soporte"]``) y la respuesta es JSON, reescribe el body
enmascarando ``dni``, ``telefono``, ``email``, ``direccion`` y ``cuit`` en
cualquier nivel del documento. El formato es ``"****5678"`` (últimos 4
visibles; con menos de 5 caracteres, ``"****"``).

No toca otras respuestas (ZIP, CSV, imágenes) ni ``GET /auth/me``. Si el body
no se puede interpretar como JSON se reenvía tal cual.
"""
import json

from starlette.types import ASGIApp, Message, Receive, Scope, Send

_CAMPOS = frozenset({"dni", "telefono", "email", "direccion", "cuit"})
# La identidad del propio superadmin no se enmascara (contrato P2).
_RUTA_ME = "/api/v1/auth/me"


def _tiene_header_soporte(scope: Scope) -> bool:
    return any(
        nombre == b"x-taller-soporte" for nombre, _ in scope.get("headers", [])
    )


def _modo_soporte(scope: Scope) -> bool:
    estado = scope.get("state")
    return isinstance(estado, dict) and bool(estado.get("soporte"))


def _es_json(mensaje_inicio: Message) -> bool:
    for nombre, valor in mensaje_inicio.get("headers", []):
        if nombre == b"content-type":
            tipo = valor.decode("latin-1").split(";")[0].strip().lower()
            return tipo == "application/json" or tipo.endswith("+json")
    return False


def _enmascarar_texto(valor: str) -> str:
    return "****" if len(valor) < 5 else "****" + valor[-4:]


def _enmascarar(nodo):
    """Recorre dicts y listas; enmascara los campos sensibles en cualquier nivel."""
    if isinstance(nodo, dict):
        resultado = {}
        for clave, valor in nodo.items():
            if (
                isinstance(clave, str)
                and clave.lower() in _CAMPOS
                and isinstance(valor, str)
            ):
                resultado[clave] = _enmascarar_texto(valor)
            else:
                resultado[clave] = _enmascarar(valor)
        return resultado
    if isinstance(nodo, list):
        return [_enmascarar(item) for item in nodo]
    return nodo


class EnmascaradoSoporteMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if (
            scope["type"] != "http"
            or not _tiene_header_soporte(scope)
            or scope.get("path") == _RUTA_ME
        ):
            await self.app(scope, receive, send)
            return

        # Se bufferea solo lo necesario: el response.start define si la salida
        # es JSON (y si la request es de soporte de verdad). En ese caso los
        # bodies se acumulan y se reescriben al final; si no, pasan directo.
        inicio: Message | None = None
        enmascarar = False
        cuerpo = bytearray()

        async def send_envuelto(mensaje: Message) -> None:
            nonlocal inicio, enmascarar
            tipo = mensaje["type"]
            if tipo == "http.response.start":
                inicio = mensaje
                enmascarar = _es_json(mensaje) and _modo_soporte(scope)
                if not enmascarar:
                    await send(mensaje)
                return
            if tipo == "http.response.body" and enmascarar:
                cuerpo.extend(mensaje.get("body", b""))
                return
            await send(mensaje)

        await self.app(scope, receive, send_envuelto)

        if not enmascarar or inicio is None:
            return

        try:
            datos = json.loads(bytes(cuerpo))
            payload = json.dumps(
                _enmascarar(datos), ensure_ascii=False
            ).encode("utf-8")
        except Exception:
            # Body que no es JSON válido: se entrega sin tocar.
            payload = bytes(cuerpo)

        headers = [
            (nombre, valor)
            for nombre, valor in inicio.get("headers", [])
            if nombre.lower() != b"content-length"
        ]
        headers.append((b"content-length", str(len(payload)).encode("latin-1")))
        nuevo_inicio = {**inicio, "headers": headers}
        await send(nuevo_inicio)
        await send({"type": "http.response.body", "body": payload, "more_body": False})
