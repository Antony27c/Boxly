from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.orden import Orden
    from app.models.usuario import Usuario

RESULTADOS_NOTIFICACION = ("enviado", "fallido", "omitido")


class Notificacion(Base):
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
