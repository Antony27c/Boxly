"""Suscripción del taller de la sesión y lógica compartida con la plataforma.

``PagoSuscripcion`` tiene ``taller_id`` pero no usa ``TallerMixin``: el filtro
automático de app.db.session no lo cubre, así que TODA consulta filtra por el
taller explícitamente (docs/Suscripciones.md, S1).

Es el único lugar que escribe ``PagoSuscripcion`` (``registrar_pago``): lo usan
el pago manual del superadmin y los cobros de Mercado Pago (suscripcion_mp).
"""
from collections.abc import Callable
from datetime import date
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errores import PLAN_PERSONAL_EXCEDIDO, ErrorConCodigo
from app.core.funciones import FUNCIONES, taller_tiene
from app.core.suscripcion import (
    dias_para_vencer,
    estado_suscripcion,
    fechas_limite,
    hoy,
    periodo_siguiente,
    reservar_cupo,
)
from app.db.session import CLAVE_TALLER, SIN_FILTRO_TALLER, fijar_taller
from app.models import AdicionalTaller, PagoSuscripcion, Plan, Taller, Usuario
from app.models.suscripcion import EstadoPagoSuscripcion, MedioPagoSuscripcion
from app.models.usuario import ROLES_PERSONAL
from app.schemas.suscripcion import (
    AdicionalResponse,
    PagoManualCreate,
    PagoSuscripcionResponse,
    PlanResponse,
    PlanUpdate,
    SuscripcionDetalleResponse,
    SuscripcionResponse,
)

_MSG_SIN_PERMISO = "No tenés permisos para esta acción"
# Un pago aprobado deja al taller en este tipo de acceso (docs/Oferta.md).
ACCESO_PAGO = "pago"
# Un pago en estos estados ya no cambia: un aviso repetido o contradictorio de
# Mercado Pago no deshace lo registrado.
_ESTADOS_FINALES = (EstadoPagoSuscripcion.aprobado, EstadoPagoSuscripcion.rechazado)

OyenteCambioPlan = Callable[[Taller, Plan], None]
# Quienes reaccionan a un cambio de plan ya guardado (hoy, el cobro automático
# de suscripcion_mp, que se anota al importarse). Así este módulo no importa a
# suscripcion_mp, que sí depende de este.
_oyentes_cambio_plan: list[OyenteCambioPlan] = []


def al_cambiar_plan(oyente: OyenteCambioPlan) -> OyenteCambioPlan:
    """Anota un oyente del cambio de plan (una sola vez aunque se repita)."""
    if oyente not in _oyentes_cambio_plan:
        _oyentes_cambio_plan.append(oyente)
    return oyente


def avisar_cambio_plan(taller: Taller, plan: Plan) -> None:
    """Avisa el plan nuevo a los oyentes. Ninguno rompe el cambio ya guardado."""
    for oyente in _oyentes_cambio_plan:
        oyente(taller, plan)


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


def plan_o_404(db: Session, codigo: str, *, solo_activos: bool) -> Plan:
    plan = db.get(Plan, codigo)
    if plan is None or (solo_activos and not plan.activo):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan no encontrado")
    return plan


def plan_del_taller(db: Session, taller: Taller) -> Plan:
    """Plan actual del taller, aunque esté inactivo (404 si no existe)."""
    return plan_o_404(db, taller.plan_codigo, solo_activos=False)


def estado_del_taller(taller: Taller) -> str:
    """Estado de la suscripción según el vencimiento y el tipo de acceso."""
    return estado_suscripcion(taller.suscripcion_vence_en, tipo_acceso=taller.tipo_acceso)


def adicionales_vigentes(db: Session, taller_id: int) -> list[AdicionalTaller]:
    """Adicionales activos del taller dentro de su vigencia (null = sin límite)."""
    dia = hoy()
    stmt = (
        select(AdicionalTaller)
        .where(
            AdicionalTaller.taller_id == taller_id,
            AdicionalTaller.activo.is_(True),
            (AdicionalTaller.desde.is_(None)) | (AdicionalTaller.desde <= dia),
            (AdicionalTaller.hasta.is_(None)) | (AdicionalTaller.hasta >= dia),
        )
        .order_by(AdicionalTaller.codigo)
    )
    return list(db.scalars(stmt))


def funciones_efectivas(db: Session, taller: Taller) -> list[str]:
    """Funciones del plan más las de los adicionales vigentes, en el orden de
    app/core/funciones.py."""
    return [f for f in FUNCIONES if taller_tiene(db, taller, f)]


