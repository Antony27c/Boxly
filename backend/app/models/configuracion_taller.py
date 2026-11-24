from datetime import datetime
from typing import Optional

from sqlalchemy import ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.tipos import FechaHoraUTC


class ConfiguracionTaller(Base):
    """Datos de cada taller (una fila por taller). Los edita el administrador del taller.

    Se muestran en el ticket de cobro y en el portal del cliente.
    """

    __tablename__ = "configuracion_taller"

    id: Mapped[int] = mapped_column(primary_key=True)
    taller_id: Mapped[int] = mapped_column(
        ForeignKey("talleres.id", name="fk_configuracion_taller_taller_id_talleres"),
        nullable=False,
        unique=True,
    )
    nombre: Mapped[str] = mapped_column(String(120), nullable=False, default="Mi taller")
    razon_social: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    cuit: Mapped[Optional[str]] = mapped_column(String(13), nullable=True)
    direccion: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    telefono: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    sitio_web: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    hora_apertura: Mapped[str] = mapped_column(String(5), nullable=False, default="08:00")
    hora_cierre: Mapped[str] = mapped_column(String(5), nullable=False, default="18:00")
    mensaje_portal: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    pie_ticket: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    dias_garantia: Mapped[int] = mapped_column(Integer, nullable=False, default=90)
    actualizado_en: Mapped[Optional[datetime]] = mapped_column(
        FechaHoraUTC(), onupdate=func.now(), nullable=True
    )
    actualizado_por_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey(
            "usuarios.id",
            name="fk_configuracion_taller_actualizado_por_id_usuarios",
            ondelete="SET NULL",
        ),
        nullable=True,
    )
