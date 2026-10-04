from fastapi import APIRouter, Depends, status
from typing import List, Optional, Annotated


from app.core.dependencies import CurrentUser,DbSession, require_roles
from app.models.usuario import RolUsuario, Usuario
from app.schemas.orden import OrdenCreate, OrdenUpdate, OrdenResponse
from .service import orden_service


router = APIRouter()
RecepcionUser= Annotated[
    Usuario,
    Depends(require_roles(RolUsuario.administrador, RolUsuario.recepcion)),]


@router.get("", response_model=List[OrdenResponse])
def listar_ordenes(db: DbSession, _:CurrentUser, estado: Optional[str] = None,):
    
    return orden_service.obtener_lista_ordenes(db, estado)

@router.post("", response_model=OrdenResponse, status_code=status.HTTP_201_CREATED)
def crear_orden(datos: OrdenCreate, db: DbSession, usuario:RecepcionUser):
    return orden_service.crear_orden(db, datos, creado_por_id=usuario.id)

@router.get("/{orden_id}", response_model=OrdenResponse)
def detalle_orden(orden_id: int, db: DbSession, _:CurrentUser):
   
    return orden_service.obtener_detalle_orden(db, orden_id)


@router.patch("/{orden_id}", response_model=OrdenResponse)
def editar_orden(orden_id: int, datos: OrdenUpdate, db: DbSession, usuario:CurrentUser):

    return orden_service.editar_orden(db, orden_id, datos, usuario_id=usuario.id)