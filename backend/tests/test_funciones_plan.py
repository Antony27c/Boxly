"""C0: funciones por plan, adicionales del taller y migración de la oferta
nueva (docs/Oferta.md, sección 4)."""
import json
from datetime import date, timedelta
from pathlib import Path

import pytest
from sqlalchemy import create_engine, text

from app.core.funciones import (
    FUNCION_ARCA,
    FUNCION_GESTION,
    FUNCION_MARCA_PROPIA,
    FUNCION_RECORDATORIOS_SERVICE,
    FUNCION_WHATSAPP_AUTOMATICO,
    FUNCION_WHATSAPP_MANUAL,
    taller_tiene,
)
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models import AdicionalTaller, Taller

ALEMBIC_DIR = Path(__file__).resolve().parent.parent / "alembic"
REV_ANTERIOR = "c5a9e3f7d214"  # cabeza antes de la migración de la oferta
REV_NUEVA = "a9f2c7d1e4b8"


@pytest.fixture
def talleres():
    """Taller 1 (esencial, el que siembra create_all) y un taller Pro."""
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        t2 = Taller(nombre="Taller Pro", plan_codigo="pro")
        db.add(t2)
        db.flush()
        t2_id = t2.id
        db.commit()
        return {"esencial": 1, "pro": t2_id}


def _adicional(taller_id, codigo, **campos):
    with SessionLocal() as db:
        a = AdicionalTaller(taller_id=taller_id, codigo=codigo, **campos)
        db.add(a)
        db.commit()
        return a.id


# --- taller_tiene ---------------------------------------------------------------


def test_funciones_por_plan(talleres):
    with SessionLocal() as db:
        esencial = db.get(Taller, talleres["esencial"])
        pro = db.get(Taller, talleres["pro"])

        # Esencial: gestión diaria y WhatsApp manual.
        assert taller_tiene(db, esencial, FUNCION_GESTION)
        assert taller_tiene(db, esencial, FUNCION_WHATSAPP_MANUAL)
        # Lo que no está en su plan.
        assert not taller_tiene(db, esencial, FUNCION_WHATSAPP_AUTOMATICO)
        assert not taller_tiene(db, esencial, FUNCION_ARCA)
        assert not taller_tiene(db, esencial, FUNCION_RECORDATORIOS_SERVICE)
        assert not taller_tiene(db, esencial, FUNCION_MARCA_PROPIA)

        # Pro suma WhatsApp automático y ARCA, y hereda lo de Esencial.
        assert taller_tiene(db, pro, FUNCION_GESTION)
        assert taller_tiene(db, pro, FUNCION_WHATSAPP_MANUAL)
        assert taller_tiene(db, pro, FUNCION_WHATSAPP_AUTOMATICO)
        assert taller_tiene(db, pro, FUNCION_ARCA)
        # Lo que solo tiene Profesional.
        assert not taller_tiene(db, pro, FUNCION_RECORDATORIOS_SERVICE)
        assert not taller_tiene(db, pro, FUNCION_MARCA_PROPIA)


def test_adicional_activo_habilita_la_funcion(talleres):
    hoy = date.today()
    _adicional(talleres["esencial"], FUNCION_ARCA,
               desde=hoy - timedelta(days=1), hasta=hoy + timedelta(days=30))
    with SessionLocal() as db:
        taller = db.get(Taller, talleres["esencial"])
        assert taller_tiene(db, taller, FUNCION_ARCA)
        # El adicional no le regala las funciones que ya tiene Pro.
        assert not taller_tiene(db, taller, FUNCION_WHATSAPP_AUTOMATICO)


def test_adicional_vencido_o_inactivo_no_habilita(talleres):
    hoy = date.today()
    tid = talleres["esencial"]
    _adicional(tid, FUNCION_ARCA, hasta=hoy - timedelta(days=1))   # vencido
    _adicional(tid, FUNCION_MARCA_PROPIA, activo=False)              # inactivo
    _adicional(tid, FUNCION_RECORDATORIOS_SERVICE,
               desde=hoy + timedelta(days=10))                        # todavía no
    with SessionLocal() as db:
        taller = db.get(Taller, tid)
        assert not taller_tiene(db, taller, FUNCION_ARCA)
        assert not taller_tiene(db, taller, FUNCION_MARCA_PROPIA)
        assert not taller_tiene(db, taller, FUNCION_RECORDATORIOS_SERVICE)


