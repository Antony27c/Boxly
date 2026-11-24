"""``taller_tiene`` usa el día argentino, no el del servidor (auditoría R2, bug 9).

En un servidor en UTC, después de las 21 de Argentina ``date.today()`` ya es
mañana: un adicional que vence hoy figuraba vigente en ``adicionales`` y no en
las funciones efectivas.
"""
from datetime import date, timedelta

from app.core import funciones
from app.core.suscripcion import hoy
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models import AdicionalTaller, Taller


class _ServidorEnUTC(date):
    """``date.today()`` de un servidor en UTC pasadas las 21 de Argentina."""

    @classmethod
    def today(cls):
        return hoy() + timedelta(days=1)


def test_adicional_que_vence_hoy_sigue_vigente_aunque_el_servidor_ya_este_en_manana(monkeypatch):
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    monkeypatch.setattr(funciones, "date", _ServidorEnUTC, raising=False)
    with SessionLocal() as db:
        taller = db.get(Taller, 1)
        taller.plan_codigo = "esencial"
        db.add(AdicionalTaller(taller_id=1, codigo="arca", activo=True, desde=hoy(), hasta=hoy()))
        db.commit()
        assert funciones.taller_tiene(db, taller, "arca")
