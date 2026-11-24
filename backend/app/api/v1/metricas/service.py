from datetime import date, datetime, time, timedelta, timezone
from decimal import ROUND_HALF_UP, Decimal
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.suscripcion import ZONA_ARGENTINA, hoy
from app.models.pago import MEDIOS_PAGO
from app.schemas.metricas import (
    BalanceMensualResponse,
    FinanzasResponse,
    IngresoDiarioResponse,
    MecanicoDestacadoResponse,
    MecanicoMetricasResponse,
    MejorMecanicoResponse,
)

from .repository import metricas_repository

CERO = Decimal("0.00")
CRITERIO = "Más órdenes cerradas; desempata mayor facturado y después menor tiempo promedio"
MAX_DIAS_DIARIO = 92


def _pesos(valor) -> Decimal:
    """Normaliza una suma SQL a Decimal con 2 decimales (formato de respuesta)."""
    if valor is None:
        return CERO
    return Decimal(str(valor)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _inicio_del_dia(dia: date) -> datetime:
    """00:00 de ``dia`` en Argentina como UTC naive, igual que se guardan
    ``Orden.fecha_entrega`` y ``Pago.fecha_pago`` (DateTime sin zona, en UTC)."""
    inicio = datetime.combine(dia, time.min, tzinfo=ZONA_ARGENTINA)
    return inicio.astimezone(timezone.utc).replace(tzinfo=None)


def _limites(desde: date, hasta: date) -> tuple[datetime, datetime]:
    """Intervalo ``[inicio, fin)`` en UTC que cubre los días argentinos
    ``desde`` a ``hasta``, ambos inclusive."""
    if desde > hasta:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La fecha 'desde' no puede ser posterior a 'hasta'",
        )
    return _inicio_del_dia(desde), _inicio_del_dia(hasta + timedelta(days=1))


def _meses(desde: date, hasta: date) -> List[str]:
    meses, anio, mes = [], desde.year, desde.month
    while (anio, mes) <= (hasta.year, hasta.month):
        meses.append(f"{anio:04d}-{mes:02d}")
        anio, mes = (anio + 1, 1) if mes == 12 else (anio, mes + 1)
    return meses


def _dias(desde: date, hasta: date) -> List[date]:
    dias, actual = [], desde
    while actual <= hasta:
        dias.append(actual)
        actual += timedelta(days=1)
    return dias


def _trimestre(trimestre: Optional[str]) -> tuple[str, date, date]:
    if trimestre is None:
        actual = hoy()
        trimestre = f"{actual.year}-Q{(actual.month - 1) // 3 + 1}"
    anio, numero = int(trimestre[:4]), int(trimestre[-1])
    inicio = date(anio, 3 * (numero - 1) + 1, 1)
    siguiente = date(anio + 1, 1, 1) if numero == 4 else date(anio, inicio.month + 3, 1)
    return trimestre, inicio, siguiente - timedelta(days=1)


class MetricasService:
    def metricas_mecanicos(
        self, db: Session, desde: Optional[date] = None, hasta: Optional[date] = None
    ) -> List[MecanicoMetricasResponse]:
        hasta = hasta or hoy()
        desde = desde or hasta - timedelta(days=29)
        inicio, fin = _limites(desde, hasta)

        resumen = metricas_repository.resumen_cerradas_por_mecanico(db, inicio, fin)
        en_curso = metricas_repository.ordenes_en_curso(db)

        resultado = []
        for mecanico in metricas_repository.mecanicos_activos(db):
            datos = resumen.get(mecanico.id) or {}
            horas = datos.get("horas")
            resultado.append(MecanicoMetricasResponse(
                mecanico_id=mecanico.id,
                nombre=f"{mecanico.apellido}, {mecanico.nombre}",
                ordenes_cerradas=datos.get("cerradas", 0),
                ordenes_en_curso=en_curso.get(mecanico.id, 0),
                tiempo_promedio_horas=round(float(horas), 1) if horas is not None else None,
                facturado=_pesos(datos.get("facturado")),
            ))
        return resultado

    def finanzas(
        self,
        db: Session,
        desde: Optional[date] = None,
        hasta: Optional[date] = None,
        agrupar: str = "mes",
    ) -> FinanzasResponse:
        hasta = hasta or hoy()
        if desde is None:
            mes = hasta.month - 5
            desde = date(hasta.year + (mes - 1) // 12, (mes - 1) % 12 + 1, 1)
        if agrupar == "dia" and (hasta - desde).days + 1 > MAX_DIAS_DIARIO:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"La agrupación por día admite rangos de hasta {MAX_DIAS_DIARIO} días",
            )
        inicio, fin = _limites(desde, hasta)

        ingresos = dict.fromkeys(_meses(desde, hasta), CERO)
        for mes, total in metricas_repository.resumen_ingresos_por_mes(db, inicio, fin).items():
            ingresos[mes] = _pesos(total)
        egresos = dict.fromkeys(ingresos, CERO)
        for mes, total in metricas_repository.resumen_egresos_por_mes(db, inicio, fin).items():
            egresos[mes] = _pesos(total)
        cobrado_por_medio = dict.fromkeys(MEDIOS_PAGO, CERO)
        for medio, total in metricas_repository.cobrado_por_medio(db, inicio, fin).items():
            cobrado_por_medio[medio] = _pesos(total)

        diario: List[IngresoDiarioResponse] = []
        if agrupar == "dia":
            por_dia = {
                str(dia)[:10]: _pesos(total)
                for dia, total in metricas_repository.resumen_ingresos_por_dia(db, inicio, fin).items()
            }
            diario = [
                IngresoDiarioResponse(fecha=dia, ingresos=por_dia.get(dia.isoformat(), CERO))
                for dia in _dias(desde, hasta)
            ]

        total_ingresos, total_egresos = sum(ingresos.values(), CERO), sum(egresos.values(), CERO)
        return FinanzasResponse(
            desde=desde,
            hasta=hasta,
            ingresos=total_ingresos,
            cobrado=sum(cobrado_por_medio.values(), CERO),
            cobrado_por_medio=cobrado_por_medio,
            egresos_repuestos=total_egresos,
            balance=total_ingresos - total_egresos,
            mensual=[
                BalanceMensualResponse(
                    mes=mes, ingresos=ingresos[mes], egresos=egresos[mes],
                    balance=ingresos[mes] - egresos[mes],
                )
                for mes in ingresos
            ],
            diario=diario,
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
            mecanico=(
                MecanicoDestacadoResponse(**mejor.model_dump(exclude={"ordenes_en_curso"}))
                if mejor else None
            ),
        )


metricas_service = MetricasService()
