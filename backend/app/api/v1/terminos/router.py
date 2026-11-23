from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.v1.terminos import service
from app.core.dependencies import DbSession, PersonalUser, require_roles
from app.models.usuario import RolUsuario, Usuario
from app.schemas.terminos import TerminosResponse

# Términos y acuerdo de tratamiento de datos (P8, docs/Plataforma.md):
# lectura para todo el personal del taller; la aceptación es solo del administrador.
router = APIRouter(prefix="/terminos", tags=["Términos"])

AdminTallerUser = Annotated[Usuario, Depends(require_roles(RolUsuario.administrador))]


@router.get("", response_model=TerminosResponse, summary="Términos vigentes y estado de aceptación del taller")
def obtener_terminos(db: DbSession, usuario: PersonalUser) -> dict:
    return service.obtener(db, usuario)


@router.post("/aceptar", response_model=TerminosResponse, summary="Aceptar los términos vigentes en nombre del taller")
def aceptar_terminos(db: DbSession, usuario: AdminTallerUser) -> dict:
    return service.aceptar(db, usuario)
