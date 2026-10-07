from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class HistorialEstado(Base):
    """Registra cada cambio de estado de una Orden de Trabajo (auditoria/trazabilidad)."""

    __tablename__ = "historial_estados"

    id = Column(Integer, primary_key=True, index=True)
    orden_id = Column(Integer, ForeignKey("ordenes_trabajo.id"), nullable=False)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)  # quien hizo el cambio

    estado_anterior = Column(String(30), nullable=True)
    estado_nuevo = Column(String(30), nullable=False)
    comentario = Column(String(500), nullable=True)
    fecha = Column(DateTime(timezone=True), server_default=func.now())

    orden = relationship("OrdenTrabajo", back_populates="historial")
    usuario = relationship("Usuario")
