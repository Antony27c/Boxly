from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import ConfiguracionTaller, Usuario
from app.schemas.taller import TallerUpdate

FILA_ID = 1

# Valores por defecto al crear la fila (los mismos defaults del modelo).
_DEFAULTS = {
    "nombre": "Mi taller",
    "hora_apertura": "08:00",
    "hora_cierre": "18:00",
    "dias_garantia": 90,
}


def obtener(db: Session) -> ConfiguracionTaller:
    """La fila única del taller; si no existe la crea con los valores por defecto."""
    taller = db.get(ConfiguracionTaller, FILA_ID)
    if taller is None:
        taller = ConfiguracionTaller(id=FILA_ID, **_DEFAULTS)
        db.add(taller)
        db.commit()
        db.refresh(taller)
    return taller


def actualizar(db: Session, usuario: Usuario, datos: TallerUpdate) -> ConfiguracionTaller:
    taller = obtener(db)
    for campo, valor in datos.model_dump(exclude_unset=True).items():
        setattr(taller, campo, valor)

    # Es actualización parcial: el horario se valida sobre el resultado final,
    # no solo sobre los campos que vinieron en el pedido.
    if taller.hora_apertura and taller.hora_cierre and taller.hora_apertura >= taller.hora_cierre:
        raise HTTPException(
            status_code=422,
            detail="La hora de apertura tiene que ser antes que la de cierre",
        )

    taller.actualizado_por_id = usuario.id
    taller.actualizado_en = datetime.now(timezone.utc)
    db.commit()
    db.refresh(taller)
    return taller
