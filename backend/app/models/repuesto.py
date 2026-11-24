from decimal import Decimal
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Boolean, CheckConstraint, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.taller import TallerMixin

if TYPE_CHECKING:
    from app.models.detalle_orden import DetalleOrden


class Repuesto(TallerMixin, Base):
    """Repuesto/pieza que se puede usar en las reparaciones (con control de stock)."""

    __tablename__ = "repuestos"

    __table_args__ = (
        CheckConstraint("stock >= 0", name="ck_repuestos_stock_no_negativo"),
        UniqueConstraint("taller_id", "codigo", name="uq_repuestos_taller_codigo"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    codigo: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    nombre: Mapped[str] = mapped_column(String(120), nullable=False)
    descripcion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    stock: Mapped[int] = mapped_column(nullable=False, default=0)
    stock_minimo: Mapped[int] = mapped_column(nullable=False, default=0)
    # True mientras el aviso de stock mínimo ya fue enviado y el stock no
    # volvió a superar el mínimo (se rearma solo, docs/Oferta.md 4b W3).
    alerta_stock_enviada: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="0"
    )
    precio: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    detalles: Mapped[List["DetalleOrden"]] = relationship(back_populates="repuesto")
