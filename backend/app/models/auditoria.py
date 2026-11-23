from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Auditoria(Base):
    """Registro de cada acción que modifica datos (POST/PUT/PATCH/DELETE en /api/v1).

    Lo escribe el middleware de app.core.auditoria y lo lee el superadmin. Guarda
    copia del email y el rol para que el registro siga legible si el usuario cambia.
    """

    __tablename__ = "auditoria"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    creado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
    usuario_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("usuarios.id", name="fk_auditoria_usuario_id_usuarios", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    usuario_email: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    rol: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    metodo: Mapped[str] = mapped_column(String(8), nullable=False)
    ruta: Mapped[str] = mapped_column(String(255), nullable=False)
    entidad: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, index=True)
    entidad_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    estado_http: Mapped[int] = mapped_column(Integer, nullable=False)
    ip: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    detalle: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
