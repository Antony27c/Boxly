from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from fastapi import HTTPException

from app.schemas.metricas import MecanicoMetricasResponse, BalanceMensualResponse, MejorMecanicoResponse
from .repository import metricas_repository

class MetricasService:
    def metricas_mecanicos(self, db:Session, desde: Optional[datetime] = None, hasta:Optional[datetime]= None)-> List[MecanicoMetricasResponse]:
        datos = metricas_repository.metricas_mecanicos(db, desde, hasta)
        return [MecanicoMetricasResponse(**d)for d in datos]
    def balance_financiero(
        self, db: Session, desde: Optional[datetime] = None, hasta: Optional[datetime] = None
    ) -> List[BalanceMensualResponse]:
        datos = metricas_repository.balance_financiero(db, desde, hasta)
        return [BalanceMensualResponse(**d) for d in datos]
 
    def mejor_mecanico_trimestre(self, db: Session, trimestre: str) -> Optional[MejorMecanicoResponse]:
        datos = metricas_repository.mejor_mecanico_trimestre(db, trimestre)
        if not datos:
            raise HTTPException(status_code=404, detail="No hay datos para ese trimestre")
        return MejorMecanicoResponse(**datos)
metricas_service = MetricasService()