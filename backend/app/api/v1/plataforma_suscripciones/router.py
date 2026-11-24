from fastapi import APIRouter, Response, status

from app.api.v1.plataforma_suscripciones import service
from app.core.dependencies import DbSession, SuperAdminUser
from app.schemas.suscripcion import (
    AccesoTaller,
    AdicionalCreate,
    AdicionalResponse,
    CambioPlanRequest,
    PagoManualCreate,
    PagoSuscripcionResponse,
    PlanResponse,
    PlanUpdate,
    SuscripcionDetalleResponse,
    SuscripcionResponse,
    VencimientoUpdate,
)

# Suscripciones desde la plataforma (docs/Suscripciones.md, S1, y docs/Oferta.md,
# C2: tipo de acceso y adicionales): solo superadmin.
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


@router.post(
    "/talleres/{taller_id}/acceso",
    response_model=SuscripcionResponse,
    summary="Convertir el tipo de acceso de un taller",
)
def convertir_acceso(
    taller_id: int, datos: AccesoTaller, db: DbSession, usuario: SuperAdminUser
) -> SuscripcionResponse:
    return service.convertir_acceso(db, taller_id, datos, usuario)


@router.get(
    "/talleres/{taller_id}/adicionales",
    response_model=list[AdicionalResponse],
    summary="Adicionales de un taller",
)
def listar_adicionales(
    taller_id: int, db: DbSession, _: SuperAdminUser
) -> list[AdicionalResponse]:
    return service.listar_adicionales(db, taller_id)


@router.post(
    "/talleres/{taller_id}/adicionales",
    response_model=AdicionalResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Activar un adicional",
)
def activar_adicional(
    taller_id: int, datos: AdicionalCreate, db: DbSession, usuario: SuperAdminUser
) -> AdicionalResponse:
    return service.activar_adicional(db, taller_id, datos, usuario)


@router.delete(
    "/talleres/{taller_id}/adicionales/{codigo}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Desactivar un adicional",
)
def desactivar_adicional(
    taller_id: int, codigo: str, db: DbSession, usuario: SuperAdminUser
) -> Response:
    service.desactivar_adicional(db, taller_id, codigo, usuario)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
