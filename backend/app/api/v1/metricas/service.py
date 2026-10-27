from collections import defaultdict
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from typing import List, Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.schemas.metricas import (
    BalanceMensualResponse,
    FinanzasResponse,
    MecanicoDestacadoResponse,
    MecanicoMetricasResponse,
    MejorMecanicoResponse,
)
from .repository import metricas_repository

CERO = Decimal("0.00")
CRITERIO = "Más órdenes cerradas; desempata mayor facturado y después menor tiempo promedio"


def _limites(desde: date, hasta: date) -> tuple[datetime, datetime]:
    if desde > hasta:
        raise HTTPException(status_code=400, detail="La fecha 'desde' no puede ser posterior a 'hasta'")
    return datetime.combine(desde, time.min), datetime.combine(hasta + timedelta(days=1), time.min)


def _meses(desde: date, hasta: date) -> List[str]:
    meses, anio, mes = [], desde.year, desde.month
    while (anio, mes) <= (hasta.year, hasta.month):
        meses.append(f"{anio:04d}-{mes:02d}")
        anio, mes = (anio + 1, 1) if mes == 12 else (anio, mes + 1)
    return meses


def _trimestre(trimestre: Optional[str]) -> tuple[str, date, date]:
    hoy = date.today()
    if trimestre is None:
        trimestre = f"{hoy.year}-Q{(hoy.month - 1) // 3 + 1}"
    anio, numero = int(trimestre[:4]), int(trimestre[-1])
    inicio = date(anio, 3 * (numero - 1) + 1, 1)
    siguiente = date(anio + 1, 1, 1) if numero == 4 else date(anio, inicio.month + 3, 1)
    return trimestre, inicio, siguiente - timedelta(days=1)


class MetricasService:
    def metricas_mecanicos(self, db: Session, desde: Optional[date] = None, hasta: Optional[date] = None) -> List[MecanicoMetricasResponse]:
        hasta = hasta or date.today()
        desde = desde or hasta - timedelta(days=29)
        inicio, fin = _limites(desde, hasta)

        cerradas = defaultdict(list)
        for orden in metricas_repository.ordenes_cerradas(db, inicio, fin):
            cerradas[orden.mecanico_id].append(orden)
        en_curso = metricas_repository.ordenes_en_curso(db)

        resultado = []
        for mecanico in metricas_repository.mecanicos_activos(db):
            ordenes = cerradas.get(mecanico.id, [])
            horas = [(o.fecha_entrega - o.fecha_ingreso).total_seconds() / 3600 for o in ordenes]
            resultado.append(MecanicoMetricasResponse(
                mecanico_id=mecanico.id,
                nombre=f"{mecanico.apellido}, {mecanico.nombre}",
                ordenes_cerradas=len(ordenes),
                ordenes_en_curso=en_curso.get(mecanico.id, 0),
                tiempo_promedio_horas=round(sum(horas) / len(horas), 1) if horas else None,
                facturado=sum((o.costo_final or CERO for o in ordenes), CERO),
            ))
        return resultado

    def finanzas(self, db: Session, desde: Optional[date] = None, hasta: Optional[date] = None) -> FinanzasResponse:
        hasta = hasta or date.today()
        if desde is None:
            mes = hasta.month - 5
            desde = date(hasta.year + (mes - 1) // 12, (mes - 1) % 12 + 1, 1)
        inicio, fin = _limites(desde, hasta)

        ordenes = metricas_repository.ordenes_cerradas(db, inicio, fin)
        mes_de_orden = {o.id: o.fecha_entrega.strftime("%Y-%m") for o in ordenes}
        ingresos = dict.fromkeys(_meses(desde, hasta), CERO)
        egresos = dict.fromkeys(ingresos, CERO)
        for orden in ordenes:
            ingresos[mes_de_orden[orden.id]] += orden.costo_final or CERO
        for linea in metricas_repository.lineas_de_repuestos(db, list(mes_de_orden)):
            egresos[mes_de_orden[linea.orden_id]] += linea.cantidad * linea.precio_unitario
        cobrado = sum((p.monto for p in metricas_repository.pagos_aprobados(db, inicio, fin)), CERO)

        total_ingresos, total_egresos = sum(ingresos.values(), CERO), sum(egresos.values(), CERO)
        return FinanzasResponse(
            desde=desde,
            hasta=hasta,
            ingresos=total_ingresos,
            cobrado_online=cobrado,
            egresos_repuestos=total_egresos,
            balance=total_ingresos - total_egresos,
            mensual=[
                BalanceMensualResponse(mes=mes, ingresos=ingresos[mes], egresos=egresos[mes], balance=ingresos[mes] - egresos[mes])
                for mes in ingresos
            ],
        )

    def mejor_mecanico(self, db: Session, trimestre: Optional[str] = None) -> MejorMecanicoResponse:
        trimestre, desde, hasta = _trimestre(trimestre)
        candidatos = [m for m in self.metricas_mecanicos(db, desde, hasta) if m.ordenes_cerradas]
        candidatos.sort(key=lambda m: (-m.ordenes_cerradas, -m.facturado, m.tiempo_promedio_horas))
        mejor = candidatos[0] if candidatos else None
        return MejorMecanicoResponse(
            trimestre=trimestre,
            desde=desde,
            hasta=hasta,
            criterio=CRITERIO,
            mecanico=MecanicoDestacadoResponse(**mejor.model_dump(exclude={"ordenes_en_curso"})) if mejor else None,
        )


metricas_service = MetricasService()
