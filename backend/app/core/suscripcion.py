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

Las fechas de la suscripción se calculan en el día argentino (``hoy()``), no en
el del servidor: en un contenedor en UTC el día se correría después de las 21.
"""
from calendar import monthrange
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

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


def _zona_argentina():
    """America/Argentina/Buenos_Aires; si el sistema no trae la base de zonas
    (Windows sin tzdata, imágenes mínimas), UTC-3 fijo: Argentina no tiene
    horario de verano desde 2009."""
    try:
        return ZoneInfo("America/Argentina/Buenos_Aires")
    except ZoneInfoNotFoundError:
        return timezone(timedelta(hours=-3), "ART")


ZONA_ARGENTINA = _zona_argentina()


def hoy(ahora: datetime | None = None) -> date:
    """La fecha de hoy en Argentina. ``ahora`` (con zona) es para los tests."""
    return (ahora or datetime.now(timezone.utc)).astimezone(ZONA_ARGENTINA).date()


def sumar_meses(fecha: date, meses: int) -> date:
    """``meses`` meses después de ``fecha``; si el día no existe en el mes de
    destino, va al último día (31/01 + 1 mes = 28/02 o 29/02)."""
    indice = fecha.month - 1 + meses
    anio, mes = fecha.year + indice // 12, indice % 12 + 1
    return date(anio, mes, min(fecha.day, monthrange(anio, mes)[1]))


def periodo_siguiente(
    vence_en: date | None, meses: int = 1, desde: date | None = None
) -> tuple[date, date]:
    """Período que cubre un pago (docs/Suscripciones.md):
    ``periodo_desde = max(vence_en + 1, desde o hoy)`` y
    ``periodo_hasta = periodo_desde + meses - 1 día``."""
    inicio = desde or hoy()
    if vence_en is not None:
        inicio = max(inicio, vence_en + timedelta(days=1))
    return inicio, sumar_meses(inicio, meses) - timedelta(days=1)


def dias_para_vencer(vence_en: date | None, hoy_: date | None = None) -> int:
    """Días hasta el vencimiento (negativo si ya venció; 0 sin vencimiento)."""
    if vence_en is None:
        return 0
    return (vence_en - (hoy_ or hoy())).days


def dias_vencida(vence_en: date | None, hoy_: date | None = None) -> int:
    """Días desde el vencimiento (negativo o 0 si todavía no venció)."""
    return -dias_para_vencer(vence_en, hoy_)


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
    """La ruta es un prefijo libre exacto o cuelga de él (``prefijo/…``).

    Sin la barra, ``/api/v1/suscripcionX`` también matcheaba ``startswith`` y
    quedaba libre por error (Q4)."""
    return any(ruta == p or ruta.startswith(p + "/") for p in PREFIJOS_LIBRES)
