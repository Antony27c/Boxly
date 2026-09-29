from decimal import Decimal
from typing import TYPE_CHECKING, Optional

from sqlalchemy import ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.orden import Orden
    from app.models.repuesto import Repuesto


class DetalleOrden(Base):
    """Cada línea de una Orden: repuesto usado o ítem de mano de obra."""

    __tablename__ = "detalles_orden"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    orden_id: Mapped[int] = mapped_column(ForeignKey("ordenes.id"), nullable=False)
    repuesto_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("repuestos.id"), nullable=True
    )
    descripcion: Mapped[str] = mapped_column(String(200), nullable=False)
    cantidad: Mapped[int] = mapped_column(nullable=False, default=1)
    precio_unitario: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)

    orden: Mapped["Orden"] = relationship(back_populates="detalles")
    repuesto: Mapped[Optional["Repuesto"]] = relationship(back_populates="detalles")
