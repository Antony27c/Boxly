from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Cliente(Base):
    """Cliente del taller. Puede tener varios vehículos, órdenes y turnos."""

    __tablename__ = "clientes"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(80), nullable=False)
    apellido = Column(String(80), nullable=False)
    dni = Column(String(15), unique=True, nullable=False, index=True)
    telefono = Column(String(30), nullable=True)
    email = Column(String(120), nullable=True)
    direccion = Column(String(200), nullable=True)
    creado_en = Column(DateTime(timezone=True), server_default=func.now())

    vehiculos = relationship("Vehiculo", back_populates="cliente")
    ordenes_trabajo = relationship("OrdenTrabajo", back_populates="cliente")
    turnos = relationship("Turno", back_populates="cliente")