def test_adicional_sin_fechas_es_vigente(talleres):
    _adicional(talleres["esencial"], FUNCION_ARCA)
    with SessionLocal() as db:
        taller = db.get(Taller, talleres["esencial"])
        assert taller_tiene(db, taller, FUNCION_ARCA)


def test_adicional_de_otro_taller_no_cuenta(talleres):
    _adicional(talleres["pro"], FUNCION_RECORDATORIOS_SERVICE)
    with SessionLocal() as db:
        esencial = db.get(Taller, talleres["esencial"])
        assert not taller_tiene(db, esencial, FUNCION_RECORDATORIOS_SERVICE)


# --- Migración de la oferta -------------------------------------------------------


def _script():
    from alembic.config import Config
    from alembic.script import ScriptDirectory

    cfg = Config()
    cfg.set_main_option("script_location", str(ALEMBIC_DIR))
    return ScriptDirectory.from_config(cfg)


def _revisiones_hasta(destino):
    """Ids de migración desde la base hasta `destino`, en orden de aplicación."""
    revs = list(_script().iterate_revisions(destino, "base"))
    revs.reverse()
    return [r.revision for r in revs]


def _aplicar(engine_mig, revision, operacion):
    """Corre upgrade() o downgrade() de una migración sobre `engine_mig`,
    sin pasar por env.py (que apuntaría a la base de tests)."""
    from alembic.migration import MigrationContext
    from alembic.operations import Operations

    rev = _script().get_revision(revision)
    with engine_mig.begin() as conn:
        contexto = MigrationContext.configure(conn)
        with Operations.context(contexto):
            getattr(rev.module, operacion)()


def _tablas(engine_mig):
    with engine_mig.connect() as conn:
        return {
            r[0]
            for r in conn.execute(
                text("SELECT name FROM sqlite_master WHERE type = 'table'")
            )
        }


def _verificar_estado_nuevo(engine_mig):
    """La base quedó con los planes de la oferta, tipo_acceso y adicionales."""
    with engine_mig.connect() as conn:
        filas = conn.execute(
            text(
                "SELECT codigo, nombre, precio_mensual, max_personal, funciones "
                "FROM planes ORDER BY codigo"
            )
        ).mappings().all()
        planes = {f["codigo"]: f for f in filas}
        assert set(planes) == {"esencial", "pro", "profesional"}

        esencial = planes["esencial"]
        assert esencial["nombre"] == "Esencial"
        assert float(esencial["precio_mensual"]) == 35000
        assert esencial["max_personal"] == 3
        assert set(json.loads(esencial["funciones"])) == {
            FUNCION_GESTION, FUNCION_WHATSAPP_MANUAL,
        }

        pro = planes["pro"]
        assert pro["nombre"] == "Pro"
        assert float(pro["precio_mensual"]) == 79000
        assert pro["max_personal"] == 10
        assert set(json.loads(pro["funciones"])) == {
            FUNCION_GESTION, FUNCION_WHATSAPP_MANUAL,
            FUNCION_WHATSAPP_AUTOMATICO, FUNCION_ARCA,
        }

        profesional = planes["profesional"]
        assert profesional["nombre"] == "Profesional"
        assert float(profesional["precio_mensual"]) == 169000
        assert profesional["max_personal"] is None
        assert set(json.loads(profesional["funciones"])) == {
            FUNCION_GESTION, FUNCION_WHATSAPP_MANUAL,
            FUNCION_WHATSAPP_AUTOMATICO, FUNCION_ARCA,
            FUNCION_RECORDATORIOS_SERVICE, FUNCION_MARCA_PROPIA,
        }

        talleres = conn.execute(
            text("SELECT id, plan_codigo, tipo_acceso FROM talleres ORDER BY id")
        ).mappings().all()
        assert [(t["id"], t["plan_codigo"], t["tipo_acceso"]) for t in talleres] == [
            (1, "esencial", "pago"),
            (2, "profesional", "pago"),
        ]

        # El pago cargado en el esquema viejo sigue ahí.
        pagos = conn.execute(
            text("SELECT taller_id, monto FROM pagos_suscripcion")
        ).mappings().all()
        assert [(p["taller_id"], float(p["monto"])) for p in pagos] == [(1, 15000.0)]

    assert "adicionales_taller" in _tablas(engine_mig)


