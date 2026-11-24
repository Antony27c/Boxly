from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.tipos import FechaHoraUTC
from app.models.taller import TallerMixin

if TYPE_CHECKING:
    from app.models.orden import Orden
    from app.models.repuesto import Repuesto
    from app.models.usuario import Usuario

RESULTADOS_NOTIFICACION = ("enviado", "fallido", "omitido")


class Notificacion(TallerMixin, Base):
    """Comprobante de cada aviso por email que se intentó mandar al cliente."""

    __tablename__ = "notificaciones"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    orden_id: Mapped[int] = mapped_column(ForeignKey("ordenes.id"), nullable=False, index=True)
    tipo: Mapped[str] = mapped_column(String(30), nullable=False, default="cambio_estado")
    estado_orden: Mapped[str] = mapped_column(String(30), nullable=False)
    destinatario: Mapped[str] = mapped_column(String(120), nullable=False)
    asunto: Mapped[str] = mapped_column(String(200), nullable=False)
    resultado: Mapped[str] = mapped_column(String(20), nullable=False)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # None = aviso automático por el cambio de estado; con valor = reenvío manual.
    enviado_por_id: Mapped[Optional[int]] = mapped_column(ForeignKey("usuarios.id"), nullable=True)
    creado_en: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )

    orden: Mapped["Orden"] = relationship(back_populates="notificaciones")
    enviado_por: Mapped[Optional["Usuario"]] = relationship()

    @property
    def enviado_por_nombre(self) -> Optional[str]:
        if self.enviado_por is None:
            return None
        return f"{self.enviado_por.apellido}, {self.enviado_por.nombre}"

    @property
    def manual(self) -> bool:
        return self.enviado_por_id is not None


class NotificacionInterna(TallerMixin, Base):
    """Aviso interno para el personal del taller (administración y recepción).

    A diferencia de `Notificacion` —que es el comprobante de cada email que
    se intentó mandar al cliente— esta es una notificación en la app: la
    genera el sistema por eventos del taller (hoy: stock mínimo de
    repuestos) y la consulta el personal desde su sesión. Es dato del taller:
    lleva `taller_id` por TallerMixin y el filtro automático la aísla.
    """

    __tablename__ = "notificaciones_internas"

    TIPO_STOCK_BAJO = "stock_bajo"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    # Qué evento la generó (hoy solo "stock_bajo"; deja lugar a otros).
    tipo: Mapped[str] = mapped_column(String(30), nullable=False, default=TIPO_STOCK_BAJO)
    repuesto_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("repuestos.id", name="fk_notificaciones_internas_repuesto_repuestos"),
        nullable=True,
        index=True,
    )
    mensaje: Mapped[str] = mapped_column(Text, nullable=False)
    creado_en: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    # NULL = sin leer. La marca el administrador o recepción que la vio.
    leida_en: Mapped[Optional[datetime]] = mapped_column(FechaHoraUTC(), nullable=True)
    leida_por_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("usuarios.id", name="fk_notificaciones_internas_leida_por_usuarios",
                   ondelete="SET NULL"),
        nullable=True,
    )

    repuesto: Mapped[Optional["Repuesto"]] = relationship()
    leida_por: Mapped[Optional["Usuario"]] = relationship()
