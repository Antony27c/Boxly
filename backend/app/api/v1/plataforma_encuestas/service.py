"""Listado de encuestas de fin de demo para el superadmin (docs/Oferta.md, C6).

Es dato de la plataforma sobre cada taller: se consulta en contexto plataforma
(sin filtro automático) y cada fila trae el nombre del taller y de quien
respondió. Nunca toca datos de clientes del taller.
"""
from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.suscripcion import ZONA_ARGENTINA
from app.models import EncuestaDemo, Taller, Usuario
from app.schemas.encuesta import EncuestaDemoResponse, IntencionEncuesta
from app.schemas.paginacion import ParametrosPagina, aplicar, contar


def _inicio_del_dia(dia: date) -> datetime:
    """Instante UTC en que empieza ``dia`` en Argentina (00:00 ART = 03:00 UTC)."""
    return datetime.combine(dia, time.min, tzinfo=ZONA_ARGENTINA).astimezone(timezone.utc)


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

    ``desde``/``hasta`` son días argentinos, ambos inclusive: ``creado_en`` se
    guarda en UTC (app/db/tipos.py), así que se compara contra el intervalo
    ``[00:00 ART de desde, 00:00 ART del día siguiente a hasta)`` pasado a UTC.
    Comparar la columna directo (sin ``func.date``) no depende del día UTC ni de
    la TimeZone de la sesión de Postgres."""
    stmt = select(EncuestaDemo).order_by(EncuestaDemo.id.desc())
    if intencion is not None:
        stmt = stmt.where(EncuestaDemo.intencion == intencion)
    if taller_id is not None:
        stmt = stmt.where(EncuestaDemo.taller_id == taller_id)
    if puntaje_min is not None:
        stmt = stmt.where(EncuestaDemo.puntaje >= puntaje_min)
    if desde is not None:
        stmt = stmt.where(EncuestaDemo.creado_en >= _inicio_del_dia(desde))
    if hasta is not None:
        stmt = stmt.where(
            EncuestaDemo.creado_en < _inicio_del_dia(hasta + timedelta(days=1))
        )

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
