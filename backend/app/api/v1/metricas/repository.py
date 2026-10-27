from datetime import datetime
from typing import List

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.detalle_orden import DetalleOrden
from app.models.orden import Orden
from app.models.pago import Pago
from app.models.usuario import RolUsuario, Usuario

CERRADOS = ("entregado", "cancelado")


class MetricasRepository:
    def mecanicos_activos(self, db: Session) -> List[Usuario]:
        stmt = (
            select(Usuario)
            .where(Usuario.rol == RolUsuario.mecanico, Usuario.activo.is_(True))
            .order_by(Usuario.apellido, Usuario.nombre)
        )
        return list(db.scalars(stmt).all())

    def ordenes_cerradas(self, db: Session, desde: datetime, hasta: datetime) -> List[Orden]:
        stmt = select(Orden).where(
            Orden.estado == "entregado",
            Orden.fecha_entrega >= desde,
            Orden.fecha_entrega < hasta,
        )
        return list(db.scalars(stmt).all())

    def ordenes_en_curso(self, db: Session) -> dict[int, int]:
        stmt = (
            select(Orden.mecanico_id, func.count(Orden.id))
            .where(Orden.mecanico_id.isnot(None), Orden.estado.notin_(CERRADOS))
            .group_by(Orden.mecanico_id)
        )
        return {mecanico_id: cantidad for mecanico_id, cantidad in db.execute(stmt)}

    def lineas_de_repuestos(self, db: Session, orden_ids: List[int]) -> List[DetalleOrden]:
        if not orden_ids:
            return []
        stmt = select(DetalleOrden).where(
            DetalleOrden.orden_id.in_(orden_ids), DetalleOrden.repuesto_id.isnot(None)
        )
        return list(db.scalars(stmt).all())

    def pagos_aprobados(self, db: Session, desde: datetime, hasta: datetime) -> List[Pago]:
        stmt = select(Pago).where(
            Pago.estado == "aprobado", Pago.fecha_pago >= desde, Pago.fecha_pago < hasta
        )
        return list(db.scalars(stmt).all())


metricas_repository = MetricasRepository()
