from fastapi import APIRouter, Depends, status, UploadFile, File
from typing import List, Optional, Annotated


from app.core.dependencies import PersonalUser,DbSession, filtro_mecanico, require_roles
from app.models.usuario import RolUsuario, Usuario
from app.schemas.orden import HistorialResponse, OrdenCreate, OrdenUpdate, OrdenResponse
from .service import orden_service
from app.schemas.usuario import MessageResponse
from app.schemas.detalle_orden import DetalleOrdenCreate,DetalleOrdenResponse
from app.schemas.imagen_orden import ImagenOrdenResponse


router = APIRouter()
RecepcionUser= Annotated[
    Usuario,
    Depends(require_roles(RolUsuario.administrador, RolUsuario.recepcion)),]


@router.get("", response_model=List[OrdenResponse])
def listar_ordenes(db: DbSession, usuario:PersonalUser, estado: Optional[str] = None,):
    
    return orden_service.obtener_lista_ordenes(db, estado, filtro_mecanico(usuario))

@router.post("", response_model=OrdenResponse, status_code=status.HTTP_201_CREATED)
def crear_orden(datos: OrdenCreate, db: DbSession, usuario:RecepcionUser):
    return orden_service.crear_orden(db, datos, creado_por_id=usuario.id)

@router.get("/{orden_id}", response_model=OrdenResponse)
def detalle_orden(orden_id: int, db: DbSession, usuario:PersonalUser):
   
    return orden_service.obtener_detalle_orden(db, orden_id, filtro_mecanico(usuario))


@router.patch("/{orden_id}", response_model=OrdenResponse)
def editar_orden(orden_id: int, datos: OrdenUpdate, db: DbSession, usuario:PersonalUser):
    orden_service.validar_edicion_mecanico(db, orden_id, datos, filtro_mecanico(usuario))
    return orden_service.editar_orden(db, orden_id, datos, usuario_id=usuario.id)
@router.get("/{orden_id}/historial", response_model=List[HistorialResponse])
def historial_orden(orden_id:int, db:DbSession, usuario: PersonalUser):
    orden_service.obtener_detalle_orden(db, orden_id, filtro_mecanico(usuario))
    return orden_service.obtener_historial_orden(db, orden_id)

@router.delete("/{orden_id}", response_model=MessageResponse)
def eliminar_orden(orden_id: int, db:DbSession,_:RecepcionUser):
    orden = orden_service.eliminar_orden(db, orden_id)
    return MessageResponse(detail=f"Orden {orden.codigo} eliminada")

@router.get("/{orden_id}/detalles", response_model=List[DetalleOrdenResponse])
def listar_detalles(orden_id: int, db: DbSession,usuario:PersonalUser):
    orden_service.obtener_detalle_orden(db, orden_id, filtro_mecanico(usuario))
    return orden_service.listar_detalles(db, orden_id)

@router.post("/{orden_id}/detalles", response_model=DetalleOrdenResponse, status_code=status.HTTP_201_CREATED)
def agregar_detalle(orden_id:int, datos:DetalleOrdenCreate, db:DbSession, usuario:PersonalUser):
    orden_service.obtener_detalle_orden(db, orden_id, filtro_mecanico(usuario))
    return orden_service.agregar_detalle(db, orden_id, datos, usuario_id=usuario.id)

@router.delete("/{orden_id}/detalles/{detalle_id}", response_model=MessageResponse)
def quitar_detalle(orden_id: int, detalle_id:int, db:DbSession, usuario: PersonalUser):
    orden_service.obtener_detalle_orden(db, orden_id, filtro_mecanico(usuario))
    orden_service.quitar_detalle(db, orden_id, detalle_id, usuario_id=usuario.id)
    return MessageResponse(detail="Linea eliminada")
@router.get("/{orden_id}/imagenes", response_model=List[ImagenOrdenResponse])
def listar_imagenes(orden_id: int, db:DbSession, _: CurrentUser):
    return orden_service.listar_imagenes(db, orden_id)

@router.post("/{orden_id}/imagenes", response_model=ImagenOrdenResponse, status_code=status.HTTP_201_CREATED)
def agregar_imagen(
    orden_id:int,
    db:DbSession,
    _:CurrentUser,
    archivo: UploadFile = File(...),
):
    return orden_service.agregar_imagen(db, orden_id, archivo)
@router.delete("/{orden_id}/imagenes/{imagen_id}", response_model=MessageResponse)
def eliminar_imagen(orden_id: int, imagen_id: int, db:DbSession,_: CurrentUser):
    orden_service.eliminar_imagen(db, orden_id, imagen_id)
    return MessageResponse(detail="Imagen eliminada")
