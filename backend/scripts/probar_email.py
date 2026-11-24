"""
Envía un correo de prueba con la plantilla de cambio de estado.

Uso (desde backend/, con venv activo y SMTP_* definidos en .env):

    python -m scripts.probar_email destinatario@gmail.com
"""
import asyncio
import sys

from app.core import email as mail
from app.core.config import get_settings


async def main(destino: str) -> None:
    s = get_settings()
    if not s.smtp_user or not s.smtp_password:
        sys.exit("Faltan SMTP_USER / SMTP_PASSWORD en backend/.env")
    # send_message directo (no el wrapper) para ver el error real si falla
    from fastapi_mail import MessageSchema, MessageType
    html = mail.ESTADO_TEMPLATE.format(
        cliente_nombre="Prueba, Cliente", vehiculo_patente="ABC123",
        vehiculo_marca="Marca", vehiculo_modelo="Modelo", orden_codigo="OT-PRUEBA",
        estado_nombre="Listo", comentario="Correo de prueba de Boxly", fecha="--",
    )
    await mail._get_fastmail().send_message(MessageSchema(
        subject="Prueba Boxly", recipients=[destino], body=html, subtype=MessageType.html))
    print(f"Enviado a {destino}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    asyncio.run(main(sys.argv[1]))
