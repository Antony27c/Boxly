from datetime import datetime
from typing import Dict, List

from sqlalchemy import extract, func, select, text
from sqlalchemy.orm import Session

from app.core.suscripcion import ZONA_ARGENTINA
from app.models.detalle_orden import DetalleOrden
from app.models.orden import Orden
from app.models.pago import Pago
from app.models.usuario import RolUsuario, Usuario

CERRADOS = ("entregado", "cancelado")

# Corrimiento de Argentina respecto de UTC en horas (-3). Es fijo: no hay
# horario de verano desde 2009, así que alcanza con restarlo antes de agrupar.
HORAS_ARGENTINA = int(ZONA_ARGENTINA.utcoffset(datetime(2026, 1, 1)).total_seconds() // 3600)


def _es_sqlite(db: Session) -> bool:
    return db.get_bind().dialect.name == "sqlite"


def _formato_argentino(db: Session, columna, formato_sqlite: str, formato_pg: str):
    """Formatea un DateTime guardado en UTC naive según la hora argentina,
    portable entre SQLite y Postgres: se le suman ``HORAS_ARGENTINA`` horas
    antes de formatear, así 02:30 UTC del 1/2 cae en el 31/1 argentino."""
    if _es_sqlite(db):
        return func.strftime(formato_sqlite, columna, f"{HORAS_ARGENTINA} hours")
    return func.to_char(columna + text(f"interval '{HORAS_ARGENTINA} hours'"), formato_pg)


def _mes_de(db: Session, columna):
    """Clave 'YYYY-MM' del mes argentino de un timestamp UTC."""
    return _formato_argentino(db, columna, "%Y-%m", "YYYY-MM")


def _dia_de(db: Session, columna):
    """Clave 'YYYY-MM-DD' del día argentino de un timestamp UTC."""
    return _formato_argentino(db, columna, "%Y-%m-%d", "YYYY-MM-DD")


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

    def cobrado_por_medio(self, db: Session, desde: datetime, hasta: datetime) -> Dict[str, object]:
        """SUM(monto) por medio de los pagos aprobados cuyo fecha_pago cae en el intervalo.

        Incluye el cobro online (Mercado Pago) y el registrado en el local.
        """
        stmt = (
            select(Pago.medio, func.sum(Pago.monto))
            .where(
                Pago.estado == "aprobado",
                Pago.fecha_pago >= desde,
                Pago.fecha_pago < hasta,
            )
            .group_by(Pago.medio)
        )
        return {medio: total for medio, total in db.execute(stmt)}


metricas_repository = MetricasRepository()
