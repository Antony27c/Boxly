from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.taller import TallerMixin

if TYPE_CHECKING:
    from app.models.cliente import Cliente
    from app.models.usuario import Usuario
    from app.models.vehiculo import Vehiculo


class Turno(TallerMixin, Base):
    """Turno agendado por un Cliente para traer un Vehículo al taller."""

    __tablename__ = "turnos"

    __table_args__ = (
        CheckConstraint(
            "estado IN ('pendiente', 'confirmado', 'en_taller', "
            "'completado', 'cancelado', 'asistio')",
            name="ck_turnos_estado_valido",
        ),
        Index(
            "uq_turnos_mecanico_fecha_hora",
            "fecha_hora",
            "mecanico_id",
            unique=True,
            sqlite_where=text("estado <> 'cancelado' AND mecanico_id IS NOT NULL"),
            postgresql_where=text("estado <> 'cancelado' AND mecanico_id IS NOT NULL"),
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    cliente_id: Mapped[int] = mapped_column(ForeignKey("clientes.id"), nullable=False, index=True)
    vehiculo_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("vehiculos.id"), nullable=True
    )
    registrado_por_id: Mapped[int] = mapped_column(
        ForeignKey("usuarios.id"), nullable=False
    )
    # Mecánico que va a atender el turno (opcional, contrato S7 D8)
    mecanico_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("usuarios.id", name="fk_turnos_mecanico_id_usuarios"), nullable=True, index=True
    )
    fecha_hora: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    # DER §3.7: pendiente | confirmado | cancelado | asistio
    estado: Mapped[str] = mapped_column(String(20), nullable=False, default="pendiente")
    motivo: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    notas: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    cliente: Mapped["Cliente"] = relationship(back_populates="turnos")
    vehiculo: Mapped[Optional["Vehiculo"]] = relationship(back_populates="turnos")
    # foreign_keys explícito porque registrado_por_id y mecanico_id apuntan a usuarios
    registrado_por: Mapped["Usuario"] = relationship(
        foreign_keys=[registrado_por_id], back_populates="turnos_registrados"
    )
    mecanico: Mapped[Optional["Usuario"]] = relationship(foreign_keys=[mecanico_id])
