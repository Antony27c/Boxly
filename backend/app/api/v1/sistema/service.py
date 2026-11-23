"""Estado de la plataforma, respaldo por taller y salud general (P3).

Solo lo usan las rutas de ``app/api/v1/sistema/router.py``: ``/plataforma/*``
para el superadmin y ``/taller/respaldo`` para el administrador del taller.
Nunca se devuelven secretos: las integraciones informan solo si están
configuradas y el respaldo excluye las columnas sensibles.
"""

import csv
import enum
import io
import zipfile
from datetime import date, datetime

from sqlalchemy import Table, func, select, text
from sqlalchemy.inspection import inspect
from sqlalchemy.orm import Session

from app.api.v1.ordenes.service import TRANSICIONES_VALIDAS
from app.core.config import UPLOADS_DIR, get_settings
from app.core.rate_limit import limiter
from app.db.base import Base
from app.db.session import SIN_FILTRO_TALLER, engine
from app.models import (
    Cliente,
    ConfiguracionTaller,
    DetalleOrden,
    Historial_estado,
    HorarioMecanico,
    Orden,
    Pago,
    Repuesto,
    Taller,
    Turno,
    Usuario,
    Vehiculo,
)
from app.models.usuario import RolUsuario
from app.schemas.sistema import (
    SistemaConteosResponse,
    SistemaDbResponse,
    SistemaIntegracionesResponse,
    SistemaResponse,
    SistemaTalleresResponse,
    SistemaUploadsResponse,
    SistemaUsuariosPorRolResponse,
)

# Tablas del respaldo en el orden del contrato, con sus modelos ORM. Las
# consultas son ORM a propósito: el filtro automático por taller de
# app.db.session es lo único que garantiza que el ZIP no mezcle talleres.
MODELOS_RESPALDO = {
    "usuarios": Usuario,
    "clientes": Cliente,
    "vehiculos": Vehiculo,
    "ordenes": Orden,
    "detalles_orden": DetalleOrden,
    "historial_estado": Historial_estado,
    "repuestos": Repuesto,
    "turnos": Turno,
    "pagos": Pago,
    "horarios_mecanico": HorarioMecanico,
    "configuracion_taller": ConfiguracionTaller,
}

# Nunca se exportan secretos: password_hash, token_version ni ninguna columna
# de token de activación presente o futura.
_PALABRAS_EXCLUIDAS = ("password", "token", "secret")


def _columna_sensible(nombre: str) -> bool:
    nombre = nombre.lower()
    return any(palabra in nombre for palabra in _PALABRAS_EXCLUIDAS)


def _celda(valor):
    """Valor listo para csv.writer: enums por su value y fechas en ISO."""
    if valor is None:
        return ""
    if isinstance(valor, enum.Enum):
        return valor.value
    if isinstance(valor, (datetime, date)):
        return valor.isoformat()
    return valor


