"""Talleres de la plataforma y el acceso de soporte que cada uno otorga.

Boxly es multi-taller: cada taller es dueño (responsable, Ley 25.326) de los datos
de sus clientes y Boxly es el encargado del tratamiento. Por eso el superadmin no
ve datos de clientes salvo con un AccesoSoporte vigente que el taller otorga.
Contrato completo en docs/Plataforma.md.
"""
from datetime import date, datetime
from typing import Optional


from sqlalchemy import (
    DDL,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    event,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

# Taller que se crea en la migración con los datos que había antes del multi-taller.
# También es el que usan los scripts y los tests cuando no hay un taller en contexto.
TALLER_PRINCIPAL_ID = 1


class Taller(Base):
    __tablename__ = "talleres"
    __table_args__ = (
        CheckConstraint("estado IN ('activo', 'suspendido')", name="ck_talleres_estado_valido"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    nombre: Mapped[str] = mapped_column(String(120), nullable=False)
    estado: Mapped[str] = mapped_column(String(20), nullable=False, default="activo")
    creado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    suspendido_en: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    # Aceptación de los términos y del acuerdo de tratamiento de datos (tarea P8).
    terminos_version: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    terminos_aceptados_en: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    terminos_aceptados_por_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("usuarios.id", name="fk_talleres_terminos_por_usuarios", ondelete="SET NULL",
                   use_alter=True),
        nullable=True,
    )

    # Suscripción (docs/Suscripciones.md). Vencimiento NULL = sin vencimiento (al día).
    plan_codigo: Mapped[str] = mapped_column(
        String(20), ForeignKey("planes.codigo", name="fk_talleres_plan_codigo_planes"),
        nullable=False, default="basico", server_default="basico",
    )
    suscripcion_vence_en: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    cobro_automatico: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="0"
    )
    mp_preapproval_id: Mapped[Optional[str]] = mapped_column(String(60), nullable=True)

    @property
    def activo(self) -> bool:
        return self.estado == "activo"


class TallerMixin:
    """Columna taller_id para las tablas con datos de un taller.

    El filtro automático de app.db.session agrega `taller_id = <taller actual>` a
    cada SELECT de estos modelos y completa taller_id en las filas nuevas.
    """

    # Columna simple (no declared_attr) para que with_loader_criteria la resuelva en
    # el mixin; SQLAlchemy la copia a cada tabla. Los nombres de la FK los fija la
    # migración e9a4b2c6d801 (fk_<tabla>_taller_id_talleres).
    taller_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("talleres.id"), nullable=False, index=True
    )


class AccesoSoporte(Base):
    """Permiso temporal que un taller le da al superadmin para ver sus datos.

    Solo lectura, con datos personales enmascarados (tarea P2). Vigente si
    `desde <= ahora < hasta` y no fue revocado.
    """

    __tablename__ = "accesos_soporte"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    taller_id: Mapped[int] = mapped_column(
        ForeignKey("talleres.id", name="fk_accesos_soporte_taller_id_talleres"),
        nullable=False,
        index=True,
    )
    otorgado_por_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("usuarios.id", name="fk_accesos_soporte_otorgado_por_usuarios",
                   ondelete="SET NULL"),
        nullable=True,
    )
    motivo: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    desde: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    hasta: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revocado_en: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    revocado_por_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("usuarios.id", name="fk_accesos_soporte_revocado_por_usuarios",
                   ondelete="SET NULL"),
        nullable=True,
    )


# Con Base.metadata.create_all (tests y bases nuevas sin alembic) el taller principal
# tiene que existir, igual que lo crea la migración e9a4b2c6d801.
event.listen(
    Taller.__table__,
    "after_create",
    DDL(
        "INSERT INTO talleres (id, nombre, estado) "
        f"VALUES ({TALLER_PRINCIPAL_ID}, 'Taller principal', 'activo')"
    ),
)
