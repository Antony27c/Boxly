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
import threading
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


def _fin_de_un_mes(inicio: date) -> date:
    """Último día del mes de suscripción que arranca en ``inicio``: el día
    anterior al mismo día del mes siguiente. Si ese día no existe (arranca el
    29, 30 o 31), el mes termina el último día del mes siguiente: 31/01 →
    28/02 o 29/02, y no 27/02."""
    siguiente = sumar_meses(inicio, 1)
    if siguiente.day < inicio.day:
        return siguiente
    return siguiente - timedelta(days=1)


def periodo_siguiente(
    vence_en: date | None, meses: int = 1, desde: date | None = None
) -> tuple[date, date]:
    """Período que cubre un pago (docs/Suscripciones.md):
    ``periodo_desde = max(vence_en + 1, desde o hoy)`` y
    ``periodo_hasta = periodo_desde + meses - 1 día``.

    Los meses se encadenan de a uno, así pagar varios juntos termina igual que
    pagarlos de a uno: 31/01 + 1 mes termina el 28/02 y + 2 meses, el 31/03."""
    inicio = desde or hoy()
    if vence_en is not None:
        inicio = max(inicio, vence_en + timedelta(days=1))
    hasta = inicio - timedelta(days=1)
    for _ in range(meses):
        hasta = _fin_de_un_mes(hasta + timedelta(days=1))
    return inicio, hasta


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


# --- Cupo de personal ------------------------------------------------------------

# Un lock por taller para el cupo en SQLite (ver reservar_cupo).
_LOCKS_CUPO: dict[int, threading.Lock] = {}
_LOCKS_CUPO_GUARDA = threading.Lock()
_CLAVE_CUPOS = "cupos_reservados"


def _lock_cupo(taller_id: int) -> threading.Lock:
    with _LOCKS_CUPO_GUARDA:
        return _LOCKS_CUPO.setdefault(taller_id, threading.Lock())


def _liberar_cupos(session, transaccion) -> None:
    # Solo al terminar la transacción de afuera (commit, rollback o close),
    # no al cerrar un savepoint.
    if transaccion.parent is not None:
        return
    for taller_id in session.info.pop(_CLAVE_CUPOS, set()):
        _lock_cupo(taller_id).release()


def reservar_cupo(db, taller_id: int):
    """Reserva el cupo de personal del taller hasta que termine la transacción
    de ``db`` y devuelve el taller releído.

    Lo usan el alta y la reactivación de personal y el cambio de plan: sin esto,
    un alta y una bajada de plan simultáneas cuentan las dos antes de que
    ninguna escriba y el taller queda por encima del límite del plan nuevo.
    - PostgreSQL: SELECT ... FOR UPDATE sobre la fila del taller. Vale entre
      workers y procesos; lo libera el commit o el rollback.
    - SQLite (dev y tests): no tiene FOR UPDATE; se usa un lock por taller en el
      proceso (SQLite se usa con un solo proceso) que se suelta al terminar la
      transacción, también si la request falla y la sesión se cierra.
    El taller se relee después de tomar el lock (``populate_existing``): el que
    ya estaba en la sesión puede tener el plan de antes del cambio.
    """
    from sqlalchemy import event, select

    from app.models import Taller

    if db.get_bind().dialect.name == "sqlite":
        reservados = db.info.setdefault(_CLAVE_CUPOS, set())
        if taller_id not in reservados:
            if not event.contains(db, "after_transaction_end", _liberar_cupos):
                event.listen(db, "after_transaction_end", _liberar_cupos)
            _lock_cupo(taller_id).acquire()
            reservados.add(taller_id)
    stmt = (
        select(Taller)
        .where(Taller.id == taller_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    return db.scalar(stmt)

