"""Solicitudes de demo que llegan desde la landing pública (docs/Landing.md, L5).

Es dato de la plataforma (prospectos de Boxly), no de ningún taller: va sin
TallerMixin y solo la ve el superadmin.
"""
from datetime import datetime
from typing import Optional

from sqlalchemy import CheckConstraint, DateTime, Index, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

ESTADOS_SOLICITUD = ("nueva", "contactada", "convertida", "descartada")


class SolicitudContacto(Base):
    __tablename__ = "solicitudes_contacto"
    __table_args__ = (
        CheckConstraint(
            "estado IN ('nueva', 'contactada', 'convertida', 'descartada')",
            name="ck_solicitudes_contacto_estado",
        ),
        # El límite por IP cuenta las filas recientes de esa IP.
        Index("ix_solicitudes_contacto_ip_creado_en", "ip", "creado_en"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    taller: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(254), nullable=False)
    telefono: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    ciudad: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    mensaje: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    estado: Mapped[str] = mapped_column(
        String(20), nullable=False, default="nueva", server_default="nueva", index=True
    )
    nota: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Solo para el límite de envíos; se puede borrar a los 90 días.
    ip: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    creado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
