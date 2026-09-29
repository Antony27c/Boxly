from sqlalchemy import Column, Integer, String, Text, DateTime, Numeric, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class OrdenTrabajo(Base):
    """
    Orden de trabajo: el registro central de una reparación.
    Tiene DOS relaciones distintas hacia Usuario:
    - creado_por_id: quién generó la orden (recepción/administrativo)
    - mecanico_id: quién la tiene asignada para trabajar
    """ 

    __tablename__ = "ordenes_trabajo"

    id = Column(Integer, primary_key=True, index=True)

    cliente_id = Column(Integer, ForeignKey("clientes.id"), nullable=False)
    vehiculo_id = Column(Integer, ForeignKey("vehiculos.id"), nullable=False)
    creado_por_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    mecanico_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)

    codigo = Column(String(30), unique=True, nullable=False, index=True)
    estado = Column(String(20), nullable=False, default="pendiente")
    descripcion_ingreso = Column(Text, nullable=False)
    diagnostico = Column(Text, nullable=True)
    costo_estimado = Column(Numeric(12, 2), nullable=True)
    costo_final = Column(Numeric(12, 2), nullable=True)

    fecha_ingreso = Column(DateTime(timezone=True), nullable=True)
    fecha_estimada_entrega = Column(DateTime(timezone=True), nullable=True)
    fecha_entrega = Column(DateTime(timezone=True), nullable=True)

    cliente = relationship("Cliente", back_populates="ordenes_trabajo")
    vehiculo = relationship("Vehiculo", back_populates="ordenes_trabajo")

    # "foreign_keys" es obligatorio acá: como hay DOS columnas que apuntan a
    # "usuarios", SQLAlchemy no puede adivinar sola cuál corresponde a cada relación.
    creado_por = relationship(
        "Usuario", foreign_keys=[creado_por_id], back_populates="ordenes_creadas"
    )
    mecanico = relationship(
        "Usuario", foreign_keys=[mecanico_id], back_populates="ordenes_asignadas"
    )

    detalles = relationship("DetalleOrden", back_populates="orden")
    historial = relationship("HistorialEstado", back_populates="orden")
