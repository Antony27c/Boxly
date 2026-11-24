"""Tipo de acceso del taller: demo, piloto o pago (docs/Oferta.md, C2).

Cada tipo resuelve el plan y el vencimiento con su propia regla (``REGLAS``):
la demo fuerza Pro por 14 días, el piloto usa lo que elige el superadmin y el
pago usa el plan elegido con vencimiento por defecto hoy. Lo usan el alta de
taller y la conversión desde la plataforma.

La conversión de un taller existente sigue además ``TRANSICIONES``: el
superadmin nunca le acorta el acceso a un taller sin decirlo explícitamente.
Sin ``vence_en``, pasar a pago conserva lo que el taller ya tenía
(``max(vence_en actual, hoy)``); extender una demo pide la fecha nueva; y no
se vuelve a demo desde piloto ni desde pago.

``talleres`` no tiene columna para el motivo: queda en una fila de auditoría de
plataforma (``taller_id`` NULL, como las demás acciones del superadmin) con el
detalle del acceso.
"""
from dataclasses import dataclass, replace
from datetime import date, timedelta
from typing import Callable, Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.api.v1.suscripcion import service as suscripcion
from app.core.suscripcion import hoy
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
    plan_codigo, vence_en = REGLAS[acceso.tipo](acceso, hoy())
    plan = suscripcion.plan_o_404(db, plan_codigo, solo_activos=True)
    return AccesoResuelto(tipo=acceso.tipo, plan=plan, vence_en=vence_en)


def aplicar(taller: Taller, resuelto: AccesoResuelto) -> None:
    """Deja el taller con el acceso resuelto (sin commitear)."""
    taller.tipo_acceso = resuelto.tipo
    taller.plan_codigo = resuelto.plan.codigo
    taller.suscripcion_vence_en = resuelto.vence_en


def _fecha(valor: Optional[date]) -> str:
    return valor.isoformat() if valor else "sin vencimiento"


def _detalle(resuelto: AccesoResuelto, motivo: str) -> str:
    return (
        f"Acceso {resuelto.tipo}, plan {resuelto.plan.codigo}, vence {_fecha(resuelto.vence_en)}. "
        f"Motivo: {motivo}"
    )


def auditar_plataforma(
    db: Session,
    usuario: Usuario,
    taller_id: int,
    detalle: str,
    *,
    metodo: str,
    ruta: str,
    estado_http: int,
) -> None:
    """Fila de auditoría de plataforma con el detalle de la acción (sin
    commitear). ``taller_id`` NULL como las demás acciones del superadmin; el
    taller va en ``entidad_id``. El middleware audita la request pero no su
    cuerpo: esta fila deja qué cambió."""
    db.add(
        Auditoria(
            usuario_id=usuario.id,
            taller_id=None,
            usuario_email=usuario.email,
            rol=str(getattr(usuario.rol, "value", usuario.rol)),
            metodo=metodo,
            ruta=ruta,
            entidad="plataforma",
            entidad_id=taller_id,
            estado_http=estado_http,
            detalle=detalle[:500],
        )
    )


def registrar_motivo(
    db: Session,
    taller: Taller,
    resuelto: AccesoResuelto,
    motivo: str | None,
    usuario: Usuario,
    ruta: str,
) -> None:
    """Deja el motivo del acceso del alta en la auditoría (sin commitear). Sin
    motivo no agrega nada: el POST ya lo audita el middleware."""
    if not motivo:
        return
    auditar_plataforma(
        db, usuario, taller.id, _detalle(resuelto, motivo),
        metodo="POST", ruta=ruta, estado_http=status.HTTP_201_CREATED,
    )


# --- Conversión de un taller existente ----------------------------------------

MSG_DEMO_ACTIVA = "La demo ya está activa; para extenderla indicá la nueva fecha"
MSG_DEMO_NO_EXTIENDE = (
    "Para extender la demo, la nueva fecha tiene que ser posterior al vencimiento actual"
)
MSG_PILOTO_A_DEMO = "Un piloto no puede volver a demo"
MSG_PAGO_A_DEMO = "Un taller pago no puede volver a demo"


