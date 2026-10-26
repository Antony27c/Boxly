from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.orden import Orden

ESTADOS_PAGO = ("pendiente", "aprobado", "rechazado")


class Pago(Base):
    """Pago online de una orden (Mercado Pago)."""

    __tablename__ = "pagos"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    orden_id: Mapped[int] = mapped_column(ForeignKey("ordenes.id"), nullable=False, index=True)
    monto: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    estado: Mapped[str] = mapped_column(String(20), nullable=False, default="pendiente")
    preference_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    payment_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    creado_en: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    fecha_pago: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    orden: Mapped["Orden"] = relationship(back_populates="pagos")
