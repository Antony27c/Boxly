import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, String, func, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import Optional, List
from app.db.base import Base

class Orden (Base):
    __tablename__="ordenes"

"""creacion de tabla con los respectivos atributos"""
id=Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
descripcion=Mapped[str] = mapped_column(String(255), nullable=False)
estado=Mapped[str] = mapped_column(String(50),default="pendiente",nullable=False)
fecha_creacion=Mapped[datetime]= mapped_column (DateTime, default=datetime.utcnow, nullable=False)
mecanico_id=Mapped[Optional[int]]= mapped_column(ForeignKey("usuario.id"), nullable=True)

mecanico: Mapped[Optional["Usuario"]]=relationship()
historial_estados: Mapped[List["Historial_estado"]] = relationship(back_populates="orden")

class Historial_estado(Base):
    __tablename__="historial_estado"
id=Mapped[int]= mapped_column(primary_key=True, autoincrement=True)
orden_id=Mapped[int]=mapped_column(ForeignKey("ordenes_id"), nullable=False)
estado_anterior=Mapped[str]= mapped_column(String(50), nullable=True)
estado_nuevo =Mapped[str]= mapped_column(String(50),nullable=True)
fecha_cambio=Mapped[datetime] =mapped_column(DateTime, default=datetime.utcnow, nullable=False)

orden: Mapped["Orden"] = relationship(back_populates="historial_estados")

# la relacion mecanico con usuario es provisoria ya que hay que crear la tabla de mecanicos