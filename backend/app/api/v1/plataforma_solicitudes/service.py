"""Solicitudes de demo de la landing, vistas por el superadmin (docs/Landing.md, L5)."""
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import SolicitudContacto
from app.schemas import paginacion
from app.schemas.paginacion import ParametrosPagina
from app.schemas.publico import SolicitudUpdate


def listar(
    db: Session, estado: str | None, pagina: ParametrosPagina
) -> tuple[list[SolicitudContacto], int]:
    stmt = select(SolicitudContacto)
    if estado is not None:
        stmt = stmt.where(SolicitudContacto.estado == estado)
    total = paginacion.contar(db, stmt)
    stmt = stmt.order_by(SolicitudContacto.creado_en.desc(), SolicitudContacto.id.desc())
    return list(db.scalars(paginacion.aplicar(stmt, pagina))), total


def actualizar(db: Session, solicitud_id: int, data: SolicitudUpdate) -> SolicitudContacto:
    solicitud = db.get(SolicitudContacto, solicitud_id)
    if solicitud is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Solicitud no encontrada")
    solicitud.estado = data.estado
    # La nota solo cambia si viene en el body (null o "" la borran).
    if "nota" in data.model_fields_set:
        solicitud.nota = data.nota or None
    db.commit()
    db.refresh(solicitud)
    return solicitud
