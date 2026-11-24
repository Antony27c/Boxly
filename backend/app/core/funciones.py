"""Funciones habilitadas por plan y adicionales del taller (docs/Oferta.md, C0).

Cada plan tiene una lista de códigos de función (``planes.funciones``) y el
taller puede sumar funciones con adicionales vigentes (``adicionales_taller``).
Las funciones que todavía no existen en el producto ya tienen su código: nada
las usa hasta que se construyan.
"""
from datetime import date

from sqlalchemy import select

from app.core.suscripcion import hoy

# --- Códigos de función (docs/Oferta.md, sección 4) ---------------------------
FUNCION_GESTION = "gestion"  # toda la gestión diaria del taller
FUNCION_WHATSAPP_MANUAL = "whatsapp_manual"  # aviso armado que el taller manda
FUNCION_WHATSAPP_AUTOMATICO = "whatsapp_automatico"  # avisos automáticos por WhatsApp
FUNCION_ARCA = "arca"  # facturas electrónicas ARCA
FUNCION_RECORDATORIOS_SERVICE = "recordatorios_service"  # recordatorios de service
FUNCION_MARCA_PROPIA = "marca_propia"  # personalización de marca

FUNCIONES = (
    FUNCION_GESTION,
    FUNCION_WHATSAPP_MANUAL,
    FUNCION_WHATSAPP_AUTOMATICO,
    FUNCION_ARCA,
    FUNCION_RECORDATORIOS_SERVICE,
    FUNCION_MARCA_PROPIA,
)


def _adicional_vigente(adicional, hoy: date) -> bool:
    return (
        adicional.activo
        and (adicional.desde is None or adicional.desde <= hoy)
        and (adicional.hasta is None or hoy <= adicional.hasta)
    )


def taller_tiene(db, taller, funcion: str) -> bool:
    """¿El taller tiene la función por su plan o por un adicional vigente?

    ``taller`` es la fila ``Taller``. Primero mira ``planes.funciones`` del plan
    actual; si no está, busca un adicional del taller con ese código que esté
    activo y dentro de su vigencia (``desde``/``hasta``, null = sin límite).
    """
    # Import perezoso: los modelos importan las constantes de este módulo.
    from app.models import AdicionalTaller, Plan

    plan = db.get(Plan, taller.plan_codigo)
    if plan is not None and funcion in (plan.funciones or []):
        return True
    stmt = select(AdicionalTaller).where(
        AdicionalTaller.taller_id == taller.id,
        AdicionalTaller.codigo == funcion,
        AdicionalTaller.activo.is_(True),
    )
    # El día argentino, como ``adicionales_vigentes``: con el del servidor (UTC)
    # un adicional que vence hoy dejaba de valer a las 21.
    dia = hoy()
    return any(_adicional_vigente(a, dia) for a in db.scalars(stmt))
