from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.v1.suscripcion import service
from app.core.dependencies import DbSession, PersonalUser, require_roles
from app.models import Usuario
from app.models.usuario import RolUsuario
from app.schemas.suscripcion import (
    CambioPlanRequest,
    PagoSuscripcionResponse,
    PlanResponse,
    SuscripcionResponse,
)

# Suscripción del taller (docs/Suscripciones.md, S1): la ve el personal para el
# aviso de pago; solo el administrador cambia de plan.
router = APIRouter(prefix="/suscripcion", tags=["Suscripción"])

AdminTallerUser = Annotated[
    Usuario, Depends(require_roles(RolUsuario.administrador))
]


@router.get("", response_model=SuscripcionResponse, summary="Suscripción del taller")
def obtener_suscripcion(db: DbSession, _: PersonalUser) -> SuscripcionResponse:
    return service.obtener(db)


@router.get("/planes", response_model=list[PlanResponse], summary="Planes disponibles")
def listar_planes(db: DbSession, _: PersonalUser) -> list[PlanResponse]:
    return service.planes(db)


@router.put("/plan", response_model=SuscripcionResponse, summary="Cambiar de plan")
def cambiar_plan(
    datos: CambioPlanRequest, db: DbSession, usuario: AdminTallerUser
) -> SuscripcionResponse:
    return service.cambiar_plan(db, service.taller_de_sesion(db), datos.plan)


@router.get("/pagos", response_model=list[PagoSuscripcionResponse], summary="Pagos de la suscripción")
def listar_pagos(db: DbSession, _: PersonalUser) -> list[PagoSuscripcionResponse]:
    taller = service.taller_de_sesion(db)
    return service.pagos_del_taller(db, taller.id)
