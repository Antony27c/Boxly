"""Lógica del acceso de soporte (tarea P2, contrato en docs/Plataforma.md).

Regla legal de fondo: el superadmin solo ve datos de un taller si el taller
se los autorizó con un AccesoSoporte vigente. Las fechas de SQLite vuelven
sin zona horaria, así que todas las comparaciones se hacen en UTC.
"""
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.soporte import repository
from app.models.taller import AccesoSoporte, Taller
from app.models.usuario import Usuario
from app.schemas.auditoria import AuditoriaResponse
from app.schemas.paginacion import ParametrosPagina
from app.schemas.soporte import (
    AccesoSoporteCreate,
    AccesoSoporteResponse,
    AccesoSoporteVigentePlataforma,
    OtorganteSoporte,
)


def _ahora_utc() -> datetime:
    return datetime.now(timezone.utc)


def _a_utc(fecha: datetime) -> datetime:
    """Naive (SQLite) se asume UTC; aware se convierte a UTC."""
    if fecha.tzinfo is None:
        return fecha.replace(tzinfo=timezone.utc)
    return fecha.astimezone(timezone.utc)


def es_vigente(acceso: AccesoSoporte, ahora: datetime | None = None) -> bool:
    """Vigente = no revocado y dentro de la ventana [desde, hasta)."""
    if acceso.revocado_en is not None:
        return False
    ahora = _a_utc(ahora or _ahora_utc())
    return _a_utc(acceso.desde) <= ahora < _a_utc(acceso.hasta)


def _otorgante(db: Session, acceso: AccesoSoporte) -> OtorganteSoporte | None:
    if acceso.otorgado_por_id is None:
        return None
    usuario = db.get(Usuario, acceso.otorgado_por_id)
    if usuario is None:
        return None
    return OtorganteSoporte(
        nombre=f"{usuario.nombre} {usuario.apellido}", email=usuario.email
    )


def _response(db: Session, acceso: AccesoSoporte) -> AccesoSoporteResponse:
    return AccesoSoporteResponse(
        id=acceso.id,
        taller_id=acceso.taller_id,
        otorgado_por=_otorgante(db, acceso),
        motivo=acceso.motivo,
        desde=acceso.desde,
        hasta=acceso.hasta,
        revocado_en=acceso.revocado_en,
        vigente=es_vigente(acceso),
    )


def listar_accesos(db: Session) -> list[AccesoSoporteResponse]:
    return [_response(db, a) for a in repository.listar_accesos(db)]


def otorgar(
    db: Session, usuario: Usuario, datos: AccesoSoporteCreate
) -> AccesoSoporteResponse:
    """El administrador del taller autoriza al superadmin por `horas`."""
    if any(
        es_vigente(a) for a in repository.candidatos_vigentes(db, usuario.taller_id)
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya hay un acceso de soporte vigente",
        )
    ahora = _ahora_utc()
    acceso = AccesoSoporte(
        taller_id=usuario.taller_id,
        otorgado_por_id=usuario.id,
        motivo=datos.motivo,
        desde=ahora,
        hasta=ahora + timedelta(hours=datos.horas),
    )
    db.add(acceso)
    db.commit()
    db.refresh(acceso)
    return _response(db, acceso)


def revocar(db: Session, usuario: Usuario, acceso_id: int) -> AccesoSoporteResponse:
    """Corta el acceso antes de tiempo. Uno ajeno o inexistente: 404."""
    acceso = repository.obtener_acceso(db, acceso_id)
    if acceso is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Acceso de soporte no encontrado",
        )
    if acceso.revocado_en is None:
        acceso.revocado_en = _ahora_utc()
        acceso.revocado_por_id = usuario.id
        db.commit()
        db.refresh(acceso)
    return _response(db, acceso)


def actividad(
    db: Session, pagina: ParametrosPagina
) -> tuple[list[AuditoriaResponse], int]:
    """Auditoría del taller con soporte=true (lo que hizo el superadmin adentro)."""
    items = repository.listar_actividad(db, pagina)
    total = repository.contar_actividad(db)
    return [AuditoriaResponse.model_validate(a) for a in items], total


def vigentes_plataforma(db: Session) -> list[AccesoSoporteVigentePlataforma]:
    """Accesos vigentes de todos los talleres (contexto plataforma)."""
    stmt = (
        select(AccesoSoporte, Taller.nombre)
        .join(Taller, Taller.id == AccesoSoporte.taller_id)
        .where(AccesoSoporte.revocado_en.is_(None))
        .order_by(AccesoSoporte.hasta)
    )
    ahora = _ahora_utc()
    return [
        AccesoSoporteVigentePlataforma(
            taller_id=acceso.taller_id,
            taller_nombre=nombre,
            hasta=acceso.hasta,
            motivo=acceso.motivo,
        )
        for acceso, nombre in db.execute(stmt).all()
        if es_vigente(acceso, ahora)
    ]
