from typing import Annotated, List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, UploadFile, status

from app.core.dependencies import CurrentUser, DbSession, PersonalUser, filtro_mecanico, require_roles
from app.models.usuario import RolUsuario, Usuario
from app.schemas.detalle_orden import DetalleOrdenCreate, DetalleOrdenResponse, DetallePrecioUpdate
from app.schemas.imagen_orden import ImagenOrdenResponse
from app.schemas.orden import (
    CobroRequest,
    EstadoOrdenResponse,
    HistorialResponse,
    NotificacionResponse,
    OrdenCreate,
    OrdenResponse,
    OrdenUpdate,
    PagoLocalRequest,
)
from app.schemas.usuario import MessageResponse

from .service import orden_service

router = APIRouter()
RecepcionUser= Annotated[
    Usuario,
    Depends(require_roles(RolUsuario.administrador, RolUsuario.recepcion)),]
AdminUser = Annotated[Usuario, Depends(require_roles(RolUsuario.administrador))]


@router.get("", response_model=List[OrdenResponse])
def listar_ordenes(db: DbSession, usuario:PersonalUser, estado: Optional[str] = None,):
    
    return orden_service.obtener_lista_ordenes(db, estado, filtro_mecanico(usuario))

@router.post("", response_model=OrdenResponse, status_code=status.HTTP_201_CREATED)
def crear_orden(datos: OrdenCreate, db: DbSession, usuario:RecepcionUser):
    return orden_service.crear_orden(db, datos, creado_por_id=usuario.id)

@router.get("/estados", response_model=List[EstadoOrdenResponse])
def listar_estados(_: CurrentUser):
    return orden_service.listar_estados()

@router.get("/{orden_id}", response_model=OrdenResponse)
def detalle_orden(orden_id: int, db: DbSession, usuario:PersonalUser):
   
    return orden_service.obtener_detalle_orden(db, orden_id, filtro_mecanico(usuario))


@router.patch("/{orden_id}", response_model=OrdenResponse)
def editar_orden(
    orden_id: int, datos: OrdenUpdate, db: DbSession, usuario: PersonalUser,
    background_tasks: BackgroundTasks,
):
    orden_service.validar_edicion_mecanico(db, orden_id, datos, filtro_mecanico(usuario))
    return orden_service.editar_orden(
        db, orden_id, datos, usuario_id=usuario.id, background_tasks=background_tasks
    )


@router.post("/{orden_id}/cobro", response_model=OrdenResponse)
def emitir_cobro(
    orden_id: int, datos: CobroRequest, db: DbSession, usuario: PersonalUser,
    background_tasks: BackgroundTasks,
):
    return orden_service.emitir_cobro(db, orden_id, datos.monto, usuario, background_tasks)


@router.post("/{orden_id}/cobro/aprobar", response_model=OrdenResponse)
def aprobar_cobro(
    orden_id: int, datos: CobroRequest, db: DbSession, usuario: RecepcionUser,
    background_tasks: BackgroundTasks,
):
    return orden_service.aprobar_cobro(db, orden_id, datos.monto, usuario.id, background_tasks)


@router.post("/{orden_id}/cobro/anular", response_model=OrdenResponse)
def anular_cobro(orden_id: int, db: DbSession, usuario: RecepcionUser):
    return orden_service.anular_cobro(db, orden_id, usuario)


@router.post("/{orden_id}/pago-local", response_model=OrdenResponse)
def registrar_pago_local(orden_id: int, datos: PagoLocalRequest, db: DbSession, _: RecepcionUser):
    return orden_service.registrar_pago_local(db, orden_id, datos)


@router.get("/{orden_id}/historial", response_model=List[HistorialResponse])
def historial_orden(orden_id:int, db:DbSession, usuario: PersonalUser):
    orden_service.obtener_detalle_orden(db, orden_id, filtro_mecanico(usuario))
    return orden_service.obtener_historial_orden(db, orden_id)

@router.get("/{orden_id}/notificaciones", response_model=List[NotificacionResponse])
def listar_notificaciones(orden_id: int, db: DbSession, usuario: PersonalUser):
    orden_service.obtener_detalle_orden(db, orden_id, filtro_mecanico(usuario))
    return orden_service.listar_notificaciones(db, orden_id)


@router.post(
    "/{orden_id}/notificaciones",
    response_model=NotificacionResponse,
    status_code=status.HTTP_201_CREATED,
)
def reenviar_aviso(orden_id: int, db: DbSession, usuario: AdminUser):
    return orden_service.reenviar_aviso(db, orden_id, usuario.id)


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
    return orden_service.agregar_detalle(db, orden_id, datos, usuario=usuario)

@router.patch("/{orden_id}/detalles/{detalle_id}", response_model=DetalleOrdenResponse)
def cotizar_detalle(
    orden_id: int, detalle_id: int, datos: DetallePrecioUpdate,
    db: DbSession, usuario: RecepcionUser,
):
    # Solo administración y recepción: sin filtro de mecánico. El service ya
    # busca la orden (404 si no es del taller).
    return orden_service.cotizar_detalle(db, orden_id, detalle_id, datos, usuario_id=usuario.id)

@router.delete("/{orden_id}/detalles/{detalle_id}", response_model=MessageResponse)
def quitar_detalle(orden_id: int, detalle_id:int, db:DbSession, usuario: PersonalUser):
    orden_service.obtener_detalle_orden(db, orden_id, filtro_mecanico(usuario))
    orden_service.quitar_detalle(db, orden_id, detalle_id, usuario_id=usuario.id)
    return MessageResponse(detail="Linea eliminada")
@router.get("/{orden_id}/imagenes", response_model=List[ImagenOrdenResponse])
def listar_imagenes(orden_id: int, db:DbSession, usuario: PersonalUser):
    orden_service.obtener_detalle_orden(db, orden_id, filtro_mecanico(usuario))
    return orden_service.listar_imagenes(db, orden_id)

@router.post("/{orden_id}/imagenes", response_model=ImagenOrdenResponse, status_code=status.HTTP_201_CREATED)
def agregar_imagen(
    orden_id:int,
    db:DbSession,
    usuario: PersonalUser,
    archivo: UploadFile = File(...),
    etapa: Optional[str] = Form(default=None),
):
    orden_service.obtener_detalle_orden(db, orden_id, filtro_mecanico(usuario))
    return orden_service.agregar_imagen(db, orden_id, archivo, etapa, usuario_id=usuario.id)
@router.delete("/{orden_id}/imagenes/{imagen_id}", response_model=MessageResponse)
def eliminar_imagen(orden_id: int, imagen_id: int, db:DbSession, usuario: PersonalUser):
    orden_service.obtener_detalle_orden(db, orden_id, filtro_mecanico(usuario))
    orden_service.eliminar_imagen(db, orden_id, imagen_id, usuario)
    return MessageResponse(detail="Imagen eliminada")
