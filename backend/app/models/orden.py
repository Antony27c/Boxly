from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.cliente import Cliente
    from app.models.detalle_orden import DetalleOrden
    from app.models.usuario import Usuario
    from app.models.vehiculo import Vehiculo


class Orden(Base):
    """Orden de trabajo: el registro central de una reparación (DER §3.4).

    Tiene DOS relaciones hacia Usuario: creado_por_id (quién la registró) y
    mecanico_id (quién la tiene asignada). Por eso cada relationship() lleva
    foreign_keys explícito.
    """

    __tablename__ = "ordenes"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    cliente_id: Mapped[int] = mapped_column(ForeignKey("clientes.id"), nullable=False)
    vehiculo_id: Mapped[int] = mapped_column(ForeignKey("vehiculos.id"), nullable=False)
    creado_por_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id"), nullable=False)
    mecanico_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("usuarios.id"), nullable=True
    )
    codigo: Mapped[str] = mapped_column(
        String(30), unique=True, nullable=False, index=True
    )
    estado: Mapped[str] = mapped_column(String(30), default="pendiente", nullable=False)
    descripcion_ingreso: Mapped[str] = mapped_column(Text, nullable=False)
    diagnostico: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    costo_estimado: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(12, 2), nullable=True
    )
    costo_final: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)
    fecha_ingreso: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    fecha_estimada_entrega: Mapped[Optional[datetime]] = mapped_column(
        DateTime, nullable=True
    )
    fecha_entrega: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    cliente: Mapped["Cliente"] = relationship(back_populates="ordenes")
    vehiculo: Mapped["Vehiculo"] = relationship(back_populates="ordenes")
    creado_por: Mapped["Usuario"] = relationship(
        foreign_keys=[creado_por_id], back_populates="ordenes_creadas"
    )
    mecanico: Mapped[Optional["Usuario"]] = relationship(
        foreign_keys=[mecanico_id], back_populates="ordenes_asignadas"
    )
    detalles: Mapped[List["DetalleOrden"]] = relationship(back_populates="orden")
    historial_estados: Mapped[List["Historial_estado"]] = relationship(
        back_populates="orden"
    )


class Historial_estado(Base):
    """Auditoría de cambios de estado de una orden (DER §3.8)."""

    __tablename__ = "historial_estado"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    orden_id: Mapped[int] = mapped_column(ForeignKey("ordenes.id"), nullable=False)
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id"), nullable=False)
    estado_anterior: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    estado_nuevo: Mapped[str] = mapped_column(String(30), nullable=False)
    comentario: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    fecha: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )

    orden: Mapped["Orden"] = relationship(back_populates="historial_estados")
    usuario: Mapped["Usuario"] = relationship()
