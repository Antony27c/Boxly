"""Tests de preapprovals huérfanas de Mercado Pago (tarea P5).

`activar_cobro` reutiliza una preapproval viva del mismo taller cuando la
respuesta de MP se perdió en un intento anterior, en vez de crear otra.
`barrer_preapprovals_huerfanas` cancela las que ningún taller referencia.
Todo MP se mockea: ningún test llama a Mercado Pago de verdad.
"""
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.api.v1.suscripcion_mp import cliente_mp, service
from app.core import mercadopago
from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.main import app
from app.models import Taller, Usuario
from app.models.usuario import RolUsuario

BASE = "/api/v1/suscripcion"


@pytest.fixture
def datos():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        admin = Usuario(nombre="Admin", apellido="Uno", email="admin@x.com",
                        password_hash=hash_password("x"), rol=RolUsuario.administrador)
        db.add(admin)
        db.flush()
        taller2 = Taller(nombre="Taller Dos", estado="activo")
        db.add(taller2)
        db.commit()
        headers = {
            "admin": {"Authorization": "Bearer " + create_access_token(admin.id)},
        }
        return {"headers": headers, "taller2_id": taller2.id}


@pytest.fixture
def api():
    with TestClient(app) as cliente:
        yield cliente


def _settings(monkeypatch, **cambios):
    """Settings de prueba para el service (sin tocar config.py)."""
    fake = SimpleNamespace(
        debug=True,
        environment="dev",
        boxly_mp_access_token="tok-boxly",
        boxly_mp_webhook_secret=None,
        frontend_url="http://front.test",
        backend_public_url=None,
    )
    for clave, valor in cambios.items():
        setattr(fake, clave, valor)
    monkeypatch.setattr(service, "get_settings", lambda: fake)
    return fake


def _paginas_mp(monkeypatch, paginas):
    """Mockea mercadopago.listar_preapprovals con una lista de páginas."""
    llamadas = []

    def fake(token, *, limite=50, offset=0):
        llamadas.append(offset)
        indice = offset // 50
        if indice >= len(paginas):
            return {"paging": {"total": 0}, "results": []}
        return paginas[indice]

    monkeypatch.setattr(mercadopago, "listar_preapprovals", fake)
    return llamadas


def _preapproval_mp(pid, ref, status="pending", **extra):
    base = {"id": pid, "external_reference": ref, "status": status}
    base.update(extra)
    return base


def _taller(db, taller_id=1):
    return db.get(Taller, taller_id)


# --- activar_cobro: reutilización ---------------------------------------------


def test_activar_reutiliza_preapproval_pendiente(api, datos, monkeypatch):
    """La preapproval del intento perdido se adopta: no se crea otra."""
    _settings(monkeypatch)
    _paginas_mp(monkeypatch, [{
        "paging": {"total": 2},
        "results": [
            _preapproval_mp("pre-otra", "taller-99"),
            _preapproval_mp("pre-vieja", "taller-1", init_point="https://mp.test/vieja"),
        ],
    }])
    creadas = []
    monkeypatch.setattr(
        cliente_mp, "crear_preapproval",
        lambda *a, **k: creadas.append(k) or {"id": "pre-nueva"},
    )
    monkeypatch.setattr(
        cliente_mp, "obtener_preapproval",
        lambda token, pid: {"id": pid, "init_point": "https://mp.test/vieja",
                            "status": "pending"},
    )
    monkeypatch.setattr(cliente_mp, "actualizar_preapproval", lambda *a, **k: {})

    r = api.post(f"{BASE}/cobro-automatico", headers=datos["headers"]["admin"])
    assert r.status_code == 201, r.text
    assert r.json()["init_point"] == "https://mp.test/vieja"
    assert creadas == []
    with SessionLocal() as db:
        taller = _taller(db)
        assert taller.mp_preapproval_id == "pre-vieja"
        assert taller.cobro_automatico is False  # pending: falta que el pagador autorice


def test_activar_reutiliza_autorizada_deja_cobro_activo(api, datos, monkeypatch):
    _settings(monkeypatch)
    _paginas_mp(monkeypatch, [{
        "paging": {"total": 1},
        "results": [_preapproval_mp("pre-ok", "taller-1", status="authorized")],
    }])
    monkeypatch.setattr(
        cliente_mp, "crear_preapproval", lambda *a, **k: pytest.fail("no debe crear")
    )
    monkeypatch.setattr(
        cliente_mp, "obtener_preapproval",
        lambda token, pid: {"id": pid, "init_point": "https://mp.test/ok",
                            "status": "authorized"},
    )
    monkeypatch.setattr(cliente_mp, "actualizar_preapproval", lambda *a, **k: {})

    r = api.post(f"{BASE}/cobro-automatico", headers=datos["headers"]["admin"])
    assert r.status_code == 201, r.text
    with SessionLocal() as db:
        taller = _taller(db)
        assert taller.mp_preapproval_id == "pre-ok"
        assert taller.cobro_automatico is True


