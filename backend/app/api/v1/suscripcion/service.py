"""Suscripción del taller de la sesión y lógica compartida con la plataforma.

``PagoSuscripcion`` tiene ``taller_id`` pero no usa ``TallerMixin``: el filtro
automático de app.db.session no lo cubre, así que TODA consulta filtra por el
taller explícitamente (docs/Suscripciones.md, S1).
"""
from datetime import date, timedelta

from dateutil.relativedelta import relativedelta
from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.suscripcion import estado_suscripcion
from app.db.session import CLAVE_TALLER
from app.models import PagoSuscripcion, Plan, Taller, Usuario
from app.models.usuario import ROLES_PERSONAL
from app.schemas.suscripcion import (
    PagoSuscripcionResponse,
    PagoManualCreate,
    PlanResponse,
    SuscripcionDetalleResponse,
    SuscripcionResponse,
)

_MSG_SIN_PERMISO = "No tenés permisos para esta acción"


def taller_de_sesion(db: Session) -> Taller:
    """El taller de la sesión actual. Sin taller (plataforma/sistema) no hay
    suscripción que mostrar: el superadmin opera por /plataforma."""
    taller_id = db.info.get(CLAVE_TALLER)
    if taller_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=_MSG_SIN_PERMISO)
    taller = db.get(Taller, taller_id)
    if taller is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Taller no encontrado")
    return taller


def taller_por_id(db: Session, taller_id: int) -> Taller:
    taller = db.get(Taller, taller_id)
    if taller is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Taller no encontrado")
    return taller


def personal_activo(db: Session, taller_id: int) -> int:
    """Personal activo del taller (admin, recepción, mecánico; nunca clientes)."""
    return (
        db.scalar(
            select(func.count(Usuario.id)).where(
                Usuario.taller_id == taller_id,
                Usuario.rol.in_(ROLES_PERSONAL),
                Usuario.activo.is_(True),
            )
        )
        or 0
    )


def _plan_o_404(db: Session, codigo: str, *, solo_activos: bool) -> Plan:
    plan = db.get(Plan, codigo)
    if plan is None or (solo_activos and not plan.activo):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan no encontrado")
    return plan


def armar_suscripcion(db: Session, taller: Taller) -> SuscripcionResponse:
    """SuscripcionResponse del taller: la usa el taller y también la plataforma."""
    plan = db.get(Plan, taller.plan_codigo)
    if plan is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan no encontrado")
    vence_en = taller.suscripcion_vence_en
    return SuscripcionResponse(
        plan=PlanResponse.model_validate(plan),
        vence_en=vence_en,
        estado=estado_suscripcion(vence_en),
        dias_para_vencer=(vence_en - date.today()).days if vence_en else 0,
        cobro_automatico=taller.cobro_automatico,
        personal_activo=personal_activo(db, taller.id),
        max_personal=plan.max_personal,
        proximo_monto=plan.precio_mensual,
    )


# --- Lado del taller ---------------------------------------------------------


def obtener(db: Session) -> SuscripcionResponse:
    return armar_suscripcion(db, taller_de_sesion(db))


def planes(db: Session) -> list[PlanResponse]:
    """Planes activos para que el taller elija el suyo."""
    stmt = select(Plan).where(Plan.activo.is_(True)).order_by(Plan.codigo)
    return [PlanResponse.model_validate(p) for p in db.scalars(stmt)]


def _exigir_cupo_plan(db: Session, taller: Taller, plan: Plan) -> None:
    """Bajar a un plan con menos lugar que el personal activo: 409 del contrato."""
    if plan.max_personal is not None and personal_activo(db, taller.id) > plan.max_personal:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Tu personal activo supera el límite de ese plan",
        )


def cambiar_plan(db: Session, taller: Taller, codigo: str) -> SuscripcionResponse:
    """Cambio de plan compartido por el taller y por la plataforma.

    Rige ya; el precio nuevo se cobra desde el próximo período. Solo planes
    activos: uno inactivo o inexistente responde 404."""
    plan = _plan_o_404(db, codigo, solo_activos=True)
    _exigir_cupo_plan(db, taller, plan)
    taller.plan_codigo = plan.codigo
    db.add(taller)
    db.commit()
    db.refresh(taller)
    if taller.cobro_automatico:
        # La preapproval de Mercado Pago cobra el precio del plan: se actualiza
        # el monto. Import perezoso para no acoplar los módulos; la función
        # devuelve bool y nunca rompe el cambio de plan (docs/Suscripciones.md S2).
        from app.api.v1.suscripcion_mp.service import actualizar_monto_preapproval

        actualizar_monto_preapproval(taller, plan)
    return armar_suscripcion(db, taller)


