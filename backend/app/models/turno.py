from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.cliente import Cliente
    from app.models.usuario import Usuario
    from app.models.vehiculo import Vehiculo


class Turno(Base):
    """Turno agendado por un Cliente para traer un Vehículo al taller."""

    __tablename__ = "turnos"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    cliente_id: Mapped[int] = mapped_column(ForeignKey("clientes.id"), nullable=False)
    vehiculo_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("vehiculos.id"), nullable=True
    )
    registrado_por_id: Mapped[int] = mapped_column(
        ForeignKey("usuarios.id"), nullable=False
    )
    fecha_hora: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    # DER §3.7: pendiente | confirmado | cancelado | asistio
    estado: Mapped[str] = mapped_column(String(20), nullable=False, default="pendiente")
    motivo: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    notas: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    cliente: Mapped["Cliente"] = relationship(back_populates="turnos")
    vehiculo: Mapped[Optional["Vehiculo"]] = relationship(back_populates="turnos")
    registrado_por: Mapped["Usuario"] = relationship(back_populates="turnos_registrados")
