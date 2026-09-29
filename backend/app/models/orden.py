import enum
from datetime import datetime
from decimal import Decimal
from typing import Optional, List, TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Enum, String, func, ForeignKey, Text, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

if TYPE_CHECKING:
    from app.models.usuario import Usuario
class Orden(Base):
    __tablename__="ordenes"

    """creacion de tabla con los respectivos atributos"""
    id:Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    cliente_id: Mapped[int] = mapped_column(ForeignKey("clientes.id"), nullable=False)
    vehiculo_id: Mapped[int] = mapped_column(ForeignKey("vehiculos.id"), nullable=False)
    creado_por_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id"), nullable=False)
    codigo: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    descripcion_ingreso:Mapped[str] = mapped_column(String(255), nullable=False)
    estado:Mapped[str] = mapped_column(String(50),default="pendiente",nullable=False)
    fecha_ingreso:Mapped[datetime]= mapped_column(DateTime, default=func.now(), nullable=False)
    mecanico_id:Mapped[Optional[int]]= mapped_column(ForeignKey("usuario.id"), nullable=True)
    diagnostico:Mapped[str]= mapped_column(String(255),nullable=False)
    mecanico: Mapped[Optional["Usuario"]]=relationship()
    historial_estados: Mapped[List["Historial_estado"]] = relationship(back_populates="orden")


class Historial_estado(Base):
    __tablename__="historial_estado"
    id:Mapped[int]= mapped_column(primary_key=True, autoincrement=True)
    orden_id:Mapped[int]=mapped_column(ForeignKey("ordenes.id"), nullable=False)
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id"), nullable=False)
    comentario: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    estado_anterior:Mapped[Optional[str]]= mapped_column(String(50), nullable=True)
    estado_nuevo:Mapped[Optional[str]]= mapped_column(String(50),nullable=True)
    fecha:Mapped[datetime] =mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    orden: Mapped["Orden"] = relationship(back_populates="historial_estados")

