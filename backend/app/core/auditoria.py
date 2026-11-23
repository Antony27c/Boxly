"""Middleware de auditoría (tareas B2 y P2).

ASGI puro (sin BaseHTTPMiddleware): para cada POST/PUT/PATCH/DELETE bajo
/api/v1 deja pasar la request, captura el código de respuesta y después
escribe una fila en la tabla ``auditoria`` con su propia SessionLocal.

Desde P2 también registra los GET/HEAD cuando la request va en modo soporte
(header ``X-Taller-Soporte`` con acceso vigente: lo marca
``request.state.soporte`` en app.core.dependencies) y guarda el ``taller_id``
del usuario en cada fila.

El registro nunca cambia la respuesta: cualquier excepción se loguea con
logger.exception y se sigue de largo. En POST /api/v1/auth/login se lee el
body (sin consumirlo para la app) y se guarda solo el email intentado.
"""
import json
import logging
import urllib.parse

from sqlalchemy import select
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.security import decode_access_token
from app.db.session import SessionLocal
from app.models.auditoria import Auditoria
from app.models.usuario import Usuario

logger = logging.getLogger(__name__)

_METODOS = {"POST", "PUT", "PATCH", "DELETE"}
# Lecturas que se auditan solo en modo soporte (GET/HEAD; OPTIONS es el
# preflight de CORS y no aporta).
_METODOS_LECTURA = {"GET", "HEAD"}
_PREFIJO = "/api/v1"
_LOGIN = "/api/v1/auth/login"
_HEADER_SOPORTE = b"x-taller-soporte"
# El webhook de Mercado Pago no expone body útil para auditar (payload de MP).
_RUTAS_SIN_BODY = {"/api/v1/pagos/webhook"}


def _entidad_y_id(ruta: str) -> tuple[str | None, int | None]:
    """Primer segmento después de /api/v1/ como entidad; primer segmento
    numérico de la ruta como entidad_id."""
    partes = [p for p in ruta.split("/") if p]
    try:
        i = partes.index("api") + 1
        j = partes.index("v1", i) + 1
        entidad = partes[j] if j < len(partes) else None
    except ValueError:
        entidad = None
    entidad_id = None
    for parte in partes:
        if parte.isdigit():
            entidad_id = int(parte)
            break
    return entidad, entidad_id


def _ip(scope: Scope) -> str | None:
    for nombre, valor in scope.get("headers", []):
        if nombre == b"x-forwarded-for":
            # La primera IP de la cadena es la del cliente.
            ip = valor.decode("latin-1").split(",")[0].strip()
            if ip:
                return ip[:45]
            break
    cliente = scope.get("client")
    if cliente:
        return str(cliente[0])[:45]
    return None


def _usuario(scope: Scope) -> tuple[int | None, str | None, str | None]:
    """(usuario_id, email, rol) del Bearer, si el JWT es válido."""
    token = None
    for nombre, valor in scope.get("headers", []):
        if nombre == b"authorization":
            partes = valor.decode("latin-1").split()
            if len(partes) == 2 and partes[0].lower() == "bearer":
                token = partes[1]
            break
    if not token:
        return None, None, None
    try:
        payload = decode_access_token(token)
        usuario_id = int(payload.get("sub") or 0) or None
    except (ValueError, TypeError):
        return None, None, None
    email = payload.get("email")
    rol = payload.get("rol")
    return (
        usuario_id,
        str(email)[:120] if email else None,
        str(rol)[:20] if rol else None,
    )


def _header_soporte(scope: Scope) -> int | None:
    """taller_id del header X-Taller-Soporte, o None si no viene/no es entero."""
    for nombre, valor in scope.get("headers", []):
        if nombre == _HEADER_SOPORTE:
            try:
                return int(valor.decode("latin-1").strip())
            except ValueError:
                return None
    return None


def _modo_soporte(scope: Scope) -> bool:
    """La request entró en modo soporte de verdad (acceso vigente validado)."""
    estado = scope.get("state")
    return isinstance(estado, dict) and bool(estado.get("soporte"))


