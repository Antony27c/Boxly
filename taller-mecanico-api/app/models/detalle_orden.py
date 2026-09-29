from sqlalchemy import Column, Integer, String, Numeric, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class DetalleOrden(Base):
    """Cada línea de una Orden de Trabajo: un repuesto usado, con cantidad y precio."""

    __tablename__ = "detalles_orden"

    id = Column(Integer, primary_key=True, index=True)
    orden_id = Column(Integer, ForeignKey("ordenes_trabajo.id"), nullable=False)
    repuesto_id = Column(Integer, ForeignKey("repuestos.id"), nullable=False)

    descripcion = Column(String(300), nullable=True)  # ej: aclaraciones del uso del repuesto
    cantidad = Column(Integer, nullable=False, default=1)
    precio_unitario = Column(Numeric(12, 2), nullable=False)

    orden = relationship("OrdenTrabajo", back_populates="detalles")
    repuesto = relationship("Repuesto", back_populates="detalles")
