"""Planes de Boxly y pagos de la suscripción de cada taller (docs/Suscripciones.md)."""
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    event,
    func,
)
from sqlalchemy import DDL
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

PLAN_POR_DEFECTO = "basico"
DIAS_DE_PRUEBA = 30


class Plan(Base):
    """Plan de suscripción. Lo que cambia entre planes es el límite de personal."""

    __tablename__ = "planes"

    codigo: Mapped[str] = mapped_column(String(20), primary_key=True)
    nombre: Mapped[str] = mapped_column(String(60), nullable=False)
    precio_mensual: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    # NULL = sin límite. Cuenta administradores, recepción y mecánicos activos.
    max_personal: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


# Valores iniciales (provisorios; el superadmin los edita).
PLANES_INICIALES = (
    ("basico", "Básico", Decimal("15000.00"), 3),
    ("pro", "Pro", Decimal("30000.00"), 10),
    ("taller_plus", "Taller+", Decimal("50000.00"), None),
)


class PagoSuscripcion(Base):
    """Pago de la suscripción de un taller a Boxly (manual o Mercado Pago)."""

    __tablename__ = "pagos_suscripcion"
    __table_args__ = (
        CheckConstraint("medio IN ('manual', 'mercadopago')", name="ck_pagos_suscripcion_medio"),
        CheckConstraint(
            "estado IN ('aprobado', 'pendiente', 'rechazado')", name="ck_pagos_suscripcion_estado"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    taller_id: Mapped[int] = mapped_column(
        ForeignKey("talleres.id", name="fk_pagos_suscripcion_taller_id_talleres"),
        nullable=False,
        index=True,
    )
    monto: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    periodo_desde: Mapped[date] = mapped_column(Date, nullable=False)
    periodo_hasta: Mapped[date] = mapped_column(Date, nullable=False)
    medio: Mapped[str] = mapped_column(String(20), nullable=False)
    estado: Mapped[str] = mapped_column(String(20), nullable=False, default="aprobado")
    referencia: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    mp_payment_id: Mapped[Optional[str]] = mapped_column(String(60), nullable=True, unique=True)
    registrado_por_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("usuarios.id", name="fk_pagos_suscripcion_registrado_por_usuarios",
                   ondelete="SET NULL"),
        nullable=True,
    )
    creado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


# Con Base.metadata.create_all (tests y bases nuevas sin alembic) los planes tienen
# que existir antes que cualquier taller, igual que los crea la migración b8d4f2a6c013.
event.listen(
    Plan.__table__,
    "after_create",
    DDL(
        "INSERT INTO planes (codigo, nombre, precio_mensual, max_personal, activo) VALUES "
        + ", ".join(
            f"('{c}', '{n}', {p}, {'NULL' if m is None else m}, 1)"
            for c, n, p, m in PLANES_INICIALES
        )
    ),
)
