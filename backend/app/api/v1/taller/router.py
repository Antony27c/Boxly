from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.v1.taller import service
from app.core.dependencies import CurrentUser, DbSession, require_roles
from app.models import Usuario
from app.models.usuario import RolUsuario
from app.schemas.taller import TallerResponse, TallerUpdate

# Datos del taller de la sesión (contrato en docs/Plataforma.md, P3): lectura
# para cualquier usuario del taller, edición solo del administrador. El
# superadmin recibe 403 salvo en modo soporte (lo resuelve P2 en dependencies).
router = APIRouter(prefix="/taller", tags=["Taller"])

AdminTallerUser = Annotated[
    Usuario, Depends(require_roles(RolUsuario.administrador))
]


@router.get("", response_model=TallerResponse, summary="Datos del taller")
def obtener_taller(db: DbSession, usuario: CurrentUser) -> TallerResponse:
    return service.obtener(db)


@router.put("", response_model=TallerResponse, summary="Actualizar datos del taller")
def actualizar_taller(
    datos: TallerUpdate, db: DbSession, usuario: AdminTallerUser
) -> TallerResponse:
    return service.actualizar(db, usuario, datos)
