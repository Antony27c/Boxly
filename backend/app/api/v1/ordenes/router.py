from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List, Optional


from app.core.dependencies import get_db 

from app.schemas.orden import OrdenUpdate, OrdenResponse
from .service import orden_service


router = APIRouter()

@router.get("/", response_model=List[OrdenResponse])
def listar_ordenes(estado: Optional[str] = None, db: Session = Depends(get_db)):
    
    return orden_service.obtener_lista_ordenes(db, estado)


@router.get("/{orden_id}", response_model=OrdenResponse)
def detalle_orden(orden_id: int, db: Session = Depends(get_db)):
   
    return orden_service.obtener_detalle_orden(db, orden_id)


@router.patch("/{orden_id}", response_model=OrdenResponse)
def editar_orden(orden_id: int, datos_update: OrdenUpdate, db: Session = Depends(get_db)):

    return orden_service.editar_orden(db, orden_id, datos_update)