def armar_suscripcion(db: Session, taller: Taller) -> SuscripcionResponse:
    """SuscripcionResponse del taller: la usa el taller y también la plataforma."""
    plan = plan_del_taller(db, taller)
    vence_en = taller.suscripcion_vence_en
    fin_gracia, fin_acceso = fechas_limite(vence_en, tipo_acceso=taller.tipo_acceso)
    return SuscripcionResponse(
        plan=PlanResponse.model_validate(plan),
        vence_en=vence_en,
        estado=estado_del_taller(taller),
        dias_para_vencer=dias_para_vencer(vence_en),
        cobro_automatico=taller.cobro_automatico,
        personal_activo=personal_activo(db, taller.id),
        max_personal=plan.max_personal,
        proximo_monto=plan.precio_mensual,
        tipo_acceso=taller.tipo_acceso,
        adicionales=[
            AdicionalResponse.model_validate(a) for a in adicionales_vigentes(db, taller.id)
        ],
        funciones_efectivas=funciones_efectivas(db, taller),
        fin_gracia=fin_gracia,
        fin_acceso=fin_acceso,
    )


# --- Lado del taller ---------------------------------------------------------


def obtener(db: Session) -> SuscripcionResponse:
    return armar_suscripcion(db, taller_de_sesion(db))


def planes(db: Session) -> list[PlanResponse]:
    """Planes activos para que el taller elija el suyo."""
    stmt = select(Plan).where(Plan.activo.is_(True)).order_by(Plan.codigo)
    return [PlanResponse.model_validate(p) for p in db.scalars(stmt)]


def exigir_cupo_plan(db: Session, taller: Taller, plan: Plan) -> None:
    """Bajar a un plan con menos lugar que el personal activo: 409 del contrato.

    Reserva el cupo del taller hasta el commit del cambio (el mismo lock que el
    alta de personal): si no, un alta simultánea cuenta con el plan viejo y el
    taller queda por encima del límite del plan nuevo."""
    reservar_cupo(db, taller.id)
    if plan.max_personal is not None and personal_activo(db, taller.id) > plan.max_personal:
        raise ErrorConCodigo(
            status_code=status.HTTP_409_CONFLICT,
            detail="Tu personal activo supera el límite de ese plan",
            codigo=PLAN_PERSONAL_EXCEDIDO,
        )


def cambiar_plan(db: Session, taller: Taller, codigo: str) -> SuscripcionResponse:
    """Cambio de plan compartido por el taller y por la plataforma.

    Rige ya; el precio nuevo se cobra desde el próximo período. Solo planes
    activos: uno inactivo o inexistente responde 404."""
    plan = plan_o_404(db, codigo, solo_activos=True)
    exigir_cupo_plan(db, taller, plan)
    taller.plan_codigo = plan.codigo
    db.add(taller)
    db.commit()
    db.refresh(taller)
    avisar_cambio_plan(taller, plan)
    return armar_suscripcion(db, taller)


def _nombres_de_registro(db: Session, pagos: list[PagoSuscripcion]) -> dict[int, str]:
    """Nombre de quien registró cada pago. Sin filtro de taller: los pagos
    manuales los registra el superadmin, que no pertenece al taller."""
    ids = {p.registrado_por_id for p in pagos if p.registrado_por_id}
    if not ids:
        return {}
    stmt = select(Usuario).where(Usuario.id.in_(ids)).execution_options(
        **{SIN_FILTRO_TALLER: True}
    )
    return {u.id: f"{u.nombre} {u.apellido}".strip() for u in db.scalars(stmt)}


def _a_response(pago: PagoSuscripcion, nombres: dict[int, str]) -> PagoSuscripcionResponse:
    return PagoSuscripcionResponse(
        id=pago.id,
        monto=pago.monto,
        periodo_desde=pago.periodo_desde,
        periodo_hasta=pago.periodo_hasta,
        medio=pago.medio,
        estado=pago.estado,
        referencia=pago.referencia,
        registrado_por=nombres.get(pago.registrado_por_id),
        creado_en=pago.creado_en,
    )


def pagos_del_taller(db: Session, taller_id: int) -> list[PagoSuscripcionResponse]:
    """Pagos de la suscripción del taller, más nuevo primero."""
    stmt = (
        select(PagoSuscripcion)
        .where(PagoSuscripcion.taller_id == taller_id)
        .order_by(PagoSuscripcion.id.desc())
    )
    pagos = list(db.scalars(stmt))
    nombres = _nombres_de_registro(db, pagos)
    return [_a_response(p, nombres) for p in pagos]


# --- Lado de la plataforma ----------------------------------------------------


def listar_planes(db: Session) -> list[PlanResponse]:
    """Todos los planes, activos e inactivos (superadmin)."""
    stmt = select(Plan).order_by(Plan.codigo)
    return [PlanResponse.model_validate(p) for p in db.scalars(stmt)]


