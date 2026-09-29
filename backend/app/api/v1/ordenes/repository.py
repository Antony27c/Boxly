from sqlalchemy.orm import Session
from sqlalchemy import select
from typing import Optional, List

from app.models.orden import Orden, Historial_estado

class OrdenRepository:
    
    def obtener_ordenes(self, db: Session, estado: Optional[str] = None) -> List[Orden]:
        query = select(Orden)
        if estado:
            query = query.where(Orden.estado == estado)
        resultado = db.execute(query)
        return resultado.scalars().all()

    def obtener_por_id(self, db: Session, orden_id: int) -> Optional[Orden]:
        return db.get(Orden, orden_id)

    def guardar_historial(self, db: Session, orden_id: int, usuario_id:int, estado_anterior: str, estado_nuevo: str, comentario:Optional[str]=None):
        historial = Historial_estado(
            orden_id=orden_id,
            usuario_id=usuario_id,
            estado_anterior=estado_anterior,
            estado_nuevo=estado_nuevo,
            comentario=comentario
        )
        db.add(historial)
        
        return historial

    def guardar_cambios(self, db: Session, orden: Orden) -> Orden:
        db.add(orden)
        db.commit()
        db.refresh(orden)
        return orden

orden_repository = OrdenRepository()