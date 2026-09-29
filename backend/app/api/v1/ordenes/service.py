from sqlalchemy.orm import Session
from fastapi import HTTPException
from typing import Optional, List


from app.schemas.orden import OrdenUpdate
from app.models.orden import Orden
from .repository import orden_repository 

TRANSICIONES_VALIDAS = {
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

    def editar_orden(self, db: Session, orden_id: int, datos_update: OrdenUpdate) -> Orden:
       
        orden = self.obtener_detalle_orden(db, orden_id)

       
        if datos_update.estado and datos_update.estado != orden.estado:
            estados_permitidos = TRANSICIONES_VALIDAS.get(orden.estado, [])

            if datos_update.estado not in estados_permitidos:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Transición inválida. No se puede pasar de '{orden.estado}' a '{datos_update.estado}'"
                )
            if not datos_update.usuario_id_accion:
                raise HTTPException(status_code=400, detail="Se requiere usuario_id_accion para cambiar el estado")
          
            orden_repository.guardar_historial(
                db=db, 
                orden_id=orden.id, 
                usuario_id=datos_update.usuario_id_accion,
                estado_anterior=orden.estado, 
                estado_nuevo=datos_update.estado,
                comentario=datos_update.comentario_cambio

            )
            orden.estado = datos_update.estado

       
        if datos_update.mecanico_id is not None:
            
            orden.mecanico_id = datos_update.mecanico_id

       
        if datos_update.descripcion is not None:
            orden.descripcion = datos_update.descripcion

        if datos_update.diagnostico is not None:
            orden.diagnostico = datos_update.diagnostico

        return orden_repository.guardar_cambios(db, orden)
orden_service = OrdenService()