def _verificar_estado_viejo(engine_mig):
    """El downgrade devuelve la base al esquema y datos de antes de C0."""
    with engine_mig.connect() as conn:
        filas = conn.execute(
            text("SELECT codigo, nombre, precio_mensual, max_personal FROM planes")
        ).mappings().all()
        planes = {f["codigo"]: f for f in filas}
        assert set(planes) == {"basico", "pro", "taller_plus"}
        assert planes["basico"]["nombre"] == "Básico"
        assert float(planes["basico"]["precio_mensual"]) == 15000
        assert planes["basico"]["max_personal"] == 3
        assert planes["pro"]["nombre"] == "Pro"
        assert float(planes["pro"]["precio_mensual"]) == 30000
        assert planes["taller_plus"]["nombre"] == "Taller+"
        assert float(planes["taller_plus"]["precio_mensual"]) == 50000
        assert planes["taller_plus"]["max_personal"] is None

        talleres = conn.execute(
            text("SELECT id, plan_codigo FROM talleres ORDER BY id")
        ).mappings().all()
        assert [(t["id"], t["plan_codigo"]) for t in talleres] == [
            (1, "basico"),
            (2, "taller_plus"),
        ]

        pagos = conn.execute(
            text("SELECT taller_id, monto FROM pagos_suscripcion")
        ).mappings().all()
        assert len(pagos) == 1

    tablas = _tablas(engine_mig)
    assert "adicionales_taller" not in tablas
    with engine_mig.connect() as conn:
        columnas = {
            r[1] for r in conn.execute(text("PRAGMA table_info(talleres)"))
        }
        assert "tipo_acceso" not in columnas
        columnas_plan = {
            r[1] for r in conn.execute(text("PRAGMA table_info(planes)"))
        }
        assert "funciones" not in columnas_plan


def test_migracion_oferta_upgrade_downgrade_upgrade(tmp_path):
    """upgrade -> downgrade -> upgrade sobre una copia de la base con datos."""
    engine_mig = create_engine(f"sqlite:///{tmp_path / 'boxly.db'}")
    try:
        # Esquema viejo completo (hasta la cabeza anterior a C0).
        for revision in _revisiones_hasta(REV_ANTERIOR):
            _aplicar(engine_mig, revision, "upgrade")

        # Datos de prueba en el esquema viejo: el taller principal (id=1, lo
        # crea la migración multi-taller) queda en basico y sumo uno en
        # taller_plus, más un pago de suscripción.
        with engine_mig.begin() as conn:
            conn.execute(
                text("UPDATE talleres SET plan_codigo = 'basico' WHERE id = 1")
            )
            conn.execute(
                text(
                    "INSERT INTO talleres (nombre, estado, plan_codigo) "
                    "VALUES ('Plus', 'activo', 'taller_plus')"
                )
            )
            conn.execute(
                text(
                    "INSERT INTO pagos_suscripcion "
                    "(taller_id, monto, periodo_desde, periodo_hasta, medio, estado) "
                    "VALUES (1, 15000, '2026-01-01', '2026-01-31', 'manual', 'aprobado')"
                )
            )

        # upgrade: planes nuevos, tipo_acceso y adicionales_taller.
        _aplicar(engine_mig, REV_NUEVA, "upgrade")
        _verificar_estado_nuevo(engine_mig)

        # downgrade: vuelve todo como estaba.
        _aplicar(engine_mig, REV_NUEVA, "downgrade")
        _verificar_estado_viejo(engine_mig)

        # upgrade otra vez: mismo estado nuevo, datos intactos.
        _aplicar(engine_mig, REV_NUEVA, "upgrade")
        _verificar_estado_nuevo(engine_mig)
    finally:
        engine_mig.dispose()