def test_activar_sin_vigente_crea_como_antes(api, datos, monkeypatch):
    """Sin preapproval del taller en MP, el flujo normal crea una nueva."""
    _settings(monkeypatch)
    _paginas_mp(monkeypatch, [{
        "paging": {"total": 1},
        "results": [_preapproval_mp("pre-ajena", "taller-2")],
    }])
    creadas = []
    monkeypatch.setattr(
        cliente_mp, "crear_preapproval",
        lambda token, **kwargs: creadas.append(kwargs) or {
            "id": "pre-nueva", "init_point": "https://mp.test/nueva",
            "status": "pending",
        },
    )
    monkeypatch.setattr(
        cliente_mp, "obtener_preapproval", lambda *a, **k: pytest.fail("no debe consultar")
    )

    r = api.post(f"{BASE}/cobro-automatico", headers=datos["headers"]["admin"])
    assert r.status_code == 201, r.text
    assert len(creadas) == 1
    assert creadas[0]["external_reference"] == "taller-1"
    with SessionLocal() as db:
        assert _taller(db).mp_preapproval_id == "pre-nueva"


def test_activar_ignora_vigente_cancelada(api, datos, monkeypatch):
    """Una cancelada/pausada del mismo taller no se reutiliza: se crea otra."""
    _settings(monkeypatch)
    _paginas_mp(monkeypatch, [{
        "paging": {"total": 2},
        "results": [
            _preapproval_mp("pre-cancelada", "taller-1", status="cancelled"),
            _preapproval_mp("pre-pausada", "taller-1", status="paused"),
        ],
    }])
    monkeypatch.setattr(
        cliente_mp, "crear_preapproval",
        lambda *a, **k: {"id": "pre-nueva", "init_point": "x", "status": "pending"},
    )
    monkeypatch.setattr(
        cliente_mp, "obtener_preapproval", lambda *a, **k: pytest.fail("no debe consultar")
    )
    r = api.post(f"{BASE}/cobro-automatico", headers=datos["headers"]["admin"])
    assert r.status_code == 201, r.text
    with SessionLocal() as db:
        assert _taller(db).mp_preapproval_id == "pre-nueva"


def test_activar_busqueda_caida_no_bloquea(api, datos, monkeypatch):
    """Si /preapproval/search falla se crea igual (fail-open): el barrido es
    la red de seguridad. Bloquear el alta por un error de búsqueda sería peor."""
    _settings(monkeypatch)

    def fake(*a, **k):
        raise mercadopago.MercadoPagoError("timeout")

    monkeypatch.setattr(mercadopago, "listar_preapprovals", fake)
    creadas = []
    monkeypatch.setattr(
        cliente_mp, "crear_preapproval",
        lambda token, **kwargs: creadas.append(kwargs) or {
            "id": "pre-nueva", "init_point": "x", "status": "pending",
        },
    )
    r = api.post(f"{BASE}/cobro-automatico", headers=datos["headers"]["admin"])
    assert r.status_code == 201, r.text
    assert len(creadas) == 1


def test_activar_reutilizada_sincroniza_monto(api, datos, monkeypatch):
    """La preapproval reutilizada puede ser de un plan viejo: se actualiza."""
    _settings(monkeypatch)
    _paginas_mp(monkeypatch, [{
        "paging": {"total": 1},
        "results": [_preapproval_mp("pre-vieja", "taller-1")],
    }])
    monkeypatch.setattr(
        cliente_mp, "obtener_preapproval",
        lambda token, pid: {"id": pid, "init_point": "x", "status": "pending"},
    )
    actualizadas = []
    monkeypatch.setattr(
        cliente_mp, "actualizar_preapproval",
        lambda token, pid, **kwargs: actualizadas.append((pid, kwargs)) or {},
    )
    r = api.post(f"{BASE}/cobro-automatico", headers=datos["headers"]["admin"])
    assert r.status_code == 201, r.text
    assert len(actualizadas) == 1
    assert actualizadas[0][0] == "pre-vieja"
    assert "monto" in actualizadas[0][1]


