from fastapi import APIRouter, Request, status

from app.api.v1.publico import service
from app.core.dependencies import DbSession
from app.schemas.publico import ContactoCreate, ContactoRespuesta, PlanPublico

# Tarea L5: planes públicos y formulario de contacto (docs/Landing.md).
# Sin autenticación: no dependen de get_current_user, así que la sesión queda sin
# contexto de taller (y los planes y las solicitudes no son datos de un taller).
router = APIRouter(prefix="/publico", tags=["Público"])


@router.get(
    "/planes",
    response_model=list[PlanPublico],
    summary="Planes activos ordenados por precio",
)
def listar_planes(db: DbSession) -> list[PlanPublico]:
    return service.planes_activos(db)


@router.post(
    "/contacto",
    response_model=ContactoRespuesta,
    status_code=status.HTTP_201_CREATED,
    summary="Pedido de demo desde la landing",
)
def enviar_contacto(data: ContactoCreate, request: Request, db: DbSession) -> ContactoRespuesta:
    # La IP es la de la conexión: detrás de un proxy, uvicorn la toma de
    # X-Forwarded-For solo si el proxy es de confianza (--forwarded-allow-ips).
    # No se lee el header a mano porque cualquiera podría falsearlo y saltear el límite.
    ip = request.client.host if request.client else None
    service.registrar_contacto(db, data, ip)
    return ContactoRespuesta()
