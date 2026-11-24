"""Schemas de términos y acuerdo de tratamiento de datos (P8, docs/Plataforma.md)."""

from datetime import datetime

from pydantic import BaseModel


class TerminosResponse(BaseModel):
    """Estado de los términos para el taller de la sesión.

    `aceptados_en` y `aceptados_por` vienen en null si el taller todavía no
    aceptó la versión vigente (por ejemplo, cuando `version` subió).
    """

    version: str
    texto: str
    aceptados_en: datetime | None = None
    aceptados_por: str | None = None
