"""Adicionales del taller encima de su plan (docs/Oferta.md, C2): solo superadmin.

``AdicionalTaller`` no usa TallerMixin (es dato de la plataforma sobre el
taller): toda consulta filtra por ``taller_id`` explícito.
"""
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.plataforma_suscripciones.acceso import auditar_plataforma
from app.api.v1.suscripcion import service as suscripcion
from app.models import AdicionalTaller, Plan, Taller, Usuario
from app.schemas.suscripcion import AdicionalCreate, AdicionalResponse

_MSG_YA_INCLUIDA = "El plan ya incluye esta función"


def _activos(db: Session, taller_id: int, codigo: str | None = None) -> list[AdicionalTaller]:
    stmt = select(AdicionalTaller).where(
        AdicionalTaller.taller_id == taller_id,
        AdicionalTaller.activo.is_(True),
    )
    if codigo is not None:
        stmt = stmt.where(AdicionalTaller.codigo == codigo)
    return list(db.scalars(stmt.order_by(AdicionalTaller.codigo, AdicionalTaller.id)))


def _exigir_que_el_plan_no_la_incluya(db: Session, taller: Taller, codigo: str) -> None:
    plan = db.get(Plan, taller.plan_codigo)
    if plan is not None and codigo in (plan.funciones or []):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=_MSG_YA_INCLUIDA)


def listar(db: Session, taller_id: int) -> list[AdicionalResponse]:
    """Adicionales activos del taller, vigentes o no (el superadmin ve también
    los que vencieron o todavía no empezaron)."""
    suscripcion.taller_por_id(db, taller_id)
    return [AdicionalResponse.model_validate(a) for a in _activos(db, taller_id)]


def _ruta(taller_id: int) -> str:
    return f"/api/v1/plataforma/talleres/{taller_id}/adicionales"


def _fecha(valor) -> str:
    return valor.isoformat() if valor else "sin fecha"


def activar(
    db: Session, taller_id: int, datos: AdicionalCreate, usuario: Usuario
) -> AdicionalResponse:
    """Activa el adicional o actualiza la vigencia del que ya estaba activo.
    Queda en la auditoría de la plataforma con el código y las fechas."""
    taller = suscripcion.taller_por_id(db, taller_id)
    _exigir_que_el_plan_no_la_incluya(db, taller, datos.codigo)
    existentes = _activos(db, taller_id, datos.codigo)
    adicional = existentes[0] if existentes else AdicionalTaller(
        taller_id=taller_id, codigo=datos.codigo, activo=True
    )
    adicional.desde = datos.desde
    adicional.hasta = datos.hasta
    db.add(adicional)
    auditar_plataforma(
        db, usuario, taller_id,
        f"Adicional {datos.codigo} activado: desde {_fecha(datos.desde)}, "
        f"hasta {_fecha(datos.hasta)}",
        metodo="POST", ruta=_ruta(taller_id), estado_http=status.HTTP_201_CREATED,
    )
    db.commit()
    db.refresh(adicional)
    return AdicionalResponse.model_validate(adicional)


def desactivar(db: Session, taller_id: int, codigo: str, usuario: Usuario) -> None:
    suscripcion.taller_por_id(db, taller_id)
    activos = _activos(db, taller_id, codigo)
    if not activos:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Adicional no encontrado")
    for adicional in activos:
        adicional.activo = False
    db.add_all(activos)
    auditar_plataforma(
        db, usuario, taller_id, f"Adicional {codigo} desactivado",
        metodo="DELETE", ruta=f"{_ruta(taller_id)}/{codigo}",
        estado_http=status.HTTP_204_NO_CONTENT,
    )
    db.commit()