def _taller_del_usuario(db, usuario_id: int | None) -> int | None:
    """taller_id actual del usuario, buscado en la DB (sin contexto de taller:
    la sesión del middleware no tiene filtro y ve a todos los usuarios)."""
    if usuario_id is None:
        return None
    return db.scalar(select(Usuario.taller_id).where(Usuario.id == usuario_id))


def _email_del_login(scope: Scope, cuerpo: bytes) -> str | None:
    """Saca el email del body del login (JSON o form), sin la contraseña."""
    if not cuerpo:
        return None
    try:
        for nombre, valor in scope.get("headers", []):
            if nombre == b"content-type":
                tipo = valor.decode("latin-1").split(";")[0].strip().lower()
                break
        else:
            tipo = ""
        if tipo == "application/json":
            datos = json.loads(cuerpo)
            email = datos.get("email") if isinstance(datos, dict) else None
        elif tipo in ("application/x-www-form-urlencoded", "multipart/form-data"):
            campos = urllib.parse.parse_qs(
                cuerpo.decode("latin-1"), keep_blank_values=True
            )
            email = campos.get("email", [None])[0]
        else:
            return None
        return str(email)[:120] if email else None
    except Exception:
        return None


class AuditoriaMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        ruta = scope.get("path") or ""
        if not ruta.startswith(_PREFIJO):
            await self.app(scope, receive, send)
            return

        metodo = scope.get("method")
        # Las escrituras siempre; las lecturas solo si el request puede ser de
        # soporte (header presente: se confirma con el estado y el código HTTP).
        if metodo not in _METODOS and not (
            metodo in _METODOS_LECTURA and _header_soporte(scope) is not None
        ):
            await self.app(scope, receive, send)
            return

        # En /auth/login se envuelve receive para capturar el body a medida
        # que la app lo consume (sin tocarlo: los mensajes pasan tal cual).
        es_login = ruta == _LOGIN and scope.get("method") == "POST"
        cuerpo_login = bytearray()
        if es_login and ruta not in _RUTAS_SIN_BODY:

            async def receive_app() -> Message:
                mensaje = await receive()
                if mensaje["type"] == "http.request":
                    cuerpo_login.extend(mensaje.get("body", b""))
                return mensaje

        else:
            receive_app = receive

        estado_http = 0

        async def send_envuelto(mensaje: Message) -> None:
            nonlocal estado_http
            if mensaje["type"] == "http.response.start":
                estado_http = int(mensaje.get("status", 0))
            await send(mensaje)

        await self.app(scope, receive_app, send_envuelto)
        self._registrar(
            scope, ruta, estado_http, bytes(cuerpo_login) if es_login else None
        )

    def _registrar(self, scope: Scope, ruta: str, estado_http: int, cuerpo: bytes | None) -> None:
        try:
            metodo = scope["method"]
            with SessionLocal() as db:
                usuario_id, usuario_email, rol = _usuario(scope)
                # Modo soporte real (acceso vigente validado por dependencies)
                # y respuesta que no es el 403 del propio modo soporte.
                soporte = _modo_soporte(scope) and estado_http != 403
                if metodo in _METODOS:
                    escribir = True
                elif metodo in _METODOS_LECTURA:
                    escribir = soporte
                else:
                    escribir = False
                if not escribir:
                    return
                if cuerpo is not None and ruta not in _RUTAS_SIN_BODY:
                    # En el login el email auditado es el intentado, no el del JWT.
                    usuario_email = _email_del_login(scope, cuerpo) or usuario_email
                entidad, entidad_id = _entidad_y_id(ruta)
                taller_id = (
                    _header_soporte(scope) if soporte
                    else _taller_del_usuario(db, usuario_id)
                )
                fila = Auditoria(
                    usuario_id=usuario_id,
                    taller_id=taller_id,
                    soporte=soporte,
                    usuario_email=usuario_email,
                    rol=rol,
                    metodo=metodo,
                    ruta=ruta[:255],
                    entidad=(entidad or "")[:50] or None,
                    entidad_id=entidad_id,
                    estado_http=estado_http or 0,
                    ip=_ip(scope),
                    detalle=None,
                )
                db.add(fila)
                db.commit()
        except Exception:
            logger.exception("No se pudo registrar la auditoría de %s %s", scope.get("method"), ruta)
