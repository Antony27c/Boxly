import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from html import escape

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
        .header {{ background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }}
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
            <p>Tu vehículo <strong>{vehiculo_patente}</strong> ({vehiculo_marca} {vehiculo_modelo}) ha cambiado de estado.</p>
            
            <div class="info">
                <p><strong>Orden:</strong> {orden_codigo}</p>
                <p><strong>Nuevo estado:</strong> <span class="estado">{estado_nombre}</span></p>
                <p><strong>Descripción:</strong> {comentario}</p>
            </div>
            
            {progreso}

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


async def _enviar(email: str, asunto: str, html: str, orden_codigo: str) -> ResultadoEnvio:
    """Manda el correo. Nunca lanza: devuelve cómo salió."""
    settings = get_settings()
    if not settings.smtp_user or not settings.smtp_password or not _remitente():
        logger.warning("SMTP sin configurar: no se envía el aviso de la orden %s", orden_codigo)
        return ResultadoEnvio("omitido", asunto, "El servidor de correo no está configurado")
    message = MessageSchema(subject=asunto, recipients=[email], body=html, subtype=MessageType.html)
    try:
        await _get_fastmail().send_message(message)
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
) -> ResultadoEnvio:
    """Aviso al cliente de que cambió el estado de su orden."""
    html = ESTADO_TEMPLATE.format(
        cliente_nombre=escape(cliente_nombre),
        vehiculo_patente=escape(vehiculo_patente),
        vehiculo_marca=escape(vehiculo_marca),
        vehiculo_modelo=escape(vehiculo_modelo),
        orden_codigo=escape(orden_codigo),
        estado_nombre=escape(estado_nombre),
        comentario=escape(comentario),
        progreso=_barra_progreso(estado_codigo),
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
) -> ResultadoEnvio:
    """Aviso al cliente de que se emitió (aprobó) el cobro de su orden."""
    html = COBRO_TEMPLATE.format(
        cliente_nombre=escape(cliente_nombre),
        vehiculo_patente=escape(vehiculo_patente),
        vehiculo_marca=escape(vehiculo_marca),
        vehiculo_modelo=escape(vehiculo_modelo),
        orden_codigo=escape(orden_codigo),
        estado_nombre=escape(estado_nombre),
        monto=escape(monto),
        fecha=_fecha(),
    )
    return await _enviar(email, f"Cobro emitido - orden {orden_codigo}", html, orden_codigo)
