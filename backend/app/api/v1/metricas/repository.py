from sqlalchemy.orm import Session
from sqlalchemy import select, func, and_
from typing import List, Optional
from datetime import datetime
from decimal import Decimal

from app.models.orden import Orden
from app.models.detalle_orden import DetalleOrden
from app.models. repuesto import Repuesto
from app.models.usuario import Usuario

class MetricasRepository:
    def metricas_mecanicos(self, db:Session, desde: Optional[datetime]= None, hasta: Optional[datetime]= None) -> List[dict]:
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
    def balance_financiero(self, db:Session, desde: Optional[datetime]= None, hasta: Optional[datetime]=None) ->List[dict]:
        stmt = select(func.strftime("%Y-%m", Orden.fecha_entrega).label("mes"), func.sum(Orden.costo_final).label("ingresos").where(Orden.estado== "entregado", Orden.fecha_entrega.isnot(None)))
        if desde:
            stmt = stmt.where(Orden.fecha_entrega >= desde)
        if hasta:
            stmt= stmt.where(Orden.fecha_entrega <= hasta)
        stmt = stmt.group_by(func.strftime("%Y-%m", Orden.fecha_entrega))
        stmt = stmt.order_by(func.strftime("%Y-%m", Orden.fecha_entrega))

        resultados=[]
        for row in db.execute(stmt):
            mes= row.mes
            ingresos = row.ingresos or Decimal("0")
 
            # Calcular gasto en repuestos para este mes
            stmt_gastos = (
                select(func.sum(DetalleOrden.cantidad * DetalleOrden.precio_unitario))
                .join(Repuesto, DetalleOrden.repuesto_id == Repuesto.id)
                .join(Orden, DetalleOrden.orden_id == Orden.id)
                .where(
                    Orden.estado == "entregado",
                    func.strftime("%Y-%m", Orden.fecha_entrega) == mes,
                )
            )
            gastos = db.scalar(stmt_gastos) or Decimal("0")
 
            balance = ingresos - gastos
            resultados.append(
                {
                    "mes": mes,
                    "ingresos": ingresos,
                    "gastos_repuestos": gastos,
                    "balance": balance,
                }
            )
 
        return resultados
 
    def mejor_mecanico_trimestre(self, db: Session, trimestre: str) -> Optional[dict]:
        # trimestre formato: "2024-Q1", "2024-Q2", etc.
        partes = trimestre.split("-")
        anio = int(partes[0])
        q = partes[1]
        
        # Mapear trimestre a meses
        trimestre_meses = {
            "Q1": [1, 2, 3],
            "Q2": [4, 5, 6],
            "Q3": [7, 8, 9],
            "Q4": [10, 11, 12],
        }
        meses = trimestre_meses.get(q)
        if not meses:
            return None
 
        # Query: mecánico con mayor suma de costo_final en ese trimestre
        stmt = (
            select(
                Usuario.id.label("mecanico_id"),
                Usuario.apellido,
                Usuario.nombre,
                func.sum(Orden.costo_final).label("monto"),
            )
            .join(Orden, Usuario.id == Orden.mecanico_id)
            .where(
                Usuario.rol == "mecanico",
                Orden.estado == "entregado",
                func.extract("year", Orden.fecha_entrega) == anio,
                func.extract("month", Orden.fecha_entrega).in_(meses),
            )
            .group_by(Usuario.id, Usuario.apellido, Usuario.nombre)
            .order_by(func.sum(Orden.costo_final).desc())
            .limit(1)
        )
 
        row = db.execute(stmt).first()
        if not row:
            return None
 
        return {
            "mecanico_id": row.mecanico_id,
            "mecanico_nombre": f"{row.apellido}, {row.nombre}",
            "trimestre": trimestre,
            "monto_facturado": row.monto or Decimal("0"),
        }

metricas_repository = MetricasRepository()
