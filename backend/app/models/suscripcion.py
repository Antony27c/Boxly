"""Planes de Boxly, suscripción de cada taller y adicionales (docs/Suscripciones.md
y docs/Oferta.md, tanda C)."""
import json
from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum
from typing import Optional

from sqlalchemy import (
    DDL,
    JSON,
    Boolean,
    CheckConstraint,
    Date,
    ForeignKey,
    Integer,
    Numeric,
    String,
    event,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.funciones import (
    FUNCION_ARCA,
    FUNCION_GESTION,
    FUNCION_MARCA_PROPIA,
    FUNCION_RECORDATORIOS_SERVICE,
    FUNCION_WHATSAPP_AUTOMATICO,
    FUNCION_WHATSAPP_MANUAL,
)
from app.db.base import Base
from app.db.tipos import FechaHoraUTC

PLAN_POR_DEFECTO = "esencial"
# Demo comercial: plan Pro por DIAS_DEMO días, otorgada por el superadmin
# (docs/Oferta.md). El alta con tipo de acceso llega en C2.
PLAN_DEMO = "pro"
DIAS_DEMO = 14


class EstadoPagoSuscripcion(StrEnum):
    """Estado de un pago de la suscripción (pagos_suscripcion.estado)."""

    aprobado = "aprobado"
    pendiente = "pendiente"
    rechazado = "rechazado"


class MedioPagoSuscripcion(StrEnum):
    """Medio de un pago de la suscripción (pagos_suscripcion.medio)."""

    manual = "manual"
    mercadopago = "mercadopago"


def _valores_sql(enum: type[StrEnum]) -> str:
    return ", ".join(f"'{v}'" for v in enum)


class Plan(Base):
    """Plan de suscripción. Lo que cambia entre planes son las funciones y el
    límite de personal (docs/Oferta.md)."""

    __tablename__ = "planes"

    codigo: Mapped[str] = mapped_column(String(20), primary_key=True)
    nombre: Mapped[str] = mapped_column(String(60), nullable=False)
    precio_mensual: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    # NULL = sin límite. Cuenta administradores, recepción y mecánicos activos.
    max_personal: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    # Códigos de función habilitados (app/core/funciones.py, docs/Oferta.md).
    funciones: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


# Valores de referencia (provisorios; el superadmin los edita). Las funciones
# salen de la tabla de docs/Oferta.md, sección 4.
FUNCIONES_ESENCIAL = (FUNCION_GESTION, FUNCION_WHATSAPP_MANUAL)
FUNCIONES_PRO = (
    FUNCION_GESTION,
    FUNCION_WHATSAPP_MANUAL,
    FUNCION_WHATSAPP_AUTOMATICO,
    FUNCION_ARCA,
)
FUNCIONES_PROFESIONAL = (
    *FUNCIONES_PRO,
    FUNCION_RECORDATORIOS_SERVICE,
    FUNCION_MARCA_PROPIA,
)

PLANES_INICIALES = (
    ("esencial", "Esencial", Decimal("35000.00"), 3, list(FUNCIONES_ESENCIAL)),
    ("pro", "Pro", Decimal("79000.00"), 10, list(FUNCIONES_PRO)),
    ("profesional", "Profesional", Decimal("169000.00"), None, list(FUNCIONES_PROFESIONAL)),
)


class AdicionalTaller(Base):
    """Adicional contratado por un taller encima de su plan (docs/Oferta.md).

    Es dato de la plataforma sobre el taller (como AccesoSoporte): tiene
    ``taller_id`` explícito y no usa TallerMixin. Hoy solo existe ``arca``
    (facturación electrónica como adicional del plan Esencial); el superadmin
    los activa y les fija vigencia. Precio y cupo siguen pendientes.
    """

    __tablename__ = "adicionales_taller"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    taller_id: Mapped[int] = mapped_column(
        ForeignKey("talleres.id", name="fk_adicionales_taller_taller_id_talleres"),
        nullable=False,
        index=True,
    )
    # Código de función que habilita (hoy "arca").
    codigo: Mapped[str] = mapped_column(String(40), nullable=False)
    activo: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="1"
    )
    # Vigencia del adicional: NULL = sin límite de ese lado.
    desde: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    hasta: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    creado_en: Mapped[datetime] = mapped_column(
        FechaHoraUTC(), server_default=func.now(), nullable=False
    )


class PagoSuscripcion(Base):
    """Pago de la suscripción de un taller a Boxly (manual o Mercado Pago)."""

    __tablename__ = "pagos_suscripcion"
    __table_args__ = (
        CheckConstraint(
            f"medio IN ({_valores_sql(MedioPagoSuscripcion)})", name="ck_pagos_suscripcion_medio"
        ),
        CheckConstraint(
            f"estado IN ({_valores_sql(EstadoPagoSuscripcion)})",
            name="ck_pagos_suscripcion_estado",
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
    estado: Mapped[str] = mapped_column(
        String(20), nullable=False, default=EstadoPagoSuscripcion.aprobado.value
    )
    referencia: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    mp_payment_id: Mapped[Optional[str]] = mapped_column(String(60), nullable=True, unique=True)
    registrado_por_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("usuarios.id", name="fk_pagos_suscripcion_registrado_por_usuarios",
                   ondelete="SET NULL"),
        nullable=True,
    )
    creado_en: Mapped[datetime] = mapped_column(
        FechaHoraUTC(), server_default=func.now(), nullable=False
    )


# Con Base.metadata.create_all (tests y bases nuevas sin alembic) los planes tienen
# que existir antes que cualquier taller, igual que los crea la migración de oferta.
event.listen(
    Plan.__table__,
    "after_create",
    DDL(
        "INSERT INTO planes (codigo, nombre, precio_mensual, max_personal, funciones, activo) VALUES "
        + ", ".join(
            f"('{c}', '{n}', {p}, {'NULL' if m is None else m}, '{json.dumps(f)}', 1)"
            for c, n, p, m, f in PLANES_INICIALES
        )
    ),
)
