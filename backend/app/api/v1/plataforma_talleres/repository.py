"""Consultas de la plataforma (superadmin): talleres y su personal.

La sesión llega con ``session.info["taller_id"] = None`` (contexto plataforma):
las filas con datos de un taller quedan filtradas, así que los conteos por
taller usan ``execution_options(sin_filtro_taller=True)`` y agrupan por
``taller_id``. Nunca se devuelven filas de clientes: solo agregados.
"""
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.session import SIN_FILTRO_TALLER
from app.models.auditoria import Auditoria
from app.models.cliente import Cliente
from app.models.orden import Orden
from app.models.suscripcion import DIAS_DE_PRUEBA, PLAN_POR_DEFECTO
from app.models.taller import AccesoSoporte, Taller
from app.models.usuario import ROLES_PERSONAL, Usuario
from app.schemas.paginacion import ParametrosPagina, aplicar, contar

# Rutas del login exitoso, para el "último ingreso" del personal.
RUTA_LOGIN = "/api/v1/auth/login"
DIAS_ORDENES_MES = 30
LIMITE_ACCESOS = 20


def _sin_filtro(stmt):
    return stmt.execution_options(**{SIN_FILTRO_TALLER: True})


def _stmt_talleres(*, estado: str | None, q: str | None):
    stmt = select(Taller)
    if estado is not None:
        stmt = stmt.where(Taller.estado == estado)
    if q:
        stmt = stmt.where(func.lower(Taller.nombre).like(f"%{q.lower().strip()}%"))
    return stmt.order_by(Taller.id)


def listar_talleres(
    db: Session,
    *,
    estado: str | None = None,
    q: str | None = None,
    pagina: ParametrosPagina | None = None,
) -> tuple[list[Taller], int]:
    stmt = _stmt_talleres(estado=estado, q=q)
    items = list(db.scalars(aplicar(stmt, pagina) if pagina else stmt))
    return items, contar(db, _stmt_talleres(estado=estado, q=q))


def get_taller(db: Session, taller_id: int) -> Taller | None:
    return db.get(Taller, taller_id)


def crear_taller(db: Session, *, nombre: str) -> Taller:
    # Plan básico con 30 días de prueba (docs/Suscripciones.md).
    taller = Taller(
        nombre=nombre,
        plan_codigo=PLAN_POR_DEFECTO,
        suscripcion_vence_en=date.today() + timedelta(days=DIAS_DE_PRUEBA),
    )
    db.add(taller)
    db.flush()
    return taller


def actualizar_taller(db: Session, taller: Taller, *, nombre: str | None = None) -> Taller:
    if nombre is not None:
        taller.nombre = nombre
    db.add(taller)
    db.commit()
    db.refresh(taller)
    return taller


def cambiar_estado(db: Session, taller: Taller, estado: str) -> Taller:
    taller.estado = estado
    taller.suspendido_en = datetime.now(timezone.utc) if estado == "suspendido" else None
    db.add(taller)
    db.commit()
    db.refresh(taller)
    return taller


def conteos_por_taller(db: Session) -> dict[int, dict]:
    """Agregados por taller para TallerResumen: personal activo, clientes,
    órdenes del último mes y último uso. Todo con ``sin_filtro_taller`` y
    agrupado por taller_id: son conteos, nunca filas de clientes."""
    limite = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=DIAS_ORDENES_MES)
    datos: dict[int, dict] = {}

    def entrada(taller_id):
        return datos.setdefault(
            taller_id,
            {"personal": 0, "clientes": 0, "ordenes_mes": 0, "ultimo_uso": None,
             "soporte_vigente_hasta": None},
        )

    for taller_id, total in db.execute(
        _sin_filtro(
            select(Usuario.taller_id, func.count(Usuario.id))
            .where(Usuario.rol.in_(ROLES_PERSONAL), Usuario.activo.is_(True))
            .group_by(Usuario.taller_id)
        )
    ):
        if taller_id is not None:
            entrada(taller_id)["personal"] = total

    for taller_id, total in db.execute(
        _sin_filtro(select(Cliente.taller_id, func.count(Cliente.id)).group_by(Cliente.taller_id))
    ):
        if taller_id is not None:
            entrada(taller_id)["clientes"] = total

    for taller_id, total in db.execute(
        _sin_filtro(
            select(Orden.taller_id, func.count(Orden.id))
            .where(Orden.fecha_ingreso >= limite)
            .group_by(Orden.taller_id)
        )
    ):
        if taller_id is not None:
            entrada(taller_id)["ordenes_mes"] = total

    for taller_id, ultimo in db.execute(
        _sin_filtro(
            select(Auditoria.taller_id, func.max(Auditoria.creado_en)).group_by(Auditoria.taller_id)
        )
    ):
        if taller_id is not None and ultimo is not None:
            entrada(taller_id)["ultimo_uso"] = ultimo

    # Acceso de soporte vigente = la "hasta" más lejana entre los vigentes.
    ahora = datetime.now(timezone.utc)
    for acceso in db.scalars(
        _sin_filtro(select(AccesoSoporte).where(AccesoSoporte.revocado_en.is_(None)))
    ):
        vigente = _a_utc(acceso.desde) <= ahora < _a_utc(acceso.hasta)
        if vigente:
            actual = entrada(acceso.taller_id)["soporte_vigente_hasta"]
            if actual is None or _a_utc(acceso.hasta) > _a_utc(actual):
                entrada(acceso.taller_id)["soporte_vigente_hasta"] = acceso.hasta

    return datos


def _a_utc(dt: datetime) -> datetime:
    """SQLite devuelve datetimes naive aunque la columna sea timezone=True."""
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


def personal_de_taller(db: Session, taller_id: int) -> list[Usuario]:
    """Solo roles del taller (administrador, recepción, mecánico): nunca clientes
    ni el superadmin (que además tiene taller_id NULL)."""
    stmt = (
        select(Usuario)
        .where(Usuario.taller_id == taller_id, Usuario.rol.in_(ROLES_PERSONAL))
        .order_by(Usuario.id)
    )
    return list(db.scalars(stmt))


def ultimos_ingresos(db: Session, emails: list[str]) -> dict[str, datetime]:
    """Último login exitoso por email. La auditoría del login guarda el email
    intentado tal cual vino en el body (puede tener mayúsculas); como el email
    es único global, identificarlo en minúsculas alcanza."""
    if not emails:
        return {}
    email_lower = func.lower(Auditoria.usuario_email)
    stmt = (
        select(email_lower, func.max(Auditoria.creado_en))
        .where(
            Auditoria.ruta == RUTA_LOGIN,
            Auditoria.estado_http == 200,
            email_lower.in_([e.lower() for e in emails]),
        )
        .group_by(email_lower)
    )
    return {email: fecha for email, fecha in db.execute(stmt).all() if email}


def accesos_recientes(db: Session, taller_id: int, limite: int = LIMITE_ACCESOS) -> list[AccesoSoporte]:
    stmt = (
        select(AccesoSoporte)
        .where(AccesoSoporte.taller_id == taller_id)
        .order_by(AccesoSoporte.id.desc())
        .limit(limite)
    )
    return list(db.scalars(stmt))


def get_personal(db: Session, user_id: int) -> Usuario | None:
    """Solo personal del taller (administrador/recepción/mecánico): con un id de
    cliente o de superadmin devuelve None, como si no existiera."""
    user = db.get(Usuario, user_id)
    if user is None or user.rol not in ROLES_PERSONAL:
        return None
    return user
