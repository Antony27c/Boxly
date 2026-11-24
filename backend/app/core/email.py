import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from html import escape

import httpx
from fastapi_mail import ConnectionConfig, FastMail, MessageSchema, MessageType

from app.core.config import get_settings
from app.schemas.orden import ESTADOS_ORDEN

logger = logging.getLogger(__name__)

_fastmail: FastMail | None = None


@dataclass
class ResultadoEnvio:
    resultado: str  # "enviado" | "fallido" | "omitido"
    asunto: str
    error: str | None = None


def _remitente() -> str:
    settings = get_settings()
    return settings.smtp_from_email or settings.smtp_user


def _get_fastmail() -> FastMail:
    global _fastmail
    if _fastmail is None:
        settings = get_settings()
        _fastmail = FastMail(
            ConnectionConfig(
                MAIL_FROM=_remitente(),
                MAIL_USERNAME=settings.smtp_user,
                MAIL_PASSWORD=settings.smtp_password,
                MAIL_FROM_NAME=settings.smtp_from_name,
                MAIL_PORT=settings.smtp_port,
                MAIL_SERVER=settings.smtp_host,
                MAIL_STARTTLS=settings.smtp_tls,
                MAIL_SSL_TLS=False,
                USE_CREDENTIALS=True,
                VALIDATE_CERTS=True,
                TIMEOUT=15,  # puerto bloqueado: que falle rápido en vez de colgar 60 s
            )
        )
    return _fastmail


