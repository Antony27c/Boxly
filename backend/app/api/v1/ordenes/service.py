from sqlalchemy.orm import Session
from fastapi import HTTPException

from typing import List, Optional
from datetime import datetime, timezone

from app.schemas.orden import ESTADOS_ORDEN, HistorialResponse, OrdenCreate, OrdenUpdate
from app.models.orden import Orden
from app.models.usuario import RolUsuario, Usuario
from app.models.vehiculo import Vehiculo
from app.models.detalle_orden import DetalleOrden
from app.models.repuesto import Repuesto
from app.schemas.detalle_orden import DetalleOrdenCreate, DetalleOrdenResponse
from .repository import orden_repository 
from app.models.imagen_orden import ImagenOrden
from app.schemas.imagen_orden import ImagenOrdenResponse

TRANSICIONES_VALIDAS = {
    "pendiente":["ingresado","cancelado"],
    "ingresado": ["en_diagnostico", "cancelado"],
    "en_diagnostico": ["esperando_repuestos", "listo", "cancelado"],
    "esperando_repuestos": ["listo", "cancelado"],
    "listo": ["entregado"],
    "entregado": [],
    "cancelado": []
}

class OrdenService:
    
    def obtener_lista_ordenes(self, db: Session, estado: Optional[str] = None) -> List[Orden]:
        
        return orden_repository.obtener_ordenes(db, estado)

    def obtener_detalle_orden(self, db: Session, orden_id: int) -> Orden:
        orden = orden_repository.obtener_por_id(db, orden_id)
        if not orden:
            
            raise HTTPException(status_code=404, detail="Orden no encontrada")
        return orden

    def _validar_mecanico(self, db:Session, mecanico_id: int)-> None:
        mecanico = db.get(Usuario, mecanico_id)
        if mecanico is None:
            raise HTTPException(status_code=404, detail="El mecanico asignado no existe")
        if mecanico.rol != RolUsuario.mecanico or not mecanico.activo:
            raise HTTPException(status_code=400, detail="El usuario asignado no es un mecanico activo",
            )

    def crear_orden(self, db:Session, datos:OrdenCreate, creado_por_id:int)-> Orden:
        vehiculo = db.get(Vehiculo, datos.vehiculo_id)
        if vehiculo is None:
            raise HTTPException(status_code=404, detail= "vehiculo no encontrado")
        if datos.mecanico_id is not None:
            self._validar_mecanico(db, datos.mecanico_id)

        orden =Orden(
            cliente_id = vehiculo.cliente_id,
            vehiculo_id=vehiculo.id,
            creado_por_id=creado_por_id,
            mecanico_id=datos.mecanico_id,
            codigo=orden_repository.siguiente_codigo(db),
            estado="pendiente",
            descripcion_ingreso=datos.descripcion_ingreso,
            costo_estimado=datos.costo_estimado,
            fecha_estimada_entrega= datos.fecha_estimada_entrega,
        )
        db.add(orden)
        db.flush()
        orden_repository.guardar_historial(
            db,
            orden_id=orden.id,
            usuario_id=creado_por_id,
            estado_anterior= None,
            estado_nuevo="pendiente",
            comentario="Orden creada",
        )
        return orden_repository.guardar_cambios(db, orden)
    
    def editar_orden(self, db: Session, orden_id: int, datos: OrdenUpdate, usuario_id: int) -> Orden:
       
        orden = self.obtener_detalle_orden(db, orden_id)

        if datos.mecanico_id is not None:
            self._validar_mecanico(db,datos.mecanico_id)
       
        if datos.estado and datos.estado != orden.estado:
            if datos.estado not in ESTADOS_ORDEN:
                raise HTTPException(
                    status_code=422, 
                    detail=f"Estado desconocido: '{datos.estado}'"
                )
            estados_permitidos = TRANSICIONES_VALIDAS.get(orden.estado, [])

            if datos.estado not in estados_permitidos:
                raise HTTPException(status_code=400, detail=(f"Transicion invalida. No se puede pasar de "f"'{orden.estado}' a '{datos.estado}' "))

            if not datos.comentario_cambio or not datos.comentario_cambio.strip():
                raise HTTPException(
                    status_code=422,
                    detail= "El comentario es obligatorio al cambiar de estado",
                )
            descripcion_estado = ESTADOS_ORDEN[datos.estado]
            comentario_final = f"{descripcion_estado}. {datos.comentario_cambio}"
            orden_repository.guardar_historial(
                db, 
                orden_id=orden.id, 
                usuario_id=usuario_id,
                estado_anterior=orden.estado, 
                estado_nuevo=datos.estado,
                comentario=comentario_final

            )
            orden.estado = datos.estado
            if datos.estado == "entregado" and orden.fecha_entrega is None:
                orden.fecha_entrega= datetime.now(timezone.utc)
        for campo in (
            "mecanico_id",
            "descripcion_ingreso",
            "diagnostico",
            "costo_estimado",
            "costo_final",
            "fecha_estimada_entrega",
            "fecha_entrega",
        ):
            valor= getattr(datos, campo)
            if valor is not None:
                setattr(orden, campo, valor)
        return orden_repository.guardar_cambios(db, orden)

    def obtener_historial_orden(self, db:Session, orden_id: int) -> List[HistorialResponse]:
        self.obtener_detalle_orden(db, orden_id)
        respuesta = []
        for item in orden_repository.obtener_historial(db,orden_id):
            fila = HistorialResponse.model_validate(item)
            if item.usuario:
                fila.usuario_nombre = f"{item.usuario.apellido}, {item.usuario.nombre}"
            respuesta.append(fila)
        return respuesta

    def eliminar_orden(self, db:Session, orden_id:int) -> Orden:
        orden = self.obtener_detalle_orden(db, orden_id)
        if orden.estado != "pendiente":
            raise HTTPException(
                status_code=400,
                detail="Solo se pueden eliminar órdenes pendientes. Para las demás, pasala a 'cancelado'.",
            )
        orden_repository.eliminar(db, orden)
        return orden

    def _validar_orden_editable(self, orden: Orden) -> None:
        if orden.estado in ("entregado", "cancelado"):
            raise HTTPException(
                status_code=400, 
                detail="No se puede modificar lineas de una orden cerrada",
            )
    def _a_response_detalle(self, detalle:DetalleOrden) -> DetalleOrdenResponse:
        item= DetalleOrdenResponse.model_validate(detalle)
        item.subtotal=detalle.cantidad * detalle.precio_unitario
        if detalle.repuesto:
            item.repuesto_nombre = detalle.repuesto.nombre
        return item
    def listar_detalles(self, db:Session, orden_id:int) -> List[DetalleOrdenResponse]:
        self.obtener_detalle_orden(db, orden_id)
        return [
            self._a_response_detalle(d)
            for d in orden_repository.listar_detalles(db, orden_id)
        ]
    def agregar_detalle(self, db:Session, orden_id:int, datos: DetalleOrdenCreate, usuario_id:int) -> DetalleOrdenResponse:
        orden= self.obtener_detalle_orden(db, orden_id)
        self._validar_orden_editable(orden)

        repuesto= None
        if datos.repuesto_id is not None:
            repuesto = db.get(Repuesto, datos.repuesto_id)
            if repuesto is None or not repuesto.activo:
                raise HTTPException(status_code=404, detail="Repuesto no encontrado o inactivo")
            if repuesto.stock < datos.cantidad:
                raise HTTPException(status_code=409, detail=f"Stock insuficiente: quedan {repuesto.stock} de {repuesto.nombre}")
        descripcion = datos.descripcion or (repuesto.nombre if repuesto else None)
        if not descripcion:
            raise HTTPException(status_code=422, detail="Las lineas de mano de obra necesitan descripcion",)
        precio = datos.precio_unitario if datos.precio_unitario is not None else (repuesto.precio if repuesto else None)
        if precio is None:
            raise HTTPException(status_code=422, detail="las lineas de mano de obra necesitan precio unitario",)
        if repuesto is not None:
            repuesto.stock -= datos.cantidad
            db.add(repuesto)
        detalle = DetalleOrden(
            orden_id=orden.id,
            repuesto_id=datos.repuesto_id,
            descripcion= descripcion,
            cantidad= datos.cantidad,
            precio_unitario=precio,
        )
        orden_repository.guardar_historial(
            db,
            orden_id=orden.id,
            usuario_id= usuario_id,
            estado_anterior=orden.estado,
            estado_nuevo=orden.estado,
            comentario=f"Linea agregada:{datos.cantidad} x {descripcion}",
        )   
        return self._a_response_detalle(orden_repository.guardar_detalle(db,detalle))
    def quitar_detalle( self, db:Session, orden_id: int, detalle_id:int, usuario_id:int) -> None:
        orden= self.obtener_detalle_orden(db, orden_id)
        self._validar_orden_editable(orden)

        detalle = orden_repository.obtener_detalle(db, orden_id, detalle_id)
        if detalle is None:
            raise HTTPException(status_code=404, detail="Linea no encontrada en esta Orden")
        if detalle.repuesto_id is not None: 
            repuesto = db.get(Repuesto, detalle.repuesto_id)
            if repuesto is not None:
                repuesto.stock += detalle.cantidad
                db.add(repuesto)
        orden_repository.guardar_historial(
            db,
            orden_id=orden.id,
            usuario_id=usuario_id,
            estado_anterior=orden.estado,
            estado_nuevo=orden.estado,
            comentario=f"Linea quitada: {detalle.cantidad} x {detalle.descripcion}",
        )
        orden_repository.eliminar_detalle(db, detalle)
    def listar_imagenes(self, db:Session, orden_id: int) -> List[ImagenOrden]:
        self.obtener_detalle_orden(db, orden_id)
        return [
            ImagenOrdenResponse.model_validate(img)
            for img in orden_repository.listar_imagen(db, orden_id)
        ]
    def agregar_imagen(self, db: Session, orden_id:int, url: str) -> ImagenOrdenResponse:
        self.obtener_detalle_orden(db, orden_id)
        imagen= ImagenOrden(orden_id=orden_id, url=url)
        return ImagenOrdenResponse.model_validate(orden_repository.guardar_imagen(db, imagen))
    def eliminar_imagen(self, db:Session, orden_id:int, imagen_id: int)-> None:
        self.obtener_detalle_orden(db, orden_id)
        imagen= orden_repository.obtener_imagen(db, imagen_id)
        if imagen is None:
            raise HTTPException(status_code=404, detail="Imagen no encontrada")
        if imagen.orden_id != orden_id:
            raise HTTPException(status_code=404, detail="Imagen no pertenece a esta orden")
        orden_repository.eliminar_imagen(db, imagen)
orden_service = OrdenService()