"""Períodos de la suscripción que arrancan a fin de mes (auditoría R2, bug 8).

Cada mes se suma desde el día original con tope en el último día del mes
destino: un período que arranca el 29, 30 o 31 no termina el 27/02 y pagar
varios meses juntos termina igual que pagarlos de a uno.
"""
from datetime import date

import pytest

from app.core.suscripcion import periodo_siguiente


def _periodo(desde: date, meses: int = 1) -> tuple[date, date]:
    return periodo_siguiente(None, meses=meses, desde=desde)


@pytest.mark.parametrize(
    ("desde", "hasta"),
    [
        (date(2027, 1, 15), date(2027, 2, 14)),  # caso común: un día antes
        (date(2027, 1, 28), date(2027, 2, 27)),
        (date(2027, 1, 29), date(2027, 2, 28)),
        (date(2027, 1, 30), date(2027, 2, 28)),
        (date(2027, 1, 31), date(2027, 2, 28)),
        (date(2028, 1, 31), date(2028, 2, 29)),  # bisiesto
        (date(2028, 1, 30), date(2028, 2, 29)),
        (date(2027, 3, 31), date(2027, 4, 30)),
        (date(2027, 12, 31), date(2028, 1, 30)),  # cambio de año, sin tope
        (date(2027, 2, 1), date(2027, 2, 28)),
    ],
)
def test_un_mes(desde, hasta):
    assert _periodo(desde) == (desde, hasta)


def test_31_de_enero_mas_dos_meses_termina_el_31_de_marzo():
    assert _periodo(date(2027, 1, 31), meses=2)[1] == date(2027, 3, 31)


@pytest.mark.parametrize("dia", [15, 28, 29, 30, 31])
@pytest.mark.parametrize("meses", [2, 3, 12])
def test_varios_meses_juntos_igual_que_de_a_uno(dia, meses):
    desde = date(2027, 1, dia)
    hasta_junto = _periodo(desde, meses)[1]

    inicio = desde
    for _ in range(meses):
        _, hasta = periodo_siguiente(None, meses=1, desde=inicio)
        inicio = date.fromordinal(hasta.toordinal() + 1)
    assert hasta_junto == hasta


def test_el_siguiente_periodo_no_se_acumula_desde_el_28():
    _, primero = _periodo(date(2027, 1, 31))
    segundo = periodo_siguiente(primero, meses=1, desde=date(2027, 2, 1))
    assert segundo == (date(2027, 3, 1), date(2027, 3, 31))
