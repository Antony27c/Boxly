"""Estado de la suscripción de un taller según su vencimiento y tipo de acceso.

Pago y piloto (docs/Suscripciones.md y docs/Oferta.md):

| Días desde el vencimiento | Estado        |
| ≤ 0                       | al_dia        |
| 1 a 7                     | gracia        |
| 8 a 30                    | solo_lectura  |
| ≥ 31                      | suspendida    |

Demo (docs/Oferta.md, "Fin de la demo"): no tiene gracia. 3 días de solo
lectura para elegir y pagar un plan y después queda suspendida.

| Días desde el vencimiento | Estado        |
| ≤ 0                       | al_dia        |
| 1 a 3                     | solo_lectura  |
| ≥ 4                       | suspendida    |
"""
from datetime import date, timedelta

AL_DIA = "al_dia"
GRACIA = "gracia"
SOLO_LECTURA = "solo_lectura"
SUSPENDIDA = "suspendida"

DIAS_GRACIA = 7
DIAS_SOLO_LECTURA = 30
# Días de solo lectura que tiene la demo antes de suspenderse.
DIAS_SOLO_LECTURA_DEMO = 3

# Tipo de acceso que manda la demo (talleres.tipo_acceso, docs/Oferta.md).
ACCESO_DEMO = "demo"

# Rutas que siguen andando aunque la suscripción no esté al día: pagar, entrar y
# aceptar los términos.
PREFIJOS_LIBRES = ("/api/v1/suscripcion", "/api/v1/auth", "/api/v1/terminos")


def dias_vencida(vence_en: date | None, hoy: date | None = None) -> int:
    """Días desde el vencimiento (negativo o 0 si todavía no venció)."""
    if vence_en is None:
        return 0
    return ((hoy or date.today()) - vence_en).days


def estado_suscripcion(
    vence_en: date | None, hoy: date | None = None, tipo_acceso: str = "pago"
) -> str:
    """Estado de la suscripción. ``tipo_acceso`` es ``talleres.tipo_acceso``;
    los callers viejos que no lo pasan siguen con las reglas de pago."""
    dias = dias_vencida(vence_en, hoy)
    if dias <= 0:
        return AL_DIA
    if tipo_acceso == ACCESO_DEMO:
        return SOLO_LECTURA if dias <= DIAS_SOLO_LECTURA_DEMO else SUSPENDIDA
    if dias <= DIAS_GRACIA:
        return GRACIA
    if dias <= DIAS_SOLO_LECTURA:
        return SOLO_LECTURA
    return SUSPENDIDA


def fechas_limite(
    vence_en: date | None, tipo_acceso: str = "pago"
) -> tuple[date | None, date | None]:
    """Fechas de corte de la suscripción: ``(fin_gracia, fin_acceso)``.

    ``fin_gracia`` es el último día con todo normal (la demo no tiene gracia:
    None) y ``fin_acceso`` el último día antes de la suspensión. Sin
    vencimiento no hay cortes: ``(None, None)``.
    """
    if vence_en is None:
        return None, None
    if tipo_acceso == ACCESO_DEMO:
        return None, vence_en + timedelta(days=DIAS_SOLO_LECTURA_DEMO)
    return (
        vence_en + timedelta(days=DIAS_GRACIA),
        vence_en + timedelta(days=DIAS_SOLO_LECTURA),
    )


def ruta_libre(ruta: str) -> bool:
    return ruta.startswith(PREFIJOS_LIBRES)
