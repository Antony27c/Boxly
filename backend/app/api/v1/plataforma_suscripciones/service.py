"""Suscripciones vistas desde la plataforma (superadmin, docs/Suscripciones.md S1
y docs/Oferta.md C2).

Busca el taller por id y delega en ``app.api.v1.suscripcion.service`` (planes,
pagos y vencimiento, la misma lógica que usa el taller), en ``acceso`` (tipo de
acceso) y en ``adicionales``.
"""
from datetime import date

from sqlalchemy.orm import Session

from app.api.v1.plataforma_suscripciones import acceso, adicionales
from app.api.v1.suscripcion import service
from app.models import Usuario
from app.schemas.suscripcion import (
    AccesoTaller,
    AdicionalCreate,
    AdicionalResponse,
    PagoManualCreate,
    PagoSuscripcionResponse,
    PlanResponse,
    PlanUpdate,
    SuscripcionDetalleResponse,
    SuscripcionResponse,
)


def listar_planes(db: Session) -> list[PlanResponse]:
    return service.listar_planes(db)


def actualizar_plan(db: Session, codigo: str, datos: PlanUpdate) -> PlanResponse:
    return service.actualizar_plan(db, codigo, datos)


def suscripcion_taller(db: Session, taller_id: int) -> SuscripcionDetalleResponse:
    return service.suscripcion_con_pagos(db, taller_id)


def cambiar_plan_taller(db: Session, taller_id: int, codigo: str) -> SuscripcionResponse:
    return service.cambiar_plan(db, service.taller_por_id(db, taller_id), codigo)


def registrar_pago(
    db: Session, taller_id: int, datos: PagoManualCreate, usuario: Usuario
) -> PagoSuscripcionResponse:
    taller = service.taller_por_id(db, taller_id)
    pago = service.registrar_pago_manual(db, taller, datos, usuario)
    return service.pago_response(db, pago)


def ajustar_vencimiento(db: Session, taller_id: int, vence_en: date) -> SuscripcionResponse:
    return service.ajustar_vencimiento(db, service.taller_por_id(db, taller_id), vence_en)


def convertir_acceso(
    db: Session, taller_id: int, datos: AccesoTaller, usuario: Usuario
) -> SuscripcionResponse:
    return acceso.convertir(db, taller_id, datos, usuario)


def listar_adicionales(db: Session, taller_id: int) -> list[AdicionalResponse]:
    return adicionales.listar(db, taller_id)


def activar_adicional(
    db: Session, taller_id: int, datos: AdicionalCreate, usuario: Usuario
) -> AdicionalResponse:
    return adicionales.activar(db, taller_id, datos, usuario)


def desactivar_adicional(db: Session, taller_id: int, codigo: str, usuario: Usuario) -> None:
    adicionales.desactivar(db, taller_id, codigo, usuario)
