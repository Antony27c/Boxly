from typing import TYPE_CHECKING

from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.modelo import Modelo


class Marca(Base):
    __tablename__="marcas"

    id:Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str]= mapped_column(String(100), unique=True, nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    modelos: Mapped[list["Modelo"]] = relationship("Modelo", back_populates="marca")
