from fastapi import APIRouter

from app.api.v1.taller import service
from app.core.dependencies import CurrentUser, DbSession, SuperAdminUser
from app.models import ConfiguracionTaller, Usuario
from app.schemas.taller import TallerResponse, TallerUpdate

# Datos del taller (contrato en docs/SuperAdmin.md): lectura para cualquier
# usuario con sesión, edición solo del superadmin.
router = APIRouter(prefix="/taller", tags=["Taller"])


@router.get("", response_model=TallerResponse, summary="Datos del taller")
def obtener_taller(db: DbSession, usuario: CurrentUser) -> ConfiguracionTaller:
    return service.obtener(db)


@router.put("", response_model=TallerResponse, summary="Actualizar datos del taller")
def actualizar_taller(
    datos: TallerUpdate, db: DbSession, usuario: SuperAdminUser
) -> ConfiguracionTaller:
    return service.actualizar(db, usuario, datos)
