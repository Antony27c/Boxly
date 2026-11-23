from fastapi import APIRouter

from app.api.v1.auth.router import router as auth_router
from app.api.v1.clientes.router import router as clientes_router
from app.api.v1.users.router import router as users_router
from app.api.v1.ordenes.router import router as ordenes_router
from app.api.v1.pagos.router import router as pagos_router
from app.api.v1.portal.router import router as portal_router
from app.api.v1.repuestos.router import router as repuestos_router
from app.api.v1.turnos.router import router as turnos_router
from app.api.v1.vehiculos.router import router as vehiculos_router
from app.api.v1.catalogo.router import router as catalogo_router
from app.api.v1.metricas.router import router as metricas_router
from app.api.v1.mecanicos.router import router as mecanicos_router
from app.api.v1.admin_auditoria.router import router as admin_auditoria_router
from app.api.v1.sistema.router import router as sistema_router
from app.api.v1.taller.router import router as taller_router
from app.api.v1.plataforma_talleres.router import router as plataforma_talleres_router
from app.api.v1.soporte.router import router as soporte_router
from app.api.v1.terminos.router import router as terminos_router
from app.api.v1.publico.router import router as publico_router
from app.api.v1.suscripcion.router import router as suscripcion_router
from app.api.v1.suscripcion_mp.router import router as suscripcion_mp_router
from app.api.v1.plataforma_suscripciones.router import router as plataforma_suscripciones_router

api_router = APIRouter()
api_router.include_router(auth_router, prefix="/api/v1")
api_router.include_router(users_router, prefix="/api/v1")
api_router.include_router(clientes_router, prefix="/api/v1")
api_router.include_router(vehiculos_router, prefix="/api/v1")
api_router.include_router(repuestos_router, prefix="/api/v1")
api_router.include_router(turnos_router, prefix="/api/v1")
api_router.include_router(ordenes_router, prefix="/api/v1/ordenes", tags=["Ordenes"])
api_router.include_router(catalogo_router, prefix="/api/v1")
api_router.include_router(metricas_router,prefix="/api/v1")
api_router.include_router(portal_router, prefix="/api/v1")
api_router.include_router(pagos_router, prefix="/api/v1")
api_router.include_router(mecanicos_router, prefix="/api/v1")
api_router.include_router(admin_auditoria_router, prefix="/api/v1")
api_router.include_router(sistema_router, prefix="/api/v1")
api_router.include_router(taller_router, prefix="/api/v1")
api_router.include_router(plataforma_talleres_router, prefix="/api/v1")
api_router.include_router(soporte_router, prefix="/api/v1")
api_router.include_router(terminos_router, prefix="/api/v1")
api_router.include_router(suscripcion_router, prefix="/api/v1")
api_router.include_router(suscripcion_mp_router, prefix="/api/v1")
api_router.include_router(plataforma_suscripciones_router, prefix="/api/v1")
api_router.include_router(publico_router, prefix="/api/v1")
