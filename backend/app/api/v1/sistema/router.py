from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Response

from app.api.v1.sistema.service import sistema_service
from app.core.dependencies import DbSession, SuperAdminUser, require_roles
from app.models import Usuario
from app.models.usuario import RolUsuario
from app.schemas.sistema import SistemaResponse

# Salud de la plataforma y respaldo por taller (contrato en docs/Plataforma.md,
# P3). Los routers ya están montados bajo /api/v1: las rutas son absolutas.
router = APIRouter(prefix="", tags=["Plataforma: sistema"])

AdminTallerUser = Annotated[
    Usuario, Depends(require_roles(RolUsuario.administrador))
]


@router.get("/plataforma/sistema", response_model=SistemaResponse)
def estado_sistema(db: DbSession, _: SuperAdminUser):
    return sistema_service.obtener_estado_sistema(db)


@router.get("/taller/respaldo")
def respaldo_taller(db: DbSession, _: AdminTallerUser):
    """ZIP con los CSV solo del taller del administrador (sesión ya filtrada)."""
    contenido = sistema_service.generar_respaldo(db)
    nombre = f"boxly-respaldo-{datetime.now():%Y%m%d-%H%M}.zip"
    return Response(
        content=contenido,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{nombre}"'},
    )