def actualizar_plan(db: Session, codigo: str, datos: PlanUpdate) -> PlanResponse:
    plan = plan_o_404(db, codigo, solo_activos=False)
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


def _pago_por_mp_id(db: Session, taller_id: int, mp_payment_id: str) -> PagoSuscripcion | None:
    return db.scalar(
        select(PagoSuscripcion).where(
            PagoSuscripcion.mp_payment_id == mp_payment_id,
            PagoSuscripcion.taller_id == taller_id,
        )
    )


def _actualizar_estado(
    taller: Taller, pago: PagoSuscripcion, estado: str, meses: int
) -> PagoSuscripcion | None:
    """El mismo cobro avisado otra vez (p. ej. pendiente y después aprobado).
    Al aprobarse recalcula el período y extiende el vencimiento. None si el
    pago ya estaba en un estado final."""
    if pago.estado in _ESTADOS_FINALES:
        return None
    pago.estado = estado
    if estado == EstadoPagoSuscripcion.aprobado:
        pago.periodo_desde, pago.periodo_hasta = periodo_siguiente(
            taller.suscripcion_vence_en, meses
        )
        aplicar_pago_aprobado(taller, pago.periodo_hasta)
    return pago


def registrar_pago(
    db: Session,
    taller: Taller,
    *,
    monto: Decimal,
    medio: MedioPagoSuscripcion,
    estado: EstadoPagoSuscripcion,
    meses: int = 1,
    fecha: date | None = None,
    referencia: str | None = None,
    registrado_por_id: int | None = None,
    mp_payment_id: str | None = None,
) -> PagoSuscripcion | None:
    """Registra un pago de la suscripción (sin commitear). Si queda aprobado,
    extiende el vencimiento y pasa el taller a pago.

    Período: ``periodo_siguiente(vencimiento, meses, fecha)``. Con
    ``mp_payment_id`` es idempotente: si el cobro ya existe se actualiza su
    estado (``_actualizar_estado``), y si otro request ganó la carrera con el
    mismo id (UNIQUE) devuelve None."""
    if mp_payment_id is not None:
        existente = _pago_por_mp_id(db, taller.id, mp_payment_id)
        if existente is not None:
            return _actualizar_estado(taller, existente, estado, meses)
    desde, hasta = periodo_siguiente(taller.suscripcion_vence_en, meses, fecha)
    pago = PagoSuscripcion(
        taller_id=taller.id,
        monto=monto,
        periodo_desde=desde,
        periodo_hasta=hasta,
        medio=medio,
        estado=estado,
        referencia=referencia,
        mp_payment_id=mp_payment_id,
        registrado_por_id=registrado_por_id,
    )
    db.add(pago)
    taller_de_la_sesion = db.info.get(CLAVE_TALLER)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        fijar_taller(db, taller_de_la_sesion)
        return None
    if estado == EstadoPagoSuscripcion.aprobado:
        aplicar_pago_aprobado(taller, hasta)
    return pago


def registrar_pago_manual(
    db: Session, taller: Taller, datos: PagoManualCreate, usuario: Usuario
) -> PagoSuscripcion:
    """Pago manual aprobado del superadmin: el período arranca en
    max(vencimiento + 1, fecha del pago o hoy) y dura ``meses``."""
    pago = registrar_pago(
        db,
        taller,
        monto=datos.monto,
        medio=MedioPagoSuscripcion.manual,
        estado=EstadoPagoSuscripcion.aprobado,
        meses=datos.meses,
        fecha=datos.fecha,
        referencia=datos.referencia,
        registrado_por_id=usuario.id,
    )
    db.commit()
    db.refresh(pago)
    return pago


def aplicar_pago_aprobado(taller: Taller, pagado_hasta: date) -> None:
    """Un pago aprobado extiende el vencimiento y, si el taller era demo o
    piloto, lo pasa a pago (docs/Oferta.md)."""
    taller.suscripcion_vence_en = pagado_hasta
    taller.tipo_acceso = ACCESO_PAGO


def pago_response(db: Session, pago: PagoSuscripcion) -> PagoSuscripcionResponse:
    return _a_response(pago, _nombres_de_registro(db, [pago]))


def ajustar_vencimiento(db: Session, taller: Taller, vence_en: date) -> SuscripcionResponse:
    """Corrección o cortesía: cambia el vencimiento a mano. El POST ya queda
    auditado por el middleware de auditoría."""
    taller.suscripcion_vence_en = vence_en
    db.add(taller)
    db.commit()
    db.refresh(taller)
    return armar_suscripcion(db, taller)
