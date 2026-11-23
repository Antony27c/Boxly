from datetime import datetime

from fastapi import APIRouter, Response

from app.api.v1.sistema.service import sistema_service
from app.core.dependencies import DbSession, SuperAdminUser
from app.schemas.sistema import SistemaResponse

# Tarea B4: GET /admin/sistema y GET /admin/exportar (contrato en docs/SuperAdmin.md).
router = APIRouter(prefix="/admin", tags=["Superadmin: sistema"])


@router.get("/sistema", response_model=SistemaResponse)
def estado_sistema(db: DbSession, _: SuperAdminUser):
    return sistema_service.obtener_estado_sistema(db)


@router.get("/exportar")
def exportar_respaldo(db: DbSession, _: SuperAdminUser):
    contenido = sistema_service.generar_respaldo(db)
    nombre = f"boxly-respaldo-{datetime.now():%Y%m%d-%H%M}.zip"
    return Response(
        content=contenido,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{nombre}"'},
    )
