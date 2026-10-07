from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class Vehiculo(Base):
    """Vehículo de un Cliente. Puede pasar por varias órdenes de trabajo y turnos."""

    __tablename__ = "vehiculos"

    id = Column(Integer, primary_key=True, index=True)
    cliente_id = Column(Integer, ForeignKey("clientes.id"), nullable=False)
    patente = Column(String(10), unique=True, nullable=False, index=True)
    marca = Column(String(50), nullable=False)
    modelo = Column(String(50), nullable=False)
    anio = Column(Integer, nullable=False)
    color = Column(String(30), nullable=True)
    vin = Column(String(50), nullable=True)  # número de chasis/identificación del vehículo
    observaciones = Column(String(500), nullable=True)

    cliente = relationship("Cliente", back_populates="vehiculos")
    ordenes_trabajo = relationship("OrdenTrabajo", back_populates="vehiculo")
    turnos = relationship("Turno", back_populates="vehiculo")
