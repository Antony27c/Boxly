"""Schemas de la encuesta de fin de la demo (docs/Oferta.md, tarea C6)."""
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

IntencionEncuesta = Literal["contratar", "tal_vez", "no"]


class EncuestaDemoCreate(BaseModel):
    """Lo que manda el administrador: la respuesta completa o ``{salteada: true}``.

    Los textos y el puntaje son opcionales; ``intencion`` y ``salteada``
    tienen sus valores del contrato (docs/Oferta.md).
    """

    gusto: Optional[str] = Field(default=None, max_length=1000)
    mejoras: Optional[str] = Field(default=None, max_length=1000)
    sugerencias: Optional[str] = Field(default=None, max_length=1000)
    puntaje: Optional[int] = Field(default=None, ge=1, le=5)
    intencion: Optional[IntencionEncuesta] = None
    salteada: bool = False


class EncuestaEstadoResponse(BaseModel):
    """GET /suscripcion/encuesta: si hay que mostrarla y si ya se cerró."""

    corresponde: bool
    respondida: bool


class EncuestaDemoResponse(BaseModel):
    """Una fila de la encuesta: la ve el taller (POST) y la plataforma (GET)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    taller_id: int
    # Solo lo completa el listado de plataforma.
    taller_nombre: Optional[str] = None
    respondida_por_id: Optional[int] = None
    respondida_por: Optional[str] = None
    gusto: Optional[str] = None
    mejoras: Optional[str] = None
    sugerencias: Optional[str] = None
    puntaje: Optional[int] = None
    intencion: Optional[str] = None
    salteada: bool
    creado_en: datetime
