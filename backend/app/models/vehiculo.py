from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.cliente import Cliente
    from app.models.orden import Orden
    from app.models.turno import Turno


class Vehiculo(Base):
    """Vehículo de un Cliente. Puede pasar por varias órdenes de trabajo y turnos."""

    __tablename__ = "vehiculos"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    cliente_id: Mapped[int] = mapped_column(ForeignKey("clientes.id"), nullable=False)
    patente: Mapped[str] = mapped_column(String(15), unique=True, nullable=False, index=True)
    marca: Mapped[str] = mapped_column(String(60), nullable=False)
    modelo: Mapped[str] = mapped_column(String(60), nullable=False)
    anio: Mapped[Optional[int]] = mapped_column(nullable=True)
    color: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    vin: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    observaciones: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    cliente: Mapped["Cliente"] = relationship(back_populates="vehiculos")
    ordenes: Mapped[List["Orden"]] = relationship(back_populates="vehiculo")
    turnos: Mapped[List["Turno"]] = relationship(back_populates="vehiculo")
