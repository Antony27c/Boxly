from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class Turno(Base):
    """Turno agendado por un Cliente para traer un Vehiculo al taller."""

    __tablename__ = "turnos"

    id = Column(Integer, primary_key=True, index=True)
    cliente_id = Column(Integer, ForeignKey("clientes.id"), nullable=False)
    vehiculo_id = Column(Integer, ForeignKey("vehiculos.id"), nullable=False)
    registrado_por_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)

    fecha_hora = Column(DateTime(timezone=True), nullable=False)
    estado = Column(String(30), nullable=False, default="pendiente")  # pendiente | confirmado | cancelado | completado
    motivo = Column(String(300), nullable=True)
    notas = Column(String(500), nullable=True)

    cliente = relationship("Cliente", back_populates="turnos")
    vehiculo = relationship("Vehiculo", back_populates="turnos")
    registrado_por = relationship("Usuario")
