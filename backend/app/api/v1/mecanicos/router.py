from fastapi import APIRouter, Depends, Query, status
from typing import Optional
from datetime import date
 
from app.core.dependencies import DbSession, require_roles
from app.models.usuario import RolUsuario, Usuario
from app.schemas.horario_mecanico import (
    HorarioMecanicoCreate,
    HorarioMecanicoUpdate,
    HorarioMecanicoResponse,
)
from .service import mecanicos_service
 
router = APIRouter(prefix="/mecanicos", tags=["Mecánicos"])
 
AdminUser = Usuario.__class__
 
 
@router.get("/{mecanico_id}/horarios", response_model=list[HorarioMecanicoResponse])
def listar_horarios(mecanico_id: int, db: DbSession, usuario: Usuario):
    return mecanicos_service.listar_horarios(db, mecanico_id, usuario)
 
 
@router.post("/{mecanico_id}/horarios", response_model=HorarioMecanicoResponse, status_code=status.HTTP_201_CREATED)
def crear_horario(
    mecanico_id: int,
    datos: HorarioMecanicoCreate,
    db: DbSession,
    _: AdminUser,
):
    return mecanicos_service.crear_horario(db, mecanico_id, datos)
 
 
@router.put("/horarios/{horario_id}", response_model=HorarioMecanicoResponse)
def actualizar_horario(
    horario_id: int,
    datos: HorarioMecanicoUpdate,
    db: DbSession,
    _: AdminUser,
):
    return mecanicos_service.actualizar_horario(db, horario_id, datos)
 
 
@router.delete("/horarios/{horario_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_horario(horario_id: int, db: DbSession, _: AdminUser):
    mecanicos_service.eliminar_horario(db, horario_id)
 
 
@router.get("/{mecanico_id}/calendario")
def calendario(
    mecanico_id: int,
    db: DbSession,
    usuario: Usuario,
    desde: Optional[date] = Query(default=None, description="YYYY-MM-DD"),
    hasta: Optional[date] = Query(default=None, description="YYYY-MM-DD"),
):
    return mecanicos_service.calendario(db, mecanico_id, usuario, desde, hasta)