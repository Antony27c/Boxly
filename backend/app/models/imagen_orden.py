from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.orden import Orden
    from app.models.usuario import Usuario


class ImagenOrden(Base):
    """Foto de una orden, asociada a la etapa en la que se sacó."""

    __tablename__ = "imagenes_orden"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    orden_id: Mapped[int] = mapped_column(ForeignKey("ordenes.id"), nullable=False, index=True)
    etapa: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    url: Mapped[str] = mapped_column(String(500), nullable=False)
    usuario_id: Mapped[Optional[int]] = mapped_column(ForeignKey("usuarios.id"), nullable=True)
    fecha: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    orden: Mapped["Orden"] = relationship(back_populates="imagenes")
    usuario: Mapped[Optional["Usuario"]] = relationship()

    @property
    def usuario_nombre(self) -> Optional[str]:
        if self.usuario is None:
            return None
        return f"{self.usuario.apellido}, {self.usuario.nombre}"