# Plantilla HTML para notificación de cambio de estado
ESTADO_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{
            background: #2563eb; color: white; padding: 20px; text-align: center;
            border-radius: 8px 8px 0 0;
        }}
        .content {{ background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }}
        .info {{ background: white; padding: 15px; border-left: 4px solid #2563eb; margin: 20px 0; }}
        .estado {{ font-size: 18px; font-weight: bold; color: #2563eb; }}
        .footer {{ text-align: center; margin-top: 30px; color: #666; font-size: 12px; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔧 Boxly Taller Mecánico</h1>
        </div>
        <div class="content">
            <h2>Actualización de tu orden de trabajo</h2>
            <p>Hola <strong>{cliente_nombre}</strong>,</p>
            <p>Tu vehículo <strong>{vehiculo_patente}</strong> ({vehiculo_marca} {vehiculo_modelo})
            ha cambiado de estado.</p>
            
            <div class="info">
                <p><strong>Orden:</strong> {orden_codigo}</p>
                <p><strong>Nuevo estado:</strong> <span class="estado">{estado_nombre}</span></p>
                <p><strong>Descripción:</strong> {comentario}</p>
            </div>
            
            {progreso}
            {pago}

            <p>Si tenés alguna consulta, no dudes en contactarnos.</p>
            
            <div class="footer">
                <p>Boxly Taller Mecánico - {fecha}</p>
            </div>
        </div>
    </div>
</body>
</html>
"""
 
COBRO_TEMPLATE = ESTADO_TEMPLATE.replace("{progreso}", "").replace(
    "<h2>Actualización de tu orden de trabajo</h2>", "<h2>Tu orden tiene un cobro emitido</h2>"
).replace(
    "ha cambiado de estado.", "ya tiene el monto a pagar definido."
).replace(
    """<p><strong>Nuevo estado:</strong> <span class="estado">{estado_nombre}</span></p>
                <p><strong>Descripción:</strong> {comentario}</p>""",
    """<p><strong>Monto a pagar:</strong> <span class="estado">{monto}</span></p>
                <p><strong>Estado de la orden:</strong> {estado_nombre}</p>""",
)


def _barra_progreso(estado_codigo: str) -> str:
    """Etapas de la orden con las superadas y la actual marcadas (estilos en línea: es para email)."""
    if estado_codigo == "cancelado":
        return (
            '<p style="color:#b91c1c;font-weight:bold;margin:20px 0;">'
            "Esta orden fue cancelada.</p>"
        )
    etapas = [codigo for codigo in ESTADOS_ORDEN if codigo != "cancelado"]
    if estado_codigo not in etapas:
        return ""
    actual = etapas.index(estado_codigo)
    celdas = []
    for indice, codigo in enumerate(etapas):
        if indice < actual:
            fondo, color, peso = "#16a34a", "#16a34a", "normal"
        elif indice == actual:
            fondo, color, peso = "#2563eb", "#2563eb", "bold"
        else:
            fondo, color, peso = "#d1d5db", "#6b7280", "normal"
        celdas.append(
            '<td align="center" valign="top" style="padding:0 2px;">'
            f'<div style="height:6px;background:{fondo};border-radius:3px;"></div>'
            f'<div style="font-size:11px;color:{color};font-weight:{peso};margin-top:6px;">'
            f"{escape(ESTADOS_ORDEN[codigo][0])}</div></td>"
        )
    return (
        '<p style="margin:20px 0 6px;"><strong>Avance de tu orden</strong> '
        f"(etapa {actual + 1} de {len(etapas)})</p>"
        '<table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>'
        + "".join(celdas)
        + "</tr></table>"
    )


def pesos(valor) -> str:
    """Monto en pesos con el formato argentino: $ 15.000,00."""
    return "$ " + f"{valor:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


_CAJA = "background:#fff;border:1px solid #e5e7eb;border-radius:6px;padding:16px;margin:20px 0;"
_TITULO_PAGO = '<p style="margin:0 0 6px;"><strong>Cómo pagar</strong></p>'


def _como_pagar(enlace: str) -> str:
    """Online por Mercado Pago si el taller cobra online (hay enlace); si no, en el local."""
    if not enlace:
        return (
            '<p style="margin:0;">Lo abonás en el taller cuando retires tu vehículo: '
            "efectivo, tarjeta, transferencia u otro medio.</p>"
        )
    return (
        '<p style="margin:0 0 12px;">Podés pagar online con Mercado Pago desde tu cuenta de Boxly:</p>'
        f'<p style="text-align:center;margin:0 0 12px;"><a href="{escape(enlace, quote=True)}" '
        'style="background:#2563eb;color:white;padding:12px 28px;border-radius:6px;'
        'text-decoration:none;font-weight:bold;display:inline-block;">Pagar mi orden</a></p>'
        '<p style="font-size:13px;color:#666;margin:0;">También podés abonarlo en el taller '
        "cuando retires tu vehículo.</p>"
    )


def _bloque_pago(estado_codigo: str, monto: str | None, pagada: bool, enlace: str) -> str:
    """Cómo pagar, solo con la orden lista o entregada (estilos en línea: es para email)."""
    if estado_codigo not in ("listo", "entregado"):
        return ""
    if pagada:
        return (
            '<p style="color:#16a34a;font-weight:bold;margin:20px 0;">'
            "✔ Esta orden ya está paga. ¡Gracias!</p>"
        )
    if not monto:
        return (
            f'<div style="{_CAJA}">{_TITULO_PAGO}'
            '<p style="margin:0;">El taller todavía está definiendo el monto a pagar. '
            "Te avisamos por este medio apenas esté listo.</p></div>"
        )
    return (
        f'<div style="{_CAJA}">{_TITULO_PAGO}'
        f'<p style="margin:0 0 12px;">Monto a pagar: <strong>{escape(monto)}</strong></p>'
        f"{_como_pagar(enlace)}</div>"
    )


def _proveedor() -> str:
    """Resend o Brevo (HTTPS) si hay clave; si no, SMTP."""
    settings = get_settings()
    if settings.resend_api_key:
        return "resend"
    if settings.brevo_api_key:
        return "brevo"
    return "smtp"


async def _post_json(url: str, headers: dict, payload: dict) -> tuple[int, str]:
    async with httpx.AsyncClient(timeout=15) as cliente:
        respuesta = await cliente.post(url, headers=headers, json=payload)
    return respuesta.status_code, respuesta.text


async def _enviar_http(proveedor: str, email: str, asunto: str, html: str) -> None:
    settings = get_settings()
    nombre = settings.smtp_from_name
    if proveedor == "resend":
        url = "https://api.resend.com/emails"
        headers = {"Authorization": f"Bearer {settings.resend_api_key}"}
        remitente = _remitente() or "onboarding@resend.dev"
        payload = {"from": f"{nombre} <{remitente}>", "to": [email], "subject": asunto, "html": html}
    else:
        url = "https://api.brevo.com/v3/smtp/email"
        headers = {"api-key": settings.brevo_api_key}
        payload = {
            "sender": {"name": nombre, "email": _remitente()},
            "to": [{"email": email}],
            "subject": asunto,
            "htmlContent": html,
        }
    estado, cuerpo = await _post_json(url, headers, payload)
    if estado >= 300:
        raise RuntimeError(f"{proveedor} respondió {estado}: {cuerpo[:300]}")


async def _enviar(email: str, asunto: str, html: str, orden_codigo: str) -> ResultadoEnvio:
    """Manda el correo. Nunca lanza: devuelve cómo salió."""
    settings = get_settings()
    proveedor = _proveedor()
    if proveedor == "smtp":
        configurado = bool(settings.smtp_user and settings.smtp_password and _remitente())
    else:
        configurado = bool(_remitente()) or proveedor == "resend"
    if not configurado:
        logger.warning("Correo sin configurar: no se envía el aviso de la orden %s", orden_codigo)
        return ResultadoEnvio("omitido", asunto, "El servidor de correo no está configurado")
    try:
        if proveedor == "smtp":
            message = MessageSchema(subject=asunto, recipients=[email], body=html, subtype=MessageType.html)
            await _get_fastmail().send_message(message)
        else:
            await _enviar_http(proveedor, email, asunto, html)
    except Exception as problema:
        logger.exception("No se pudo enviar el aviso de la orden %s a %s", orden_codigo, email)
        return ResultadoEnvio("fallido", asunto, f"{type(problema).__name__}: {problema}"[:500])
    return ResultadoEnvio("enviado", asunto)


def _fecha() -> str:
    return datetime.now(timezone.utc).strftime("%d/%m/%Y %H:%M UTC")


async def enviar_notificacion_cambio_estado(
    email: str,
    cliente_nombre: str,
    vehiculo_patente: str,
    vehiculo_marca: str,
    vehiculo_modelo: str,
    orden_codigo: str,
    estado_nombre: str,
    comentario: str,
    estado_codigo: str = "",
    monto: str | None = None,
    pagada: bool = False,
    enlace_pago: str = "",
) -> ResultadoEnvio:
    """Aviso al cliente de que cambió el estado de su orden.

    `monto` es el cobro emitido (None si todavía no hay); `enlace_pago` lleva a
    la orden en el portal y va vacío si el taller no cobra online.
    """
    html = ESTADO_TEMPLATE.format(
        cliente_nombre=escape(cliente_nombre),
        vehiculo_patente=escape(vehiculo_patente),
        vehiculo_marca=escape(vehiculo_marca),
        vehiculo_modelo=escape(vehiculo_modelo),
        orden_codigo=escape(orden_codigo),
        estado_nombre=escape(estado_nombre),
        comentario=escape(comentario),
        progreso=_barra_progreso(estado_codigo),
        pago=_bloque_pago(estado_codigo, monto, pagada, enlace_pago),
        fecha=_fecha(),
    )
    return await _enviar(
        email, f"Actualización de orden {orden_codigo} - {estado_nombre}", html, orden_codigo
    )


async def enviar_notificacion_cobro(
    email: str,
    cliente_nombre: str,
    vehiculo_patente: str,
    vehiculo_marca: str,
    vehiculo_modelo: str,
    orden_codigo: str,
    estado_nombre: str,
    monto: str,
    enlace_pago: str = "",
) -> ResultadoEnvio:
    """Aviso al cliente de que se emitió (aprobó) el cobro de su orden, con cómo pagarlo."""
    html = COBRO_TEMPLATE.format(
        cliente_nombre=escape(cliente_nombre),
        vehiculo_patente=escape(vehiculo_patente),
        vehiculo_marca=escape(vehiculo_marca),
        vehiculo_modelo=escape(vehiculo_modelo),
        orden_codigo=escape(orden_codigo),
        estado_nombre=escape(estado_nombre),
        monto=escape(monto),
        pago=f'<div style="{_CAJA}">{_TITULO_PAGO}{_como_pagar(enlace_pago)}</div>',
        fecha=_fecha(),
    )
    return await _enviar(email, f"Cobro emitido - orden {orden_codigo}", html, orden_codigo)


INVITACION_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #2563eb; color: white; padding: 20px; text-align: center;
                    border-radius: 8px 8px 0 0;">
            <h1>🔧 Boxly Taller Mecánico</h1>
        </div>
        <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
            <h2>Activá tu cuenta</h2>
            <p>Hola <strong>{cliente_nombre}</strong>,</p>
            <p>El taller te dio de alta en Boxly.
            Desde tu cuenta vas a poder seguir el estado de tus vehículos, ver tus órdenes y pagar online.</p>
            <p>Revisá que tus datos sean correctos y elegí tu contraseña:</p>
            <p style="text-align: center; margin: 30px 0;">
                <a href="{enlace}"
                   style="background: #2563eb; color: white; padding: 12px 28px; border-radius: 6px;
                          text-decoration: none; font-weight: bold;">Activar mi cuenta</a>
            </p>
            <p style="font-size: 13px; color: #666;">
                Si el botón no funciona, copiá este enlace en tu navegador:<br>{enlace}
            </p>
            <p style="font-size: 13px; color: #666;">
                El enlace vale {horas} horas. Si no esperabas este correo, ignoralo.
            </p>
            <p style="text-align: center; margin-top: 30px; color: #666; font-size: 12px;">
                Boxly Taller Mecánico - {fecha}
            </p>
        </div>
    </div>
</body>
</html>
"""


async def enviar_invitacion_portal(email: str, cliente_nombre: str, enlace: str) -> ResultadoEnvio:
    """Invitación para que el cliente confirme sus datos y cree su contraseña."""
    from app.core.security import INVITACION_HORAS

    html = INVITACION_TEMPLATE.format(
        cliente_nombre=escape(cliente_nombre),
        enlace=escape(enlace, quote=True),
        horas=INVITACION_HORAS,
        fecha=_fecha(),
    )
    return await _enviar(email, "Activá tu cuenta de Boxly", html, "invitación")
