from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Optional

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Numeric, String, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.taller import TallerMixin

if TYPE_CHECKING:
    from app.models.orden import Orden

ESTADOS_PAGO = ("pendiente", "aprobado", "rechazado")
# "mercadopago" es el cobro online; los demás, el pago registrado en el local.
MEDIOS_PAGO = ("mercadopago", "efectivo", "tarjeta", "transferencia", "otro")
MEDIOS_PAGO_LOCAL = MEDIOS_PAGO[1:]


class Pago(TallerMixin, Base):
    """Pago de una orden: online (Mercado Pago) o registrado en el local."""

    __tablename__ = "pagos"

    __table_args__ = (
        CheckConstraint(
            "estado IN ('pendiente', 'aprobado', 'rechazado', 'reembolsado')",
            name="ck_pagos_estado_valido",
        ),
        CheckConstraint(
            "medio IN ('mercadopago', 'efectivo', 'tarjeta', 'transferencia', 'otro')",
            name="ck_pagos_medio_valido",
        ),
        Index(
            "uq_pagos_payment_id",
            "payment_id",
            unique=True,
            sqlite_where=text("payment_id IS NOT NULL"),
            postgresql_where=text("payment_id IS NOT NULL"),
        ),
        Index(
            "uq_pagos_orden_pendiente",
            "orden_id",
            unique=True,
            sqlite_where=text("estado = 'pendiente'"),
            postgresql_where=text("estado = 'pendiente'"),
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    orden_id: Mapped[int] = mapped_column(ForeignKey("ordenes.id"), nullable=False, index=True)
    monto: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    estado: Mapped[str] = mapped_column(String(20), nullable=False, default="pendiente")
    medio: Mapped[str] = mapped_column(
        String(20), nullable=False, default="mercadopago", server_default="mercadopago"
    )
    # Comprobante del pago en el local (n.º de operación, de transferencia, etc.).
    referencia: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    preference_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    payment_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    creado_en: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    fecha_pago: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    orden: Mapped["Orden"] = relationship(back_populates="pagos")
