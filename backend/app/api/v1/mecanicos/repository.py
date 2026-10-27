from sqlalchemy.orm import Session
from sqlalchemy import select
from typing import List, Optional
 
from app.models.horario_mecanico import HorarioMecanico
 
 
class MecanicosRepository:
    def listar_horarios(self, db: Session, mecanico_id: int) -> List[HorarioMecanico]:
        stmt = select(HorarioMecanico).where(HorarioMecanico.mecanico_id == mecanico_id).order_by(
            HorarioMecanico.dia_semana, HorarioMecanico.hora_desde
        )
        return list(db.scalars(stmt).all())
 
    def obtener_horario(self, db: Session, horario_id: int) -> Optional[HorarioMecanico]:
        return db.get(HorarioMecanico, horario_id)
 
    def crear_horario(self, db: Session, horario: HorarioMecanico) -> HorarioMecanico:
        db.add(horario)
        db.commit()
        db.refresh(horario)
        return horario
 
    def actualizar_horario(self, db: Session, horario: HorarioMecanico) -> HorarioMecanico:
        db.add(horario)
        db.commit()
        db.refresh(horario)
        return horario
 
    def eliminar_horario(self, db: Session, horario: HorarioMecanico) -> None:
        db.delete(horario)
        db.commit()
 
 
mecanicos_repository = MecanicosRepository()