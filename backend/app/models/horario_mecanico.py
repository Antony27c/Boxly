from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
 
from app.db.base import Base
 
 
class HorarioMecanico(Base):
    __tablename__ = "horarios_mecanico"
 
    id: Mapped[int] = mapped_column(primary_key=True)
    mecanico_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id"), nullable=False)
    dia_semana: Mapped[int] = mapped_column(nullable=False)  # 0=lunes, 6=domingo
    hora_desde: Mapped[str] = mapped_column(String(5), nullable=False)  # HH:MM
    hora_hasta: Mapped[str] = mapped_column(String(5), nullable=False)  # HH:MM
 
    mecanico: Mapped["Usuario"] = relationship("Usuario", backref="horarios_mecanico")