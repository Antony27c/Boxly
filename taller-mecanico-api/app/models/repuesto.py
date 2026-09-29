from sqlalchemy import Column, Integer, String, Numeric, Boolean
from sqlalchemy.orm import relationship
from app.database import Base


class Repuesto(Base):
    """Repuesto/pieza que se puede usar en las reparaciones (con control de stock)."""

    __tablename__ = "repuestos"

    id = Column(Integer, primary_key=True, index=True)
    codigo = Column(String(30), unique=True, nullable=False, index=True)
    nombre = Column(String(120), nullable=False)
    descripcion = Column(String(500), nullable=True)
    stock = Column(Integer, nullable=False, default=0)
    stock_minimo = Column(Integer, nullable=False, default=0)
    precio = Column(Numeric(12, 2), nullable=False)
    activo = Column(Boolean, default=True, nullable=False)

    detalles = relationship("DetalleOrden", back_populates="repuesto")