def pagos_del_taller(db: Session, taller_id: int) -> list[PagoSuscripcionResponse]:
    """Pagos de la suscripción del taller, más nuevo primero."""
    stmt = (
        select(PagoSuscripcion)
        .where(PagoSuscripcion.taller_id == taller_id)
        .order_by(PagoSuscripcion.id.desc())
    )
    pagos = list(db.scalars(stmt))
    ids_registro = {p.registrado_por_id for p in pagos if p.registrado_por_id}
    nombres = {
        u.id: f"{u.nombre} {u.apellido}".strip()
        for u in db.scalars(select(Usuario).where(Usuario.id.in_(ids_registro)))
    } if ids_registro else {}
    return [
        PagoSuscripcionResponse(
            id=p.id,
            monto=p.monto,
            periodo_desde=p.periodo_desde,
            periodo_hasta=p.periodo_hasta,
            medio=p.medio,
            estado=p.estado,
            referencia=p.referencia,
            registrado_por=(
                nombres.get(p.registrado_por_id) if p.registrado_por_id else None
            ),
            creado_en=p.creado_en,
        )
        for p in pagos
    ]


# --- Lado de la plataforma ----------------------------------------------------


def listar_planes(db: Session) -> list[PlanResponse]:
    """Todos los planes, activos e inactivos (superadmin)."""
    stmt = select(Plan).order_by(Plan.codigo)
    return [PlanResponse.model_validate(p) for p in db.scalars(stmt)]


def actualizar_plan(db: Session, codigo: str, datos) -> PlanResponse:
    plan = _plan_o_404(db, codigo, solo_activos=False)
    for campo, valor in datos.model_dump(exclude_unset=True).items():
        setattr(plan, campo, valor)
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return PlanResponse.model_validate(plan)


def suscripcion_con_pagos(db: Session, taller_id: int) -> SuscripcionDetalleResponse:
    taller = taller_por_id(db, taller_id)
    base = armar_suscripcion(db, taller)
    return SuscripcionDetalleResponse(
        **base.model_dump(), pagos=pagos_del_taller(db, taller.id)
    )


def registrar_pago_manual(
    db: Session, taller: Taller, datos: PagoManualCreate, usuario: Usuario
) -> PagoSuscripcion:
    """Pago manual aprobado: extiende el vencimiento del taller.

    periodo_desde = max(vencimiento + 1, fecha del pago o hoy);
    periodo_hasta = periodo_desde + meses - 1 día (docs/Suscripciones.md)."""
    base = datos.fecha or date.today()
    if taller.suscripcion_vence_en is not None:
        base = max(base, taller.suscripcion_vence_en + timedelta(days=1))
    periodo_hasta = base + relativedelta(months=datos.meses) - timedelta(days=1)

    pago = PagoSuscripcion(
        taller_id=taller.id,
        monto=datos.monto,
        periodo_desde=base,
        periodo_hasta=periodo_hasta,
        medio="manual",
        estado="aprobado",
        referencia=datos.referencia,
        registrado_por_id=usuario.id,
    )
    taller.suscripcion_vence_en = periodo_hasta
    db.add_all([pago, taller])
    db.commit()
    db.refresh(pago)
    return pago


def pago_response(db: Session, pago: PagoSuscripcion) -> PagoSuscripcionResponse:
    nombre = None
    if pago.registrado_por_id:
        usuario = db.get(Usuario, pago.registrado_por_id)
        if usuario is not None:
            nombre = f"{usuario.nombre} {usuario.apellido}".strip()
    return PagoSuscripcionResponse(
        id=pago.id,
        monto=pago.monto,
        periodo_desde=pago.periodo_desde,
        periodo_hasta=pago.periodo_hasta,
        medio=pago.medio,
        estado=pago.estado,
        referencia=pago.referencia,
        registrado_por=nombre,
        creado_en=pago.creado_en,
    )


def ajustar_vencimiento(db: Session, taller: Taller, vence_en: date) -> SuscripcionResponse:
    """Corrección o cortesía: cambia el vencimiento a mano. El POST ya queda
    auditado por el middleware de auditoría."""
    taller.suscripcion_vence_en = vence_en
    db.add(taller)
    db.commit()
    db.refresh(taller)
    return armar_suscripcion(db, taller)
