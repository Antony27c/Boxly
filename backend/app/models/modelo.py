from sqlalchemy import String, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

class Modelo(Base):
    __tablename__="modelos"

    id:Mapped[int] =mapped_column(primary_key=True)
    marca_id: Mapped[int] =mapped_column(ForeignKey("marcas.id"), nullable=False)
    nombre: Mapped[str] = mapped_column(String(100),nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    marca: Mapped["Marca"] =relationship("Marca", back_populates="modelos")
    