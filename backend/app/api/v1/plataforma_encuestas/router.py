"""Encuestas de fin de demo para el superadmin (docs/Oferta.md, tarea C6).

Dato de la plataforma sobre los talleres: solo el superadmin las lista, con
filtros y paginación (``X-Total-Count`` como el resto de los listados).
"""
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query, Response

from app.api.v1.plataforma_encuestas import service
from app.core.dependencies import DbSession, SuperAdminUser
from app.schemas.encuesta import EncuestaDemoResponse, IntencionEncuesta
from app.schemas.paginacion import PaginaParams

router = APIRouter(prefix="/plataforma", tags=["Plataforma"])


@router.get(
    "/encuestas",
    response_model=list[EncuestaDemoResponse],
    summary="Encuestas de fin de demo de los talleres",
)
def listar_encuestas(
    db: DbSession,
    _: SuperAdminUser,
    pagina: PaginaParams,
    response: Response,
    intencion: IntencionEncuesta | None = None,
    taller_id: int | None = None,
    puntaje_min: Annotated[int | None, Query(ge=1, le=5)] = None,
    desde: date | None = None,
    hasta: date | None = None,
) -> list[EncuestaDemoResponse]:
    items, total = service.listar(
        db,
        pagina,
        intencion=intencion,
        taller_id=taller_id,
        puntaje_min=puntaje_min,
        desde=desde,
        hasta=hasta,
    )
    response.headers["X-Total-Count"] = str(total)
    return items
