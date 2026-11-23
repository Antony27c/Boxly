import secrets
import string
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.api.v1.plataforma_talleres import repository
from app.api.v1.users import repository as users_repository
from app.core.security import hash_password
from app.db.session import fijar_taller
from app.models import AccesoSoporte, ConfiguracionTaller, Taller, Usuario
from app.models.usuario import RolUsuario
from app.schemas.paginacion import ParametrosPagina
from app.schemas.plataforma import (
    AccesoSoporteResponse,
    OtorganteSoporte,
    PasswordTemporalResponse,
    PersonalTaller,
    SesionesResponse,
    TallerAltaResponse,
    TallerCreate,
    TallerDetalle,
    TallerRenombrar,
    TallerResumen,
)

_LONGITUD_PASSWORD = 12


def _password_temporal() -> str:
    """12 caracteres con al menos una letra y un número (contrato P1)."""
    caracteres = [
        secrets.choice(string.ascii_letters),
        secrets.choice(string.digits),
        *(
            secrets.choice(string.ascii_letters + string.digits)
            for _ in range(_LONGITUD_PASSWORD - 2)
        ),
    ]
    secrets.SystemRandom().shuffle(caracteres)
    return "".join(caracteres)


def _a_utc(dt: datetime) -> datetime:
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


def _es_vigente(acceso: AccesoSoporte, ahora: datetime) -> bool:
    return _a_utc(acceso.desde) <= ahora < _a_utc(acceso.hasta) and acceso.revocado_en is None


def _acceso_response(db: Session, acceso: AccesoSoporte, ahora: datetime) -> AccesoSoporteResponse:
    otorgante = db.get(Usuario, acceso.otorgado_por_id) if acceso.otorgado_por_id else None
    return AccesoSoporteResponse(
        id=acceso.id,
        taller_id=acceso.taller_id,
        otorgado_por=(
            OtorganteSoporte(
                nombre=f"{otorgante.nombre} {otorgante.apellido}".strip(),
                email=otorgante.email,
            )
            if otorgante
            else None
        ),
        motivo=acceso.motivo,
        desde=acceso.desde,
        hasta=acceso.hasta,
        revocado_en=acceso.revocado_en,
        vigente=_es_vigente(acceso, ahora),
    )


def _resumen(db: Session, taller: Taller, conteos: dict[int, dict]) -> TallerResumen:
    c = conteos.get(taller.id, {})
    return TallerResumen(
        id=taller.id,
        nombre=taller.nombre,
        estado=taller.estado,
        creado_en=taller.creado_en,
        suspendido_en=taller.suspendido_en,
        personal=c.get("personal", 0),
        clientes=c.get("clientes", 0),
        ordenes_mes=c.get("ordenes_mes", 0),
        ultimo_uso=c.get("ultimo_uso"),
        soporte_vigente_hasta=c.get("soporte_vigente_hasta"),
        terminos_aceptados_en=taller.terminos_aceptados_en,
    )


def _taller_o_404(db: Session, taller_id: int) -> Taller:
    taller = repository.get_taller(db, taller_id)
    if taller is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Taller no encontrado")
    return taller


def listar_talleres(
    db: Session,
    *,
    estado: str | None,
    q: str | None,
    pagina: ParametrosPagina | None,
) -> tuple[list[TallerResumen], int]:
    talleres, total = repository.listar_talleres(db, estado=estado, q=q, pagina=pagina)
    conteos = repository.conteos_por_taller(db)
    return [_resumen(db, t, conteos) for t in talleres], total


def detalle(db: Session, taller_id: int) -> TallerDetalle:
    taller = _taller_o_404(db, taller_id)
    conteos = repository.conteos_por_taller(db)
    base = _resumen(db, taller, conteos)

    personal = repository.personal_de_taller(db, taller.id)
    ingresos = repository.ultimos_ingresos(db, [u.email for u in personal])
    lista = [
        PersonalTaller(
            id=u.id,
            nombre=u.nombre,
            apellido=u.apellido,
            email=u.email,
            rol=u.rol,
            activo=u.activo,
            ultimo_ingreso=ingresos.get(u.email),
        )
        for u in personal
    ]

    ahora = datetime.now(timezone.utc)
    accesos = [
        _acceso_response(db, a, ahora)
        for a in repository.accesos_recientes(db, taller.id)
    ]

    return TallerDetalle(
        **base.model_dump(exclude={"personal"}),
        personal=lista,
        accesos_soporte=accesos,
    )


def crear_taller(db: Session, data: TallerCreate) -> TallerAltaResponse:
    """Alta completa: taller + su configuracion_taller + primer administrador
    con contraseña temporal. Todo con taller_id explícito (contexto plataforma)."""
    if users_repository.email_existe(db, data.admin.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un usuario con ese email",
        )

    temporal = _password_temporal()
    taller = repository.crear_taller(db, nombre=data.nombre.strip())
    # La guardia de taller_id (app.db.session) no deja crear datos de un taller
    # desde la plataforma: se fija el taller recién creado un instante y se
    # vuelve a contexto plataforma apenas commitea.
    fijar_taller(db, taller.id)
    try:
        db.add(ConfiguracionTaller(taller_id=taller.id, nombre=taller.nombre))
        admin = Usuario(
            nombre=data.admin.nombre.strip(),
            apellido=data.admin.apellido.strip(),
            email=data.admin.email.lower().strip(),
            password_hash=hash_password(temporal),
            rol=RolUsuario.administrador,
            taller_id=taller.id,
            activo=True,
        )
        db.add(admin)
        db.commit()
    finally:
        fijar_taller(db, None)
    db.refresh(taller)

    resumen = _resumen(db, taller, repository.conteos_por_taller(db))
    return TallerAltaResponse(
        taller=resumen,
        admin_email=admin.email,
        password_temporal=temporal,
    )


def renombrar(db: Session, taller_id: int, data: TallerRenombrar) -> TallerResumen:
    taller = _taller_o_404(db, taller_id)
    taller = repository.actualizar_taller(db, taller, nombre=data.nombre.strip())
    return _resumen(db, taller, repository.conteos_por_taller(db))


def suspender(db: Session, taller_id: int) -> TallerResumen:
    taller = _taller_o_404(db, taller_id)
    taller = repository.cambiar_estado(db, taller, "suspendido")
    return _resumen(db, taller, repository.conteos_por_taller(db))


def reactivar(db: Session, taller_id: int) -> TallerResumen:
    taller = _taller_o_404(db, taller_id)
    taller = repository.cambiar_estado(db, taller, "activo")
    return _resumen(db, taller, repository.conteos_por_taller(db))


def restablecer_password(db: Session, user_id: int) -> PasswordTemporalResponse:
    """Nueva contraseña temporal y token_version +1: cierra las sesiones."""
    user = repository.get_personal(db, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
    temporal = _password_temporal()
    users_repository.update(
        db,
        user,
        {
            "password_hash": hash_password(temporal),
            "token_version": user.token_version + 1,
        },
    )
    return PasswordTemporalResponse(password_temporal=temporal)


def cerrar_sesiones(db: Session, user_id: int) -> SesionesResponse:
    """Solo sube token_version: los JWT emitidos antes quedan inválidos."""
    user = repository.get_personal(db, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
    users_repository.update(db, user, {"token_version": user.token_version + 1})
    return SesionesResponse(detail=f"Se cerraron las sesiones de {user.email}")
