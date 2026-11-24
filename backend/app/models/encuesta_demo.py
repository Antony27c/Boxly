"""Encuesta de fin de la demo (docs/Oferta.md, tarea C6).

Es dato de la plataforma sobre el taller, no de sus clientes: va sin
TallerMixin y el ``taller_id`` se filtra a mano. Una sola fila por taller
(``taller_id`` único): sirve tanto para la respuesta como para la marca de
"salteada".
"""
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    ForeignKey,
    Integer,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.tipos import FechaHoraUTC

INTENCIONES_ENCUESTA = ("contratar", "tal_vez", "no")


class EncuestaDemo(Base):
    __tablename__ = "encuestas_demo"
    __table_args__ = (
        CheckConstraint(
            "intencion IS NULL OR intencion IN ('contratar', 'tal_vez', 'no')",
            name="ck_encuestas_demo_intencion",
        ),
        CheckConstraint(
            "puntaje IS NULL OR puntaje BETWEEN 1 AND 5",
            name="ck_encuestas_demo_puntaje",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    taller_id: Mapped[int] = mapped_column(
        ForeignKey("talleres.id", name="fk_encuestas_demo_taller_id_talleres"),
        nullable=False,
        unique=True,
        index=True,
    )
    respondida_por_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey(
            "usuarios.id",
            name="fk_encuestas_demo_respondida_por_usuarios",
            ondelete="SET NULL",
        ),
        nullable=True,
    )
    gusto: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    mejoras: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    sugerencias: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    puntaje: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    intencion: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    salteada: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="0"
    )
    creado_en: Mapped[datetime] = mapped_column(
        FechaHoraUTC(), server_default=func.now(), nullable=False
    )
