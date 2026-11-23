from fastapi import APIRouter

from app.api.v1.admin_cuentas import service
from app.core.dependencies import DbSession, SuperAdminUser
from app.schemas.admin_cuentas import PasswordTemporalResponse, SesionesResponse

# Rutas de superadmin para cuentas (contrato en docs/SuperAdmin.md, sección B1).
router = APIRouter(prefix="/admin/usuarios", tags=["Superadmin: cuentas"])


@router.post(
    "/{user_id}/restablecer-password",
    response_model=PasswordTemporalResponse,
    summary="Restablecer la contraseña de un usuario",
)
def restablecer_password(
    user_id: int,
    db: DbSession,
    _: SuperAdminUser,
) -> PasswordTemporalResponse:
    return service.restablecer_password(db, user_id)


@router.post(
    "/{user_id}/cerrar-sesiones",
    response_model=SesionesResponse,
    summary="Cerrar todas las sesiones de un usuario",
)
def cerrar_sesiones(
    user_id: int,
    db: DbSession,
    _: SuperAdminUser,
) -> SesionesResponse:
    return service.cerrar_sesiones(db, user_id)
