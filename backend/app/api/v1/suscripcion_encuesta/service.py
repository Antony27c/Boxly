"""Encuesta de fin de la demo del taller de la sesión (docs/Oferta.md, C6).

``EncuestaDemo`` no usa ``TallerMixin``: el taller sale de la sesión y el
``taller_id`` se escribe a mano (una fila por taller, ``unique``).
"""
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.v1.suscripcion.service import taller_de_sesion
from app.core.suscripcion import ACCESO_DEMO, dias_vencida
from app.models import EncuestaDemo, Taller, Usuario
from app.schemas.encuesta import (
    EncuestaDemoCreate,
    EncuestaDemoResponse,
    EncuestaEstadoResponse,
)

_MSG_YA_RESPONDIDA = "La encuesta ya fue respondida"


def _encuesta_del_taller(db: Session, taller_id: int) -> EncuestaDemo | None:
    return db.scalar(
        select(EncuestaDemo).where(EncuestaDemo.taller_id == taller_id)
    )


def _corresponde(taller: Taller, encuesta: EncuestaDemo | None) -> bool:
    """La encuesta aparece solo para una demo vencida que todavía no la cerró
    (ni respondiendo ni salteando)."""
    return (
        taller.tipo_acceso == ACCESO_DEMO
        and dias_vencida(taller.suscripcion_vence_en) > 0
        and encuesta is None
    )


def estado(db: Session) -> EncuestaEstadoResponse:
    taller = taller_de_sesion(db)
    encuesta = _encuesta_del_taller(db, taller.id)
    return EncuestaEstadoResponse(
        corresponde=_corresponde(taller, encuesta),
        respondida=encuesta is not None,
    )


def responder(
    db: Session, usuario: Usuario, datos: EncuestaDemoCreate
) -> EncuestaDemoResponse:
    """Registra la respuesta (o el salteo) del taller. Una sola vez: la segunda
    llega al 409 del contrato, también si dos requests pisan el unique."""
    taller = taller_de_sesion(db)
    if _encuesta_del_taller(db, taller.id) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=_MSG_YA_RESPONDIDA
        )
    if not _corresponde(taller, None):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="La encuesta no corresponde a este taller",
        )
    encuesta = EncuestaDemo(
        taller_id=taller.id,
        respondida_por_id=usuario.id,
        gusto=datos.gusto,
        mejoras=datos.mejoras,
        sugerencias=datos.sugerencias,
        puntaje=datos.puntaje,
        intencion=datos.intencion,
        salteada=datos.salteada,
    )
    db.add(encuesta)
    try:
        db.commit()
    except IntegrityError:
        # Dos submits simultáneos: el unique de taller_id decide.
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=_MSG_YA_RESPONDIDA
        ) from None
    db.refresh(encuesta)
    respuesta = EncuestaDemoResponse.model_validate(encuesta)
    respuesta.taller_nombre = taller.nombre
    return respuesta
