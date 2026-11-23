"""Términos y acuerdo de tratamiento de datos (P8, docs/Plataforma.md)."""

from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import Taller, Usuario

# Versión vigente de los términos. Se sube cuando cambia texto.md de una forma
# que obliga al taller a volver a aceptar (el admin queda bloqueado hasta hacerlo).
TERMINOS_VERSION = "2026-11"


@lru_cache(maxsize=1)
def texto_terminos() -> str:
    """Texto del documento vigente, leído una sola vez por proceso."""
    return (Path(__file__).with_name("texto.md")).read_text(encoding="utf-8").strip()


def _taller_del_usuario(db: Session, usuario: Usuario) -> Taller:
    taller = db.get(Taller, usuario.taller_id)
    if taller is None:
        raise HTTPException(status_code=404, detail="No encontramos el taller del usuario")
    return taller


def _aceptacion_vigente(db: Session, taller: Taller) -> tuple[datetime | None, str | None]:
    """La aceptación solo vale si es de la versión vigente; si no, se reporta pendiente."""
    if taller.terminos_version != TERMINOS_VERSION or taller.terminos_aceptados_en is None:
        return None, None
    aceptados_por = None
    if taller.terminos_aceptados_por_id is not None:
        aceptante = db.get(Usuario, taller.terminos_aceptados_por_id)
        aceptados_por = aceptante.email if aceptante else None
    return taller.terminos_aceptados_en, aceptados_por


def obtener(db: Session, usuario: Usuario) -> dict:
    taller = _taller_del_usuario(db, usuario)
    aceptados_en, aceptados_por = _aceptacion_vigente(db, taller)
    return {
        "version": TERMINOS_VERSION,
        "texto": texto_terminos(),
        "aceptados_en": aceptados_en,
        "aceptados_por": aceptados_por,
    }


def aceptar(db: Session, usuario: Usuario) -> dict:
    """Registra la aceptación del administrador. Idempotente: si el taller ya
    aceptó la versión vigente no se reescribe la fecha ni el aceptante."""
    taller = _taller_del_usuario(db, usuario)
    if taller.terminos_version != TERMINOS_VERSION or taller.terminos_aceptados_en is None:
        taller.terminos_version = TERMINOS_VERSION
        taller.terminos_aceptados_en = datetime.now(timezone.utc)
        taller.terminos_aceptados_por_id = usuario.id
        db.commit()
        db.refresh(taller)
    return obtener(db, usuario)
