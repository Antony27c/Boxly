from sqlalchemy.orm import Session
from fastapi import HTTPException

from typing import List, Optional
from datetime import datetime, timezone

from app.schemas.orden import ESTADOS_ORDEN, OrdenCreate, OrdenUpdate
from app.models.orden import Orden
from app.models.usuario import RolUsuario, Usuario
from app.models.vehiculo import Vehiculo
from .repository import orden_repository 

TRANSICIONES_VALIDAS = {
    "pendiente":["ingresado","cancelado"],
    "ingresado": ["en_diagnostico", "cancelado"],
    "en_diagnostico": ["esperando_repuestos", "listo", "cancelado"],
    "esperando_repuesto": ["listo", "cancelado"],
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
          
            orden_repository.guardar_historial(
                db, 
                orden_id=orden.id, 
                usuario_id=usuario_id,
                estado_anterior=orden.estado, 
                estado_nuevo=datos.estado,
                comentario=datos.comentario_cambio

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
       
orden_service = OrdenService()