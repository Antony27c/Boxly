"""Lógica de la API pública de la landing (docs/Landing.md, L5)."""
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Plan, SolicitudContacto
from app.schemas.publico import ContactoCreate

LIMITE_POR_IP = 5
VENTANA_LIMITE = timedelta(hours=1)
MENSAJE_LIMITE = "Recibimos varias solicitudes, probá más tarde"


def planes_activos(db: Session) -> list[Plan]:
    return list(
        db.scalars(
            select(Plan).where(Plan.activo.is_(True)).order_by(Plan.precio_mensual, Plan.codigo)
        )
    )


def registrar_contacto(db: Session, data: ContactoCreate, ip: str | None) -> None:
    """Guarda la solicitud. Con el campo trampa lleno no guarda nada (y no avisa)."""
    if data.sitio_web:
        return

    ahora = datetime.now(timezone.utc)
    if ip:
        recientes = db.scalar(
            select(func.count(SolicitudContacto.id)).where(
                SolicitudContacto.ip == ip,
                SolicitudContacto.creado_en >= ahora - VENTANA_LIMITE,
            )
        ) or 0
        if recientes >= LIMITE_POR_IP:
            raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, detail=MENSAJE_LIMITE)

    db.add(
        SolicitudContacto(
            nombre=data.nombre,
            taller=data.taller,
            email=str(data.email),
            telefono=data.telefono,
            ciudad=data.ciudad,
            mensaje=data.mensaje,
            ip=ip[:45] if ip else None,
            # Explícito (no server_default) para que el conteo compare igual en SQLite.
            creado_en=ahora,
        )
    )
    db.commit()
