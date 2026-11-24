from datetime import datetime, time, timedelta

from sqlalchemy import Select, select
from sqlalchemy.orm import Session

from app.models.auditoria import Auditoria
from app.schemas.auditoria import FiltrosAuditoria
from app.schemas.paginacion import ParametrosPagina, aplicar
from app.schemas.paginacion import contar as contar_stmt


def _stmt_filtrado(filtros: FiltrosAuditoria) -> Select:
    """SELECT de auditoría con los filtros aplicados (sin ORDER BY ni paginación)."""
    stmt = select(Auditoria)
    if filtros.taller_id is not None:
        stmt = stmt.where(Auditoria.taller_id == filtros.taller_id)
    if filtros.usuario_id is not None:
        stmt = stmt.where(Auditoria.usuario_id == filtros.usuario_id)
    if filtros.metodo:
        stmt = stmt.where(Auditoria.metodo == filtros.metodo.upper())
    if filtros.entidad:
        stmt = stmt.where(Auditoria.entidad == filtros.entidad)
    if filtros.desde is not None:
        stmt = stmt.where(Auditoria.creado_en >= datetime.combine(filtros.desde, time.min))
    if filtros.hasta is not None:
        # "hasta" es inclusiva: se compara contra el día siguiente a medianoche.
        stmt = stmt.where(
            Auditoria.creado_en < datetime.combine(filtros.hasta + timedelta(days=1), time.min)
        )
    if filtros.solo_errores:
        stmt = stmt.where(Auditoria.estado_http >= 400)
    return stmt


def listar(
    db: Session,
    filtros: FiltrosAuditoria,
    pagina: ParametrosPagina | None = None,
) -> list[Auditoria]:
    stmt = _stmt_filtrado(filtros).order_by(
        Auditoria.creado_en.desc(), Auditoria.id.desc()
    )
    if pagina is not None:
        stmt = aplicar(stmt, pagina)
    return list(db.scalars(stmt).all())


def contar(db: Session, filtros: FiltrosAuditoria) -> int:
    return contar_stmt(db, _stmt_filtrado(filtros))


def listar_para_exportar(
    db: Session,
    filtros: FiltrosAuditoria,
    tope: int = 10_000,
) -> list[Auditoria]:
    """Filas para el CSV: mismos filtros, orden igual, sin paginación y con tope."""
    stmt = (
        _stmt_filtrado(filtros)
        .order_by(Auditoria.creado_en.desc(), Auditoria.id.desc())
        .limit(tope)
    )
    return list(db.scalars(stmt).all())
