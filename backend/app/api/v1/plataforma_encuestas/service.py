"""Listado de encuestas de fin de demo para el superadmin (docs/Oferta.md, C6).

Es dato de la plataforma sobre cada taller: se consulta en contexto plataforma
(sin filtro automático) y cada fila trae el nombre del taller y de quien
respondió. Nunca toca datos de clientes del taller.
"""
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import EncuestaDemo, Taller, Usuario
from app.schemas.encuesta import EncuestaDemoResponse, IntencionEncuesta
from app.schemas.paginacion import ParametrosPagina, aplicar, contar


def listar(
    db: Session,
    pagina: ParametrosPagina,
    *,
    intencion: IntencionEncuesta | None = None,
    taller_id: int | None = None,
    puntaje_min: int | None = None,
    desde: date | None = None,
    hasta: date | None = None,
) -> tuple[list[EncuestaDemoResponse], int]:
    """Encuestas filtradas y paginadas, más nuevas primero, con ``X-Total-Count``.

    ``desde``/``hasta`` filtran por el día UTC de ``creado_en`` (las fechas se
    guardan en UTC, ver app/db/tipos.py)."""
    stmt = select(EncuestaDemo).order_by(EncuestaDemo.id.desc())
    if intencion is not None:
        stmt = stmt.where(EncuestaDemo.intencion == intencion)
    if taller_id is not None:
        stmt = stmt.where(EncuestaDemo.taller_id == taller_id)
    if puntaje_min is not None:
        stmt = stmt.where(EncuestaDemo.puntaje >= puntaje_min)
    if desde is not None:
        stmt = stmt.where(func.date(EncuestaDemo.creado_en) >= desde)
    if hasta is not None:
        stmt = stmt.where(func.date(EncuestaDemo.creado_en) <= hasta)

    total = contar(db, stmt)
    encuestas = list(db.scalars(aplicar(stmt, pagina)))

    # Nombres para la respuesta: una consulta por tabla, no un join por fila.
    taller_ids = {e.taller_id for e in encuestas}
    nombres_taller = (
        {
            t.id: t.nombre
            for t in db.scalars(select(Taller).where(Taller.id.in_(taller_ids)))
        }
        if taller_ids
        else {}
    )
    user_ids = {e.respondida_por_id for e in encuestas if e.respondida_por_id}
    nombres_usuario = (
        {
            u.id: f"{u.nombre} {u.apellido}".strip()
            for u in db.scalars(select(Usuario).where(Usuario.id.in_(user_ids)))
        }
        if user_ids
        else {}
    )

    items = []
    for e in encuestas:
        respuesta = EncuestaDemoResponse.model_validate(e)
        respuesta.taller_nombre = nombres_taller.get(e.taller_id)
        respuesta.respondida_por = (
            nombres_usuario.get(e.respondida_por_id)
            if e.respondida_por_id
            else None
        )
        items.append(respuesta)
    return items, total
