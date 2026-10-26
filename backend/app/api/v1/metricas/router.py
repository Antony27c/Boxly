from fastapi import APIRouter, Depends, Query
from typing import List, Optional
from datetime import datetime

from typing import Annotated

from app.core.dependencies import DbSession, require_roles
from app.models.usuario import RolUsuario, Usuario
from app.schemas.metricas import MecanicoMetricasResponse, BalanceMensualResponse, MejorMecanicoResponse
from .service import metricas_service

router = APIRouter(prefix="/metricas", tags=["Metricas"])

AdminUser = Annotated[Usuario, Depends(require_roles(RolUsuario.administrador))]

@router.get("/mecanicos", response_model=List[MecanicoMetricasResponse])
def metricas_mecanicos(db:DbSession, _:AdminUser, desde: Optional[datetime]= Query(default=None, description="Fecha desde (YYYY-MM-DD)"),hasta: Optional[datetime] = Query(default=None, description="Fecha hasta (YYYY-MM-DD)"),):
    return metricas_service.metricas_mecanicos(db, desde, hasta)
@router.get("/finanzas", response_model=List[BalanceMensualResponse])
def balance_financiero(
    db: DbSession,
    _: AdminUser,
    desde: Optional[datetime] = Query(default=None, description="Fecha desde (YYYY-MM-DD)"),
    hasta: Optional[datetime] = Query(default=None, description="Fecha hasta (YYYY-MM-DD)"),
):
    return metricas_service.balance_financiero(db, desde, hasta)
 
 
@router.get("/mejor-mecanico", response_model=MejorMecanicoResponse)
def mejor_mecanico(
    db: DbSession,
    _: AdminUser,
    trimestre: str = Query(..., description="Trimestre formato: 2024-Q1, 2024-Q2, etc."),
):
    return metricas_service.mejor_mecanico_trimestre(db, trimestre)