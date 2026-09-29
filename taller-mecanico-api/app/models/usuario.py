from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Usuario(Base):
    """Usuario del sistema (mecánico/administrativo que opera el taller)."""

    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(80), nullable=False)
    apellido = Column(String(80), nullable=False)
    email = Column(String(120), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    rol = Column(String(20), nullable=False, default="mecanico")  # admin | mecanico
    activo = Column(Boolean, default=True, nullable=False)
    creado_en = Column(DateTime(timezone=True), server_default=func.now())
    actualizado_en = Column(DateTime(timezone=True), onupdate=func.now())

    # Un Usuario puede haber CREADO muchas órdenes...
    ordenes_creadas = relationship(
        "OrdenTrabajo",
        foreign_keys="OrdenTrabajo.creado_por_id",
        back_populates="creado_por",
    )
    # ...y también puede estar ASIGNADO como mecánico en muchas órdenes distintas.
    # Ambas relaciones apuntan a la misma tabla (OrdenTrabajo), por eso hace falta
    # indicar "foreign_keys" explícitamente para que SQLAlchemy sepa distinguirlas.
    ordenes_asignadas = relationship(
        "OrdenTrabajo",
        foreign_keys="OrdenTrabajo.mecanico_id",
        back_populates="mecanico",
    )

    turnos_registrados = relationship("Turno", back_populates="registrado_por")

    cambios_historial = relationship("HistorialEstado", back_populates="usuario")
