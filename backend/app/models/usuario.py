import enum
from datetime import datetime
from typing import TYPE_CHECKING, List

from sqlalchemy import Boolean, DateTime, Enum, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.orden import Orden
    from app.models.turno import Turno


class RolUsuario(str, enum.Enum):
    administrador = "administrador"
    recepcion = "recepcion"
    mecanico = "mecanico"


class Usuario(Base):
    """Usuario interno del taller (login + roles). Sprint 1 — Antonio."""

    __tablename__ = "usuarios"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    nombre: Mapped[str] = mapped_column(String(80), nullable=False)
    apellido: Mapped[str] = mapped_column(String(80), nullable=False)
    email: Mapped[str] = mapped_column(String(120), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    rol: Mapped[RolUsuario] = mapped_column(
        Enum(RolUsuario, name="rol_usuario", native_enum=False),
        nullable=False,
        default=RolUsuario.recepcion,
    )
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    creado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    actualizado_en: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        onupdate=func.now(),
        nullable=True,
    )

    # Un Usuario puede haber CREADO muchas órdenes y también estar ASIGNADO
    # como mecánico en otras. foreign_keys explícito porque ambas FK de
    # Orden apuntan a esta misma tabla.
    ordenes_creadas: Mapped[List["Orden"]] = relationship(
        "Orden", foreign_keys="Orden.creado_por_id", back_populates="creado_por"
    )
    ordenes_asignadas: Mapped[List["Orden"]] = relationship(
        "Orden", foreign_keys="Orden.mecanico_id", back_populates="mecanico"
    )
    turnos_registrados: Mapped[List["Turno"]] = relationship(
        "Turno", back_populates="registrado_por"
    )
