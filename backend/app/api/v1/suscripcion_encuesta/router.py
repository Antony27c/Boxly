"""Encuesta de fin de la demo (docs/Oferta.md, tarea C6).

Solo el administrador del taller. Las rutas quedan bajo ``/suscripcion``, que
``PREFIJOS_LIBRES`` deja pasar aunque el taller esté en solo lectura o
suspendido: la encuesta se responde igual.
"""
from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.v1.suscripcion_encuesta import service
from app.core.dependencies import DbSession, require_roles
from app.models import Usuario
from app.models.usuario import RolUsuario
from app.schemas.encuesta import (
    EncuestaDemoCreate,
    EncuestaDemoResponse,
    EncuestaEstadoResponse,
)

router = APIRouter(prefix="/suscripcion", tags=["Suscripción"])

AdminTallerUser = Annotated[
    Usuario, Depends(require_roles(RolUsuario.administrador))
]


@router.get(
    "/encuesta",
    response_model=EncuestaEstadoResponse,
    summary="Si la encuesta de fin de demo corresponde y si ya se respondió",
)
def obtener_encuesta(db: DbSession, _: AdminTallerUser) -> EncuestaEstadoResponse:
    return service.estado(db)


@router.post(
    "/encuesta",
    response_model=EncuestaDemoResponse,
    status_code=201,
    summary="Responder o saltear la encuesta de fin de demo",
)
def responder_encuesta(
    datos: EncuestaDemoCreate, db: DbSession, usuario: AdminTallerUser
) -> EncuestaDemoResponse:
    return service.responder(db, usuario, datos)
