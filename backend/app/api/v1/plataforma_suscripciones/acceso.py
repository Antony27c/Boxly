"""Tipo de acceso del taller: demo, piloto o pago (docs/Oferta.md, C2).

Cada tipo resuelve el plan y el vencimiento con su propia regla (``REGLAS``):
la demo fuerza Pro por 14 días, el piloto usa lo que elige el superadmin y el
pago usa el plan elegido con vencimiento por defecto hoy. Lo usan el alta de
taller y la conversión desde la plataforma.

``talleres`` no tiene columna para el motivo (piloto): queda en una fila de
auditoría de plataforma (``taller_id`` NULL, como las demás acciones del
superadmin) con el detalle del acceso.
"""
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Callable, Optional

from sqlalchemy.orm import Session

from app.api.v1.suscripcion import service as suscripcion
from app.models import Auditoria, Plan, Taller, Usuario
from app.models.suscripcion import DIAS_DEMO, PLAN_DEMO
from app.schemas.suscripcion import AccesoTaller, SuscripcionResponse


@dataclass(frozen=True)
class AccesoResuelto:
    tipo: str
    plan: Plan
    vence_en: Optional[date]


def _regla_demo(acceso: AccesoTaller, hoy: date) -> tuple[str, Optional[date]]:
    return PLAN_DEMO, hoy + timedelta(days=DIAS_DEMO)


def _regla_piloto(acceso: AccesoTaller, hoy: date) -> tuple[str, Optional[date]]:
    return acceso.plan, acceso.vence_en


def _regla_pago(acceso: AccesoTaller, hoy: date) -> tuple[str, Optional[date]]:
    return acceso.plan, acceso.vence_en or hoy


# tipo de acceso -> (plan, vencimiento). Los datos que pide cada tipo los valida
# el schema (CAMPOS_POR_ACCESO).
REGLAS: dict[str, Callable[[AccesoTaller, date], tuple[str, Optional[date]]]] = {
    "demo": _regla_demo,
    "piloto": _regla_piloto,
    "pago": _regla_pago,
}


def resolver(db: Session, acceso: AccesoTaller) -> AccesoResuelto:
    """Plan y vencimiento del acceso. El plan tiene que existir y estar activo
    (404 si no): se valida antes de crear o tocar nada."""
    plan_codigo, vence_en = REGLAS[acceso.tipo](acceso, date.today())
    plan = suscripcion.plan_o_404(db, plan_codigo, solo_activos=True)
    return AccesoResuelto(tipo=acceso.tipo, plan=plan, vence_en=vence_en)


def aplicar(taller: Taller, resuelto: AccesoResuelto) -> None:
    """Deja el taller con el acceso resuelto (sin commitear)."""
    taller.tipo_acceso = resuelto.tipo
    taller.plan_codigo = resuelto.plan.codigo
    taller.suscripcion_vence_en = resuelto.vence_en


def _detalle(resuelto: AccesoResuelto, motivo: str) -> str:
    vence = resuelto.vence_en.isoformat() if resuelto.vence_en else "sin vencimiento"
    texto = f"Acceso {resuelto.tipo}, plan {resuelto.plan.codigo}, vence {vence}. Motivo: {motivo}"
    return texto[:500]


def registrar_motivo(
    db: Session,
    taller: Taller,
    resuelto: AccesoResuelto,
    motivo: str | None,
    usuario: Usuario,
    ruta: str,
) -> None:
    """Deja el motivo del acceso en la auditoría (sin commitear). Sin motivo
    no agrega nada: el POST ya lo audita el middleware."""
    if not motivo:
        return
    db.add(
        Auditoria(
            usuario_id=usuario.id,
            taller_id=None,
            usuario_email=usuario.email,
            rol=str(getattr(usuario.rol, "value", usuario.rol)),
            metodo="POST",
            ruta=ruta,
            entidad="plataforma",
            entidad_id=taller.id,
            estado_http=200,
            detalle=_detalle(resuelto, motivo),
        )
    )


def convertir(
    db: Session, taller_id: int, acceso: AccesoTaller, usuario: Usuario
) -> SuscripcionResponse:
    """Convierte el acceso de un taller (p. ej. de demo a pago o a piloto).

    Con un plan más chico rige el mismo 409 de personal que el cambio de plan.
    El POST queda en la auditoría por el middleware."""
    taller = suscripcion.taller_por_id(db, taller_id)
    resuelto = resolver(db, acceso)
    plan = resuelto.plan
    suscripcion.exigir_cupo_plan(db, taller, plan)
    cambia_plan = taller.plan_codigo != plan.codigo
    aplicar(taller, resuelto)
    db.add(taller)
    registrar_motivo(
        db, taller, resuelto, acceso.motivo, usuario,
        ruta=f"/api/v1/plataforma/talleres/{taller.id}/acceso",
    )
    db.commit()
    db.refresh(taller)
    if cambia_plan:
        suscripcion.sincronizar_cobro_automatico(taller, plan)
    return suscripcion.armar_suscripcion(db, taller)
