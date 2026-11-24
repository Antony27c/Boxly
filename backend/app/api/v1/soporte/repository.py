"""Consultas de accesos de soporte y de la actividad auditada (tarea P2).

El aislamiento por taller lo hace el filtro automático de app.db.session:
dentro del contexto de un taller solo se ven sus accesos y su auditoría; en
contexto plataforma (superadmin) se ven los de todos.
"""
from sqlalchemy import Select, select
from sqlalchemy.orm import Session

from app.models.auditoria import Auditoria
from app.models.taller import AccesoSoporte
from app.schemas.paginacion import ParametrosPagina, aplicar
from app.schemas.paginacion import contar as contar_stmt


def listar_accesos(db: Session) -> list[AccesoSoporte]:
    """Todos los accesos del taller del contexto, más nuevo primero."""
    stmt = select(AccesoSoporte).order_by(
        AccesoSoporte.desde.desc(), AccesoSoporte.id.desc()
    )
    return list(db.scalars(stmt).all())


def candidatos_vigentes(db: Session, taller_id: int) -> list[AccesoSoporte]:
    """Accesos no revocados de un taller puntual (la ventana se evalúa en Python)."""
    stmt = select(AccesoSoporte).where(
        AccesoSoporte.taller_id == taller_id,
        AccesoSoporte.revocado_en.is_(None),
    )
    return list(db.scalars(stmt).all())


def obtener_acceso(db: Session, acceso_id: int) -> AccesoSoporte | None:
    """db.get ya aplica el filtro de taller: uno ajeno devuelve None."""
    return db.get(AccesoSoporte, acceso_id)


def _stmt_actividad() -> Select:
    return select(Auditoria).where(Auditoria.soporte.is_(True))


def listar_actividad(
    db: Session, pagina: ParametrosPagina
) -> list[Auditoria]:
    """Filas de auditoría con soporte=true del taller del contexto."""
    stmt = (
        _stmt_actividad()
        .order_by(Auditoria.creado_en.desc(), Auditoria.id.desc())
    )
    return list(db.scalars(aplicar(stmt, pagina)).all())


def contar_actividad(db: Session) -> int:
    return contar_stmt(db, _stmt_actividad())
