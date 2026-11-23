from fastapi import APIRouter, status

from app.api.v1.plataforma_suscripciones import service
from app.core.dependencies import DbSession, SuperAdminUser
from app.schemas.suscripcion import (
    CambioPlanRequest,
    PagoManualCreate,
    PagoSuscripcionResponse,
    PlanResponse,
    PlanUpdate,
    SuscripcionDetalleResponse,
    SuscripcionResponse,
    VencimientoUpdate,
)

# Suscripciones desde la plataforma (docs/Suscripciones.md, S1): solo superadmin.
# El router ya está montado bajo /api/v1: las rutas son absolutas.
router = APIRouter(prefix="/plataforma", tags=["Plataforma: suscripciones"])


@router.get("/planes", response_model=list[PlanResponse], summary="Todos los planes")
def listar_planes(db: DbSession, _: SuperAdminUser) -> list[PlanResponse]:
    return service.listar_planes(db)


@router.put("/planes/{codigo}", response_model=PlanResponse, summary="Editar un plan")
def actualizar_plan(
    codigo: str, datos: PlanUpdate, db: DbSession, _: SuperAdminUser
) -> PlanResponse:
    return service.actualizar_plan(db, codigo, datos)


@router.get(
    "/talleres/{taller_id}/suscripcion",
    response_model=SuscripcionDetalleResponse,
    summary="Suscripción de un taller",
)
def suscripcion_taller(
    taller_id: int, db: DbSession, _: SuperAdminUser
) -> SuscripcionDetalleResponse:
    return service.suscripcion_taller(db, taller_id)


@router.put(
    "/talleres/{taller_id}/plan",
    response_model=SuscripcionResponse,
    summary="Cambiar el plan de un taller",
)
def cambiar_plan_taller(
    taller_id: int, datos: CambioPlanRequest, db: DbSession, _: SuperAdminUser
) -> SuscripcionResponse:
    return service.cambiar_plan_taller(db, taller_id, datos.plan)


@router.post(
    "/talleres/{taller_id}/pagos",
    response_model=PagoSuscripcionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar un pago manual de la suscripción",
)
def registrar_pago(
    taller_id: int,
    datos: PagoManualCreate,
    db: DbSession,
    usuario: SuperAdminUser,
) -> PagoSuscripcionResponse:
    return service.registrar_pago(db, taller_id, datos, usuario)


@router.post(
    "/talleres/{taller_id}/vencimiento",
    response_model=SuscripcionResponse,
    summary="Ajustar el vencimiento de la suscripción",
)
def ajustar_vencimiento(
    taller_id: int,
    datos: VencimientoUpdate,
    db: DbSession,
    _: SuperAdminUser,
) -> SuscripcionResponse:
    return service.ajustar_vencimiento(db, taller_id, datos.vence_en)
