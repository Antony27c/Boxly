from sqlalchemy.orm import Session
from sqlalchemy import select, func, and_
from typing import List, Optional
from datetime import datetime
from decimal import Decimal

from app.models.orden import Orden
from app.models.usuario import Usuario

class MetricasRepository:
    def metricas_mecanicos(self, db:Session, desde: Optional[datetime]= None, hasta: Optional[datetime= None]) -> List[dict]:
        stmt_mecanicos = select(Usuario).where(Usuario.rol == "mecanico", Usuario.activo == True)
        mecanicos = list(db.scalars(stmt_mecanicos).all())
        resultados = []

        for mecanico in mecanicos:
            stmt = select(Orden).where(Orden.mecanico_id == mecanico.id, Orden.estado == "entregado", Orden.fecha_entrega.isnot(None),)
            if desde:
                stmt = stmt.where(Orden.fecha_entrega >= desde)
            if hasta:
                stmt = stmt.where(Orden.fecha_entrega<=hasta)

            ordenes= list(db.scalars(stmt).all())

            if not ordenes:
                continue

            ordenes_cerradas = list(ordenes)
            monto_facturado = sum(o.costo_final or Decimal ("0") for o in ordenes)

            total_dias = Decimal("0")
            for o in ordenes:
                if o.fecha_entrega and o.fecha_entrega:
                    dias = (o.fecha_entrega - o.fecha_entrega).days
                    total_dias += Decimal(str(dias))

            tiempo_promedio = total_dias / ordenes_cerradas if ordenes_cerradas > 0 else Decimal("0")

            resultados.append(
                {
                    "mecanico_id": mecanico.id,
                    "mecanico_nombre": f"{mecanico.apellido}, {mecanico.nombre}",
                    "ordenes_cerradas": ordenes_cerradas,
                    "tiempo_promedio_dias": tiempo_promedio,
                    "monto_facturado": monto_facturado
                }
            )
        return resultados
metricas_repository = MetricasRepository()

