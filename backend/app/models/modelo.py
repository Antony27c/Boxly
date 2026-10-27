from sqlalchemy import String, Boolean, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

class Modelo(Base):
    __tablename__="modelos"
    __table_args__ = (UniqueConstraint("marca_id", "nombre", name="uq_modelos_marca_nombre"),)

    id:Mapped[int] =mapped_column(primary_key=True)
    marca_id: Mapped[int] =mapped_column(ForeignKey("marcas.id"), nullable=False, index=True)
    nombre: Mapped[str] = mapped_column(String(100),nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    marca: Mapped["Marca"] =relationship("Marca", back_populates="modelos")
