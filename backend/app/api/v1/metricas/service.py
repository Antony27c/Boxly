from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.schemas.metricas import MecanicoMetricasResponse
from .repository import metricas_repository

class MetricasService:
    def metricas_mecanicos(self, db:Session, desde: Optional[datetime] = None, hasta:Optional[datetime]= None)-> List[MecanicoMetricasResponse]:
        datos = metricas_repository.metricas_mecanicos(db, desde, hasta)
        return [MecanicoMetricasResponse(**d)for d in datos]

metricas_service = MetricasService()