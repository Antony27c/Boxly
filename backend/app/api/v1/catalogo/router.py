from fastapi import APIRouter, Query
from typing import List, Optional

from app.core.dependencies import CurrentUser, DbSession
from app.schemas.catalogo import MarcaResponse, ModeloResponse
from .service import catalogo_service

router = APIRouter(prefix="/catalogo", tags=["Catalogo"])

@router.get("/marcas", response_model=List[MarcaResponse])
def listar_marcas(db:DbSession, _:CurrentUser, q:Optional[str] = Query(default=None, description="Busqueda parcial por nombre"),
):
    return catalogo_service.listar_marcas(db, q)

@router.get("/modelos", response_model=List[ModeloResponse])
def listar_modelos(
    db:DbSession,
    _:CurrentUser,
    marca_id: Optional[int] = Query(default=None, description="Filtrar por marca"),
    q: Optional[str] = Query(default=None, description="Busqueda parcial por nombre"),
):
    return catalogo_service.listar_modelos(db, marca_id, q)
