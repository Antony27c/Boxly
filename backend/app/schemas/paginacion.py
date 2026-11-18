"""Paginación de listados compatible con el frontend actual.

Los endpoints siguen devolviendo un array JSON igual que antes; la paginación
es opt-in con ``?limit=&offset=`` y el total filtrado viaja en el header
``X-Total-Count`` (que el frontend puede empezar a usar cuando quiera).
"""

from typing import Annotated

from fastapi import Depends, Query
from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session


class ParametrosPagina:
    """Query params opcionales de paginación: ``?limit=1..200`` y ``?offset>=0``."""

    def __init__(
        self,
        limit: Annotated[int | None, Query(ge=1, le=200)] = None,
        offset: Annotated[int, Query(ge=0)] = 0,
    ) -> None:
        self.limit = limit
        self.offset = offset


# Uso en el endpoint: ``pagina: PaginaParams`` (sin default, lo resuelve Depends).
PaginaParams = Annotated[ParametrosPagina, Depends(ParametrosPagina)]


def aplicar(stmt: Select, pagina: ParametrosPagina) -> Select:
    """Aplica limit/offset sobre un SELECT ya filtrado y ordenado."""
    if pagina.limit is not None:
        stmt = stmt.limit(pagina.limit)
    if pagina.offset:
        stmt = stmt.offset(pagina.offset)
    return stmt


def contar(db: Session, stmt: Select) -> int:
    """COUNT(*) del SELECT filtrado (sin ORDER BY ni paginación)."""
    subquery = stmt.subquery()
    return db.scalar(select(func.count()).select_from(subquery)) or 0
