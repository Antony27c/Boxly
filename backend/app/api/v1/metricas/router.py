from datetime import date
from typing import Annotated, List, Literal, Optional

from fastapi import APIRouter, Depends, Query

from app.core.dependencies import DbSession, require_roles
from app.models.usuario import RolUsuario, Usuario
from app.schemas.metricas import FinanzasResponse, MecanicoMetricasResponse, MejorMecanicoResponse

from .service import metricas_service

router = APIRouter(prefix="/metricas", tags=["Metricas"])

# Admin y recepción ven el Dashboard; mecánico y cliente no.
GestionUser = Annotated[Usuario, Depends(require_roles(RolUsuario.administrador, RolUsuario.recepcion))]


@router.get("/mecanicos", response_model=List[MecanicoMetricasResponse])
def metricas_mecanicos(
    db: DbSession,
    _: GestionUser,
    desde: Optional[date] = Query(
        default=None, description="Fecha desde (YYYY-MM-DD). Por defecto, 30 días atrás"
    ),
    hasta: Optional[date] = Query(default=None, description="Fecha hasta (YYYY-MM-DD). Por defecto, hoy"),
):
    return metricas_service.metricas_mecanicos(db, desde, hasta)


@router.get("/finanzas", response_model=FinanzasResponse)
def finanzas(
    db: DbSession,
    _: GestionUser,
    desde: Optional[date] = Query(
        default=None,
        description="Fecha desde (YYYY-MM-DD). Por defecto, el primer día de hace 5 meses",
    ),
    hasta: Optional[date] = Query(default=None, description="Fecha hasta (YYYY-MM-DD). Por defecto, hoy"),
    agrupar: Literal["mes", "dia"] = Query(
        default="mes",
        description="Agrupación de ingresos: 'mes' (por defecto) o 'dia' (máximo 92 días de rango)",
    ),
):
    return metricas_service.finanzas(db, desde, hasta, agrupar)


@router.get("/mejor-mecanico", response_model=MejorMecanicoResponse)
def mejor_mecanico(
    db: DbSession,
    _: GestionUser,
    trimestre: Optional[str] = Query(
        default=None,
        pattern=r"^\d{4}-Q[1-4]$",
        description="Formato AAAA-QN, por ejemplo 2026-Q3. Por defecto, el actual",
    ),
):
    return metricas_service.mejor_mecanico(db, trimestre)