def _conflicto(detalle: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detalle)


def _a_pago(taller: Taller, acceso: AccesoTaller, resuelto: AccesoResuelto) -> AccesoResuelto:
    """Sin fecha explícita se conserva lo que el taller tenía (los días de demo
    o de piloto que quedaban, o lo ya pagado); si ya venció, hoy."""
    if acceso.vence_en is not None:
        return resuelto
    actual = taller.suscripcion_vence_en
    return replace(resuelto, vence_en=max(actual, hoy()) if actual is not None else hoy())


def _a_demo(taller: Taller, acceso: AccesoTaller, resuelto: AccesoResuelto) -> AccesoResuelto:
    if taller.tipo_acceso == "piloto":
        raise _conflicto(MSG_PILOTO_A_DEMO)
    if taller.tipo_acceso == "pago":
        raise _conflicto(MSG_PAGO_A_DEMO)
    # demo → demo: solo para extenderla, con la fecha nueva.
    if acceso.vence_en is None:
        raise _conflicto(MSG_DEMO_ACTIVA)
    actual = taller.suscripcion_vence_en
    if actual is not None and acceso.vence_en <= actual:
        raise _conflicto(MSG_DEMO_NO_EXTIENDE)
    return replace(resuelto, vence_en=acceso.vence_en)


def _a_piloto(taller: Taller, acceso: AccesoTaller, resuelto: AccesoResuelto) -> AccesoResuelto:
    # El schema exige plan, vence_en y motivo: la fecha del piloto siempre es
    # explícita, venga de demo, de pago o de otro piloto.
    return resuelto


# tipo de destino -> regla de la conversión según el acceso actual del taller.
TRANSICIONES: dict[str, Callable[[Taller, AccesoTaller, AccesoResuelto], AccesoResuelto]] = {
    "pago": _a_pago,
    "demo": _a_demo,
    "piloto": _a_piloto,
}


def _detalle_conversion(
    antes: tuple[str, str, Optional[date]], resuelto: AccesoResuelto, motivo: str | None
) -> str:
    tipo, plan, vence = antes
    return (
        f"Acceso {tipo} → {resuelto.tipo}. Plan {plan} → {resuelto.plan.codigo}. "
        f"Vence {_fecha(vence)} → {_fecha(resuelto.vence_en)}. "
        f"Motivo: {motivo or 'sin motivo'}"
    )


def convertir(
    db: Session, taller_id: int, acceso: AccesoTaller, usuario: Usuario
) -> SuscripcionResponse:
    """Convierte el acceso de un taller (p. ej. de demo a pago o a piloto).

    Las reglas por tipo de destino están en ``TRANSICIONES``. Con un plan más
    chico rige el mismo 409 de personal que el cambio de plan. Queda en la
    auditoría de la plataforma con el antes, el después y el motivo."""
    taller = suscripcion.taller_por_id(db, taller_id)
    resuelto = TRANSICIONES[acceso.tipo](taller, acceso, resolver(db, acceso))
    plan = resuelto.plan
    suscripcion.exigir_cupo_plan(db, taller, plan)
    antes = (taller.tipo_acceso, taller.plan_codigo, taller.suscripcion_vence_en)
    cambia_plan = taller.plan_codigo != plan.codigo
    aplicar(taller, resuelto)
    db.add(taller)
    auditar_plataforma(
        db, usuario, taller.id, _detalle_conversion(antes, resuelto, acceso.motivo),
        metodo="POST", ruta=f"/api/v1/plataforma/talleres/{taller.id}/acceso",
        estado_http=status.HTTP_200_OK,
    )
    db.commit()
    db.refresh(taller)
    if cambia_plan:
        suscripcion.avisar_cambio_plan(taller, plan)
    return suscripcion.armar_suscripcion(db, taller)