def test_paginacion_del_search(datos, monkeypatch):
    """_preapprovals_mp recorre todas las páginas hasta agotar results."""
    _settings(monkeypatch)
    _paginas_mp(monkeypatch, [
        {"paging": {"total": 2}, "results": [_preapproval_mp("p1", "taller-9")]},
        {"paging": {"total": 2}, "results": [_preapproval_mp("p2", "taller-8")]},
        {"paging": {"total": 2}, "results": []},
    ])
    with SessionLocal() as db:
        taller = _taller(db)
        assert service._preapproval_vigente_mp("tok", taller) is None


# --- barrer_preapprovals_huerfanas ---------------------------------------------


def _mp_search(monkeypatch, resultados):
    """Mockea listar_preapprovals con una sola página de resultados."""
    _paginas_mp(monkeypatch, [{
        "paging": {"total": len(resultados)},
        "results": resultados,
    }])


def test_barrer_dry_run_no_cancela(datos, monkeypatch):
    with SessionLocal() as db:
        t1 = _taller(db, 1)
        t1.mp_preapproval_id = "pre-ok"
        t2 = db.get(Taller, datos["taller2_id"])
        t2.mp_preapproval_id = "pre-2"
        db.commit()

    _mp_search(monkeypatch, [
        _preapproval_mp("pre-ok", "taller-1", status="authorized"),   # registrada: queda
        _preapproval_mp("pre-2", "taller-2"),                        # registrada: queda
        _preapproval_mp("pre-huerfana", "taller-1"),                  # huérfana
        _preapproval_mp("pre-huerfana-2", "taller-77", status="authorized"),
        _preapproval_mp("pre-ajena", "suscripcion-manual"),          # sin ref de taller
        _preapproval_mp("pre-vieja-cancelada", "taller-1", status="cancelled"),
        {"external_reference": "taller-9", "status": "pending"},  # sin id: se ignora
    ])
    canceladas = []
    monkeypatch.setattr(
        cliente_mp, "cancelar_preapproval",
        lambda token, pid: canceladas.append(pid) or {},
    )

    with SessionLocal() as db:
        resumen = service.barrer_preapprovals_huerfanas(db, token="tok", dry_run=True)

    assert {h["id"] for h in resumen["huerfanas"]} == {"pre-huerfana", "pre-huerfana-2"}
    assert resumen["canceladas"] == []
    assert canceladas == []


def test_barrer_aplicar_cancela_solo_huerfanas(datos, monkeypatch):
    with SessionLocal() as db:
        t1 = _taller(db, 1)
        t1.mp_preapproval_id = "pre-ok"
        db.commit()

    _mp_search(monkeypatch, [
        _preapproval_mp("pre-ok", "taller-1"),
        _preapproval_mp("pre-huerfana", "taller-1"),
        _preapproval_mp("pre-huerfana-2", "taller-77", status="authorized"),
    ])
    canceladas = []
    monkeypatch.setattr(
        cliente_mp, "cancelar_preapproval",
        lambda token, pid: canceladas.append(pid) or {},
    )

    with SessionLocal() as db:
        resumen = service.barrer_preapprovals_huerfanas(db, token="tok", dry_run=False)

    assert sorted(canceladas) == ["pre-huerfana", "pre-huerfana-2"]
    assert sorted(resumen["canceladas"]) == ["pre-huerfana", "pre-huerfana-2"]


def test_barrer_falla_al_cancelar_no_aborta(datos, monkeypatch):
    """Si MP rechaza una cancelación, las demás se intentan igual."""
    _mp_search(monkeypatch, [
        _preapproval_mp("pre-h1", "taller-5"),
        _preapproval_mp("pre-h2", "taller-6"),
    ])

    def fake_cancel(token, pid):
        if pid == "pre-h1":
            raise cliente_mp.MercadoPagoError("mp caído")
        return {}

    monkeypatch.setattr(cliente_mp, "cancelar_preapproval", fake_cancel)
    with SessionLocal() as db:
        resumen = service.barrer_preapprovals_huerfanas(db, token="tok", dry_run=False)
    assert resumen["canceladas"] == ["pre-h2"]
    assert len(resumen["huerfanas"]) == 2


def test_barrer_sin_huerfanas(datos, monkeypatch):
    with SessionLocal() as db:
        _taller(db, 1).mp_preapproval_id = "pre-ok"
        db.commit()
    _mp_search(monkeypatch, [_preapproval_mp("pre-ok", "taller-1")])
    with SessionLocal() as db:
        resumen = service.barrer_preapprovals_huerfanas(db, token="tok")
    assert resumen == {"huerfanas": [], "canceladas": []}


def test_script_importable():
    """El comando python -m scripts.barrer_preapprovals tiene que importar."""
    import scripts.barrer_preapprovals  # noqa: F401