class SistemaService:
    def _contar_tabla(self, db: Session, nombre: str) -> int:
        # Conteo agregado de toda la plataforma: sin filtro de taller.
        tabla = Base.metadata.tables[nombre]
        return (
            db.scalar(
                select(func.count())
                .select_from(tabla)
                .execution_options(**{SIN_FILTRO_TALLER: True})
            )
            or 0
        )

    def _estados_finales_orden(self) -> tuple[str, ...]:
        # Estados sin transición saliente: entregado y cancelado.
        return tuple(
            estado for estado, siguientes in TRANSICIONES_VALIDAS.items() if not siguientes
        )

    def _ordenes_abiertas(self, db: Session) -> int:
        tabla = Base.metadata.tables["ordenes"]
        return (
            db.scalar(
                select(func.count())
                .select_from(tabla)
                .where(tabla.c.estado.notin_(self._estados_finales_orden()))
                .execution_options(**{SIN_FILTRO_TALLER: True})
            )
            or 0
        )

    def _conteos(self, db: Session) -> SistemaConteosResponse:
        return SistemaConteosResponse(
            usuarios=self._contar_tabla(db, "usuarios"),
            clientes=self._contar_tabla(db, "clientes"),
            vehiculos=self._contar_tabla(db, "vehiculos"),
            ordenes=self._contar_tabla(db, "ordenes"),
            ordenes_abiertas=self._ordenes_abiertas(db),
            repuestos=self._contar_tabla(db, "repuestos"),
            turnos=self._contar_tabla(db, "turnos"),
            pagos=self._contar_tabla(db, "pagos"),
        )

    def _usuarios_por_rol(self, db: Session) -> SistemaUsuariosPorRolResponse:
        tabla = Base.metadata.tables["usuarios"]
        conteos = {rol.value: 0 for rol in RolUsuario}
        for rol, total in db.execute(
            select(tabla.c.rol, func.count())
            .group_by(tabla.c.rol)
            .execution_options(**{SIN_FILTRO_TALLER: True})
        ):
            clave = rol.value if isinstance(rol, RolUsuario) else str(rol)
            if clave in conteos:
                conteos[clave] = total
        return SistemaUsuariosPorRolResponse(**conteos)

    def _talleres_por_estado(self, db: Session) -> SistemaTalleresResponse:
        conteos = {"activo": 0, "suspendido": 0}
        for estado, total in db.execute(
            select(Taller.estado, func.count())
            .group_by(Taller.estado)
            .execution_options(**{SIN_FILTRO_TALLER: True})
        ):
            if estado in conteos:
                conteos[estado] = total
        return SistemaTalleresResponse(**conteos)

    def _db_responde(self, db: Session) -> bool:
        try:
            db.execute(text("SELECT 1"))
            return True
        except Exception:
            db.rollback()
            return False

    def _revision_alembic(self, db: Session) -> str | None:
        """Revisión de alembic_version; None si la tabla no existe (tests con create_all)."""
        try:
            if not inspect(db.get_bind()).has_table("alembic_version"):
                return None
            return db.scalar(text("SELECT version_num FROM alembic_version"))
        except Exception:
            db.rollback()
            return None

    def _uploads(self) -> SistemaUploadsResponse:
        archivos = 0
        total = 0
        if UPLOADS_DIR.is_dir():
            for ruta in UPLOADS_DIR.rglob("*"):
                try:
                    if ruta.is_file():
                        archivos += 1
                        total += ruta.stat().st_size
                except OSError:
                    continue
        return SistemaUploadsResponse(archivos=archivos, bytes=total)

    def _integraciones(self) -> SistemaIntegracionesResponse:
        settings = get_settings()
        return SistemaIntegracionesResponse(
            # Mismo criterio que app/core/email.py para poder enviar.
            email=bool(settings.smtp_user and settings.smtp_password),
            mercadopago=bool(settings.mp_access_token),
            rate_limit=bool(limiter.enabled),
        )

    def obtener_estado_sistema(self, db: Session) -> SistemaResponse:
        settings = get_settings()
        motor = engine.dialect.name
        if self._db_responde(db):
            db_info = SistemaDbResponse(
                motor=motor, ok=True, revision=self._revision_alembic(db)
            )
            conteos = self._conteos(db)
            usuarios_por_rol = self._usuarios_por_rol(db)
            talleres = self._talleres_por_estado(db)
        else:
            # La base no responde: se informa el estado sin romper el endpoint.
            db_info = SistemaDbResponse(motor=motor, ok=False, revision=None)
            conteos = SistemaConteosResponse(
                usuarios=0,
                clientes=0,
                vehiculos=0,
                ordenes=0,
                ordenes_abiertas=0,
                repuestos=0,
                turnos=0,
                pagos=0,
            )
            usuarios_por_rol = SistemaUsuariosPorRolResponse(
                superadmin=0, administrador=0, recepcion=0, mecanico=0, cliente=0
            )
            talleres = SistemaTalleresResponse(activo=0, suspendido=0)
        return SistemaResponse(
            version=settings.app_version,
            entorno=settings.environment,
            db=db_info,
            conteos=conteos,
            usuarios_por_rol=usuarios_por_rol,
            talleres=talleres,
            uploads=self._uploads(),
            integraciones=self._integraciones(),
        )

    def _csv_modelo(self, db: Session, modelo: type) -> str:
        """CSV de un modelo con la sesión ya filtrada por taller (solo ORM)."""
        tabla: Table = modelo.__table__
        columnas = [c for c in tabla.columns if not _columna_sensible(c.name)]
        stmt = select(modelo).order_by(modelo.id)
        if not hasattr(modelo, "taller_id"):
            # Sin columna propia (detalles e historial): se acotan por la orden,
            # que sí queda filtrada por el taller de la sesión.
            stmt = stmt.where(modelo.orden_id.in_(select(Orden.id)))
        buffer = io.StringIO()
        escritor = csv.writer(buffer)
        escritor.writerow([c.name for c in columnas])
        for fila in db.scalars(stmt):
            escritor.writerow([_celda(getattr(fila, c.name)) for c in columnas])
        return buffer.getvalue()

    def generar_respaldo(self, db: Session) -> bytes:
        """ZIP en memoria con un CSV por tabla, solo del taller de la sesión."""
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as respaldo:
            for modelo in MODELOS_RESPALDO.values():
                respaldo.writestr(
                    f"{modelo.__tablename__}.csv",
                    self._csv_modelo(db, modelo).encode("utf-8-sig"),
                )
        return buffer.getvalue()


sistema_service = SistemaService()
