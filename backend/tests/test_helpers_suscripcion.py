"""Helpers de fechas de la suscripción (app/core/suscripcion.py): el día
argentino, el período que cubre un pago y los días para vencer."""
from datetime import date, datetime, timedelta, timezone

import pytest

from app.core.suscripcion import (
    dias_para_vencer,
    dias_vencida,
    hoy,
    periodo_siguiente,
    sumar_meses,
)

UTC = timezone.utc


# --- hoy() en la zona argentina ------------------------------------------------


def test_hoy_a_las_22_utc_sigue_siendo_el_mismo_dia():
    # 22:00 UTC = 19:00 en Argentina: mismo día.
    assert hoy(datetime(2026, 11, 23, 22, 0, tzinfo=UTC)) == date(2026, 11, 23)


def test_hoy_despues_de_las_21_argentinas_no_se_corre_al_dia_siguiente():
    # 01:30 UTC del 24 = 22:30 del 23 en Argentina: el servidor en UTC diría
    # 24, pero el día del taller sigue siendo el 23.
    ahora = datetime(2026, 11, 24, 1, 30, tzinfo=UTC)
    assert ahora.date() == date(2026, 11, 24)
    assert hoy(ahora) == date(2026, 11, 23)


def test_hoy_en_el_cambio_de_anio():
    assert hoy(datetime(2027, 1, 1, 2, 59, tzinfo=UTC)) == date(2026, 12, 31)
    assert hoy(datetime(2027, 1, 1, 3, 0, tzinfo=UTC)) == date(2027, 1, 1)


def test_hoy_sin_argumento_devuelve_una_fecha():
    assert isinstance(hoy(), date)


# --- periodo_siguiente ------------------------------------------------------------


@pytest.mark.parametrize(
    "fecha,meses,esperado",
    [
        (date(2026, 1, 31), 1, date(2026, 2, 28)),
        (date(2028, 1, 31), 1, date(2028, 2, 29)),  # bisiesto
        (date(2026, 3, 31), 1, date(2026, 4, 30)),
        (date(2026, 11, 30), 3, date(2027, 2, 28)),
        (date(2026, 12, 15), 1, date(2027, 1, 15)),
        (date(2026, 5, 10), 12, date(2027, 5, 10)),
    ],
)
def test_sumar_meses_ajusta_al_ultimo_dia(fecha, meses, esperado):
    assert sumar_meses(fecha, meses) == esperado


def test_periodo_sin_vencimiento_arranca_desde_hoy():
    assert periodo_siguiente(None, 1, desde=date(2026, 3, 10)) == (
        date(2026, 3, 10), date(2026, 4, 9),
    )


def test_periodo_arranca_el_dia_despues_del_vencimiento_si_todavia_no_vencio():
    desde, hasta = periodo_siguiente(date(2026, 3, 20), 1, desde=date(2026, 3, 10))
    assert (desde, hasta) == (date(2026, 3, 21), date(2026, 4, 20))


def test_periodo_vencido_arranca_hoy():
    desde, hasta = periodo_siguiente(date(2026, 1, 5), 2, desde=date(2026, 3, 10))
    assert (desde, hasta) == (date(2026, 3, 10), date(2026, 5, 9))


def test_periodo_en_fin_de_mes():
    # Vence el 30/01: el período arranca el 31/01 y termina el último día de
    # febrero (el 31/02 no existe), no el 27/02.
    assert periodo_siguiente(date(2026, 1, 30), 1, desde=date(2026, 1, 15)) == (
        date(2026, 1, 31), date(2026, 2, 28),
    )


def test_periodo_en_anio_bisiesto():
    assert periodo_siguiente(date(2028, 1, 30), 1, desde=date(2028, 1, 15)) == (
        date(2028, 1, 31), date(2028, 2, 29),
    )
    assert periodo_siguiente(None, 1, desde=date(2028, 2, 29)) == (
        date(2028, 2, 29), date(2028, 3, 28),
    )
    # 29/02 + 12 meses: el 29/02/2029 no existe, el período termina el 28/02.
    assert periodo_siguiente(None, 12, desde=date(2028, 2, 29)) == (
        date(2028, 2, 29), date(2029, 2, 28),
    )


# --- dias_para_vencer -------------------------------------------------------------


def test_dias_para_vencer():
    referencia = date(2026, 3, 10)
    assert dias_para_vencer(None, referencia) == 0
    assert dias_para_vencer(referencia + timedelta(days=5), referencia) == 5
    assert dias_para_vencer(referencia - timedelta(days=3), referencia) == -3
    assert dias_vencida(referencia - timedelta(days=3), referencia) == 3
    assert dias_vencida(None, referencia) == 0
