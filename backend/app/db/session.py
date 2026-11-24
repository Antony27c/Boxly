"""Sesión SQLAlchemy.

La URL de conexión sale de la configuración central (POSTGRES_* / DATABASE_URL).
"""

from collections.abc import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings

settings = get_settings()

_connect_args: dict = {}
_engine_kwargs: dict = {"pool_pre_ping": True}
if settings.database_url.startswith("sqlite"):
    # Necesario para FastAPI + SQLite en el mismo hilo de request.
    _connect_args = {"check_same_thread": False}
    _engine_kwargs = {}

engine = create_engine(
    settings.database_url,
    connect_args=_connect_args,
    **_engine_kwargs,
)

SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
    class_=Session,
)


def get_session() -> Generator[Session, None, None]:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


# --- Aislamiento entre talleres -------------------------------------------------
# session.info["taller_id"] marca el taller de la request:
#   - clave ausente: contexto de sistema (scripts, tests, login, webhook): sin filtro.
#   - int: taller del usuario; cada SELECT de los modelos con datos de taller se
#     filtra por ese taller y las filas nuevas lo heredan.
#   - None: plataforma (superadmin): no ve ninguna fila con datos de un taller; sí
#     ve usuarios, auditoría, accesos de soporte y datos de los talleres.
# Contrato y razones en docs/Plataforma.md.
CLAVE_TALLER = "taller_id"
SIN_FILTRO_TALLER = "sin_filtro_taller"


def fijar_taller(session: Session, taller_id: int | None) -> None:
    """Fija el taller de la sesión (None = plataforma). Ver bloque de arriba."""
    session.info[CLAVE_TALLER] = taller_id


def _criterios(taller_id: int | None):
    from sqlalchemy.orm import with_loader_criteria

    from app.models.auditoria import Auditoria
    from app.models.configuracion_taller import ConfiguracionTaller
    from app.models.taller import AccesoSoporte, TallerMixin
    from app.models.usuario import Usuario

    if taller_id is None:
        # Plataforma: ninguna fila de datos de taller.
        return [with_loader_criteria(TallerMixin, lambda cls: cls.taller_id.is_(None), include_aliases=True)]
    return [
        with_loader_criteria(TallerMixin, lambda cls: cls.taller_id == taller_id, include_aliases=True),
        *(
            with_loader_criteria(modelo, modelo.taller_id == taller_id, include_aliases=True)
            for modelo in (Usuario, Auditoria, ConfiguracionTaller, AccesoSoporte)
        ),
    ]


@event.listens_for(Session, "do_orm_execute")
def _filtrar_por_taller(estado) -> None:
    if (
        not estado.is_select
        or estado.is_column_load
        or CLAVE_TALLER not in estado.session.info
        or estado.execution_options.get(SIN_FILTRO_TALLER, False)
    ):
        return
    estado.statement = estado.statement.options(*_criterios(estado.session.info[CLAVE_TALLER]))


class TallerAjenoError(RuntimeError):
    """Se intentó guardar una fila de otro taller (o de un taller desde la plataforma)."""


@event.listens_for(Session, "before_flush")
def _completar_y_verificar_taller(session: Session, _ctx, _instancias) -> None:
    from app.models.taller import TALLER_PRINCIPAL_ID, TallerMixin
    from app.models.usuario import RolUsuario, Usuario

    hay_contexto = CLAVE_TALLER in session.info
    actual = session.info.get(CLAVE_TALLER)

    for obj in session.new:
        if isinstance(obj, TallerMixin) or (
            isinstance(obj, Usuario) and obj.rol != RolUsuario.superadmin
        ):
            if obj.taller_id is None:
                if hay_contexto and actual is None:
                    raise TallerAjenoError("La plataforma no puede crear datos de un taller")
                # Sin contexto (scripts y tests): el taller principal.
                obj.taller_id = actual if hay_contexto else TALLER_PRINCIPAL_ID
            elif hay_contexto and obj.taller_id != actual:
                raise TallerAjenoError("La fila pertenece a otro taller")

    if hay_contexto:
        for obj in session.dirty:
            if isinstance(obj, TallerMixin) and obj.taller_id != actual:
                raise TallerAjenoError("La fila pertenece a otro taller")
