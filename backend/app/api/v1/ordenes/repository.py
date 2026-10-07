from sqlalchemy.orm import Session
from sqlalchemy import func, select
from typing import List, Optional

from app.models.orden import Historial_estado, Orden

class OrdenRepository:
    
    def obtener_ordenes(self, db: Session, estado: Optional[str] = None) -> List[Orden]:
        query = select(Orden).order_by(Orden.fecha_ingreso.desc())
        if estado:
            query = query.where(Orden.estado == estado)
        return list(db.scalars(query).all())

    def obtener_por_id(self, db: Session, orden_id: int) -> Optional[Orden]:
        return db.get(Orden, orden_id)

    def siguiente_codigo(self, db:Session) -> str:
        ultimo_id = db.scalar(select(func.max(Orden.id))) or 0
        return f"OT-{1000 + ultimo_id + 1}"

    def crear(self, db:Session, orden:Orden) -> Orden:
        db.add(orden)
        db.commit()
        db.refresh(orden)
        return orden

    def guardar_historial(self, db: Session,*, orden_id: int, usuario_id:int, estado_anterior: Optional[str], estado_nuevo: str, comentario:Optional[str]=None) -> Historial_estado:

        historial = Historial_estado(
            orden_id=orden_id,
            usuario_id=usuario_id,
            estado_anterior=estado_anterior,
            estado_nuevo=estado_nuevo,
            comentario=comentario,
        )
        db.add(historial)
        
        return historial

    def guardar_cambios(self, db: Session, orden: Orden) -> Orden:
        db.add(orden)
        db.commit()
        db.refresh(orden)
        return orden

orden_repository = OrdenRepository()