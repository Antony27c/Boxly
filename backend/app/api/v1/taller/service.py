from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import CLAVE_TALLER
from app.models import ConfiguracionTaller, Usuario
from app.models.taller import TALLER_PRINCIPAL_ID
from app.schemas.taller import TallerResponse, TallerUpdate

# Valores por defecto al crear la fila (los mismos defaults del modelo).
_DEFAULTS = {
    "nombre": "Mi taller",
    "hora_apertura": "08:00",
    "hora_cierre": "18:00",
    "dias_garantia": 90,
}


def _taller_sesion(db: Session) -> int:
    """Taller de la sesión actual. Sin taller (plataforma o sistema) no hay datos que dar."""
    taller_id = db.info.get(CLAVE_TALLER)
    if taller_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tenés permisos para esta acción",
        )
    return taller_id


def _config_sesion(db: Session) -> ConfiguracionTaller:
    """La fila de configuración del taller de la sesión; la crea si falta."""
    taller_id = _taller_sesion(db)
    config = db.scalar(
        select(ConfiguracionTaller).where(ConfiguracionTaller.taller_id == taller_id)
    )
    if config is None:
        # ConfiguracionTaller no usa TallerMixin: el taller va explícito.
        config = ConfiguracionTaller(taller_id=taller_id, **_DEFAULTS)
        db.add(config)
        db.commit()
        db.refresh(config)
    return config


def _a_response(config: ConfiguracionTaller) -> TallerResponse:
    respuesta = TallerResponse.model_validate(config)
    # Cobro online propio: hoy solo el taller principal (docs/Plataforma.md, P3).
    respuesta.pago_online = config.taller_id == TALLER_PRINCIPAL_ID
    return respuesta


def obtener(db: Session) -> TallerResponse:
    """Datos del taller de la sesión (cualquier usuario del taller; superadmin: 403)."""
    return _a_response(_config_sesion(db))


def actualizar(db: Session, usuario: Usuario, datos: TallerUpdate) -> TallerResponse:
    taller = _config_sesion(db)
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
    return _a_response(taller)
