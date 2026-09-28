import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, String, func
from sqlalchemy.orm import Mapped, mapped_column
from typing import Optional, List
from app.db.base import Base

class Orden (Base):
    __tablenombre__="ordenes"

"""creacion de tabla con los respectivos atributos"""
id=Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
descripcion=Mapped[str] = mapped_column(String(255), nullable=False)
estado=Mapped[str] = mapped_column(String(50),default="pendiente",nullable=False)
fecha_creacion=Mapped[datetime]= mapped_column (DateTime, default=datetime.utcnow, nullable=False)
mecanico_id=Mapped[Optional[int]]= mapped_column(ForeignKey("usuario.id"), nullable=True)

mecanico: Mapped[Optional["Usuario"]]=relationship()
historial_estados: Mapped[List["HistorialEstado"]] = relationship(back_populates="orden")

