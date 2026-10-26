from fastapi import APIRouter, Depends, Query
from typing import List, Optional
from datetime import datetime

from app.core.dependencies import CurrentUser, DbSession, require_roles
from app.models.usuario import RolUsuario, Usuario
from app.schemas.metricas import MecanicoMetricasResponse
from .service import metricas_service

router = APIRouter(prefix="/metricas", tags=["Metricas"])

AdminUser= Usuario.__class__

@router.ger("/mecanicos", response_model=List[MecanicoMetricasResponse])
def metricas_mecanicos(db:DbSession, _:CurrentUser, desde: Optional[datetime]= Query(default=None, description="Fecha desde (YYYY-MM-DD)"),hasta: Optional[datetime] = Query(default=None, description="Fecha hasta (YYYY-MM-DD)"),):
    return metricas_service.metricas_mecanicos(db, desde, hasta)