"""Los locks que releen la fila con ``populate_existing`` no pueden pisar
cambios sin flushear (seguimiento de R3h).

``SessionLocal`` tiene ``autoflush=False``: si una request ensucia la fila
del taller antes de tomar el lock, la relectura devolvía los valores viejos
de la base y el cambio pendiente se perdía en el commit (así se resucitaba
el cobro automático recién cancelado al pasar un taller a piloto). Los
helpers flushean antes de releer: ``reservar_cupo`` (cupo de personal y
cambio de plan) y ``_taller_bloqueado`` (registro de pagos).
"""
from decimal import Decimal

from sqlalchemy import select

from app.api.v1.suscripcion import service as sus_service
from app.core.suscripcion import reservar_cupo
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models import PagoSuscripcion, Taller
from app.models.suscripcion import EstadoPagoSuscripcion, MedioPagoSuscripcion

NOMBRE_ORIGINAL = "Taller principal"
NOMBRE_PENDIENTE = "Nombre que todavía no commiteó"


def _taller_con_cambio_pendiente(db) -> Taller:
    """El taller 1 con un UPDATE pendiente (sin flush ni commit)."""
    taller = db.get(Taller, 1)
    assert taller.nombre == NOMBRE_ORIGINAL
    taller.nombre = NOMBRE_PENDIENTE
    return taller


def test_reservar_cupo_no_pisa_cambios_pendientes():
    """Con un UPDATE pendiente del taller, reservar_cupo lo flushea antes de
    releer con populate_existing: el cambio sobrevive al lock y al commit."""
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)

    with SessionLocal() as db:
        taller = _taller_con_cambio_pendiente(db)
        releido = reservar_cupo(db, taller.id)
        # Sin el flush, populate_existing devolvía el nombre viejo de la base.
        assert releido.nombre == NOMBRE_PENDIENTE
        assert taller.nombre == NOMBRE_PENDIENTE
        db.commit()

    with SessionLocal() as db:
        assert db.get(Taller, 1).nombre == NOMBRE_PENDIENTE


def test_taller_bloqueado_no_pisa_cambios_pendientes():
    """Lo mismo en el lock de registrar_pago: un cambio pendiente del taller
    no se pierde cuando _taller_bloqueado relee la fila."""
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)

    with SessionLocal() as db:
        taller = _taller_con_cambio_pendiente(db)
        pago = sus_service.registrar_pago(
            db,
            taller,
            monto=Decimal("100.00"),
            medio=MedioPagoSuscripcion.manual,
            estado=EstadoPagoSuscripcion.pendiente,
        )
        assert pago is not None
        assert taller.nombre == NOMBRE_PENDIENTE
        db.commit()

    with SessionLocal() as db:
        assert db.get(Taller, 1).nombre == NOMBRE_PENDIENTE
        pagos = db.scalars(
            select(PagoSuscripcion).where(PagoSuscripcion.taller_id == 1)
        ).all()
        assert len(pagos) == 1
