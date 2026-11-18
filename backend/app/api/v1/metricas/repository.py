from datetime import datetime
from typing import Dict, List

from sqlalchemy import extract, func, select
from sqlalchemy.orm import Session

from app.models.detalle_orden import DetalleOrden
from app.models.orden import Orden
from app.models.pago import Pago
from app.models.usuario import RolUsuario, Usuario

CERRADOS = ("entregado", "cancelado")


def _es_sqlite(db: Session) -> bool:
    return db.get_bind().dialect.name == "sqlite"


def _mes_de(db: Session, columna):
    """Clave 'YYYY-MM' de un timestamp, portable entre SQLite y Postgres."""
    if _es_sqlite(db):
        return func.strftime("%Y-%m", columna)
    return func.to_char(columna, "YYYY-MM")


def _dia_de(db: Session, columna):
    """Clave 'YYYY-MM-DD' de un timestamp, portable entre SQLite y Postgres."""
    if _es_sqlite(db):
        return func.strftime("%Y-%m-%d", columna)
    return func.date(columna)


def _horas_entre(db: Session, inicio, fin):
    """Duración en horas entre dos DateTime, portable entre SQLite y Postgres."""
    if _es_sqlite(db):
        return (func.julianday(fin) - func.julianday(inicio)) * 24
    return (extract("epoch", fin) - extract("epoch", inicio)) / 3600


class MetricasRepository:
    def mecanicos_activos(self, db: Session) -> List[Usuario]:
        stmt = (
            select(Usuario)
            .where(Usuario.rol == RolUsuario.mecanico, Usuario.activo.is_(True))
            .order_by(Usuario.apellido, Usuario.nombre)
        )
        return list(db.scalars(stmt).all())

    def resumen_cerradas_por_mecanico(
        self, db: Session, desde: datetime, hasta: datetime
    ) -> Dict[int, dict]:
        """COUNT, SUM(costo_final) y AVG(duración) por mecánico, todo en SQL."""
        horas = _horas_entre(db, Orden.fecha_ingreso, Orden.fecha_entrega)
        stmt = (
            select(
                Orden.mecanico_id,
                func.count(Orden.id),
                func.sum(Orden.costo_final),
                func.avg(horas),
            )
            .where(
                Orden.estado == "entregado",
                Orden.fecha_entrega >= desde,
                Orden.fecha_entrega < hasta,
                Orden.mecanico_id.isnot(None),
            )
            .group_by(Orden.mecanico_id)
        )
        return {
            mecanico_id: {
                "cerradas": cerradas,
                "facturado": facturado,
                "horas": horas_prom,
            }
            for mecanico_id, cerradas, facturado, horas_prom in db.execute(stmt)
        }

    def ordenes_en_curso(self, db: Session) -> dict[int, int]:
        stmt = (
            select(Orden.mecanico_id, func.count(Orden.id))
            .where(Orden.mecanico_id.isnot(None), Orden.estado.notin_(CERRADOS))
            .group_by(Orden.mecanico_id)
        )
        return {mecanico_id: cantidad for mecanico_id, cantidad in db.execute(stmt)}

    def resumen_ingresos_por_mes(
        self, db: Session, desde: datetime, hasta: datetime
    ) -> Dict[str, object]:
        """SUM(costo_final) de órdenes entregadas agrupado por mes de entrega."""
        expr = _mes_de(db, Orden.fecha_entrega)
        stmt = (
            select(expr, func.sum(Orden.costo_final))
            .where(
                Orden.estado == "entregado",
                Orden.fecha_entrega >= desde,
                Orden.fecha_entrega < hasta,
            )
            .group_by(expr)
        )
        return {mes: total for mes, total in db.execute(stmt)}

    def resumen_ingresos_por_dia(
        self, db: Session, desde: datetime, hasta: datetime
    ) -> Dict[str, object]:
        """SUM(costo_final) de órdenes entregadas agrupado por día de entrega."""
        expr = _dia_de(db, Orden.fecha_entrega)
        stmt = (
            select(expr, func.sum(Orden.costo_final))
            .where(
                Orden.estado == "entregado",
                Orden.fecha_entrega >= desde,
                Orden.fecha_entrega < hasta,
            )
            .group_by(expr)
        )
        return {dia: total for dia, total in db.execute(stmt)}

    def resumen_egresos_por_mes(
        self, db: Session, desde: datetime, hasta: datetime
    ) -> Dict[str, object]:
        """SUM(cantidad*precio) de repuestos, atribuido al mes de la orden."""
        expr = _mes_de(db, Orden.fecha_entrega)
        stmt = (
            select(
                expr,
                func.sum(DetalleOrden.cantidad * DetalleOrden.precio_unitario),
            )
            .select_from(DetalleOrden)
            .join(Orden, DetalleOrden.orden_id == Orden.id)
            .where(
                Orden.estado == "entregado",
                Orden.fecha_entrega >= desde,
                Orden.fecha_entrega < hasta,
                DetalleOrden.repuesto_id.isnot(None),
            )
            .group_by(expr)
        )
        return {mes: total for mes, total in db.execute(stmt)}

    def total_cobrado(self, db: Session, desde: datetime, hasta: datetime):
        """SUM(monto) de pagos aprobados cuyo fecha_pago cae en el intervalo."""
        stmt = select(func.sum(Pago.monto)).where(
            Pago.estado == "aprobado",
            Pago.fecha_pago >= desde,
            Pago.fecha_pago < hasta,
        )
        return db.scalar(stmt)


metricas_repository = MetricasRepository()
