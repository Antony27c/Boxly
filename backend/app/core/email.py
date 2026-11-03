from fastapi_mail import FastMail, MessageSchema, MessageType
from pydantic import EmailStr
from typing import List
from app.core.config import get_settings
 
settings = get_settings()
 
fastmail = FastMail(
    {
        "MAIL_FROM": f"{settings.smtp_from_name} <{settings.smtp_from_email}>",
        "MAIL_USERNAME": settings.smtp_user,
        "MAIL_PASSWORD": settings.smtp_password,
        "MAIL_FROM_NAME": settings.smtp_from_name,
        "MAIL_PORT": settings.smtp_port,
        "MAIL_SERVER": settings.smtp_host,
        "MAIL_STARTTLS": settings.smtp_tls,
        "MAIL_SSL_TLS": False,
        "USE_CREDENTIALS": True,
        "VALIDATE_CERTS": True,
    }
)
 
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
            
            <p>Si tenés alguna consulta, no dudes en contactarnos.</p>
            
            <div class="footer">
                <p>Boxly Taller Mecánico - {fecha}</p>
            </div>
        </div>
    </div>
</body>
</html>
"""
 
async def enviar_notificacion_cambio_estado(
    email: str,
    cliente_nombre: str,
    vehiculo_patente: str,
    vehiculo_marca: str,
    vehiculo_modelo: str,
    orden_codigo: str,
    estado_nombre: str,
    comentario: str,
) -> None:
    """Envía email de notificación cuando cambia el estado de una orden."""
    
    if not settings.smtp_user or not settings.smtp_password:
        # Si no hay configuración SMTP, no enviar email (modo desarrollo)
        return
    
    from datetime import datetime
    
    html_content = ESTADO_TEMPLATE.format(
        cliente_nombre=cliente_nombre,
        vehiculo_patente=vehiculo_patente,
        vehiculo_marca=vehiculo_marca,
        vehiculo_modelo=vehiculo_modelo,
        orden_codigo=orden_codigo,
        estado_nombre=estado_nombre,
        comentario=comentario,
        fecha=datetime.now().strftime("%d/%m/%Y %H:%M"),
    )
    
    message = MessageSchema(
        subject=f"Actualización de orden {orden_codigo} - {estado_nombre}",
        recipients=[email],
        body=html_content,
        subtype=MessageType.html,
    )
    
    await fastmail.send_message(message)