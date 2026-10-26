from sqlalchemy import String, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime

from app.db.base import Base

class ImagenOrden(Base):
    __tablename__="imagenes_orden"

    id: Mapped[int] = mapped_column(primary_key=True)
    orden_id: Mapped[int] =  mapped_column(ForeignKey("ordenes.id"), nullable=False)
    url: Mapped[str] = mapped_column(String(500), nullable=False)
    fecha_subida: Mapped[datetime] = mapped_column(default=datetime.utcnow, nullable=False)

    orden: Mapped["Orden"] = relationship("Orden", backref="imagenes")