"""Estado de la suscripción de un taller según su vencimiento (docs/Suscripciones.md).

| Días desde el vencimiento | Estado        |
| ≤ 0                       | al_dia        |
| 1 a 7                     | gracia        |
| 8 a 30                    | solo_lectura  |
| ≥ 31                      | suspendida    |
"""
from datetime import date

AL_DIA = "al_dia"
GRACIA = "gracia"
SOLO_LECTURA = "solo_lectura"
SUSPENDIDA = "suspendida"

DIAS_GRACIA = 7
DIAS_SOLO_LECTURA = 30

# Rutas que siguen andando aunque la suscripción no esté al día: pagar, entrar y
# aceptar los términos.
PREFIJOS_LIBRES = ("/api/v1/suscripcion", "/api/v1/auth", "/api/v1/terminos")


def dias_vencida(vence_en: date | None, hoy: date | None = None) -> int:
    """Días desde el vencimiento (negativo o 0 si todavía no venció)."""
    if vence_en is None:
        return 0
    return ((hoy or date.today()) - vence_en).days


def estado_suscripcion(vence_en: date | None, hoy: date | None = None) -> str:
    dias = dias_vencida(vence_en, hoy)
    if dias <= 0:
        return AL_DIA
    if dias <= DIAS_GRACIA:
        return GRACIA
    if dias <= DIAS_SOLO_LECTURA:
        return SOLO_LECTURA
    return SUSPENDIDA


def ruta_libre(ruta: str) -> bool:
    return ruta.startswith(PREFIJOS_LIBRES)
