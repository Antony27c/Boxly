# ruff: noqa: F811 (los fixtures se importan de otro módulo de tests)
"""Cupo de personal: una bajada de plan y un alta a la vez no pueden dejar al
taller por encima del límite del plan nuevo (auditoría R2, bug 4)."""
import threading

from app.api.v1.suscripcion import service as suscripcion_service
from app.api.v1.users import service as users_service
from app.db.session import SessionLocal
from app.models import Plan, Taller
from tests.test_caminos_criticos import (  # noqa: F401
    _body_usuario,
    _personal_activo,
    api,
    datos,
)


def _plan_chico_con_cupo_justo(taller_id: int) -> int:
    """Plan actual con un lugar libre y un plan "chico" con el cupo justo del
    personal de hoy: bajar o sumar, pero no las dos cosas."""
    ocupados = _personal_activo(taller_id)
    with SessionLocal() as db:
        taller = db.get(Taller, taller_id)
        db.get(Plan, taller.plan_codigo).max_personal = ocupados + 1
        db.add(Plan(codigo="chico", nombre="Chico", precio_mensual=1, max_personal=ocupados,
                    funciones=["gestion"], activo=True))
        db.commit()
    return ocupados


def _en_paralelo(monkeypatch, pedidos):
    """Las dos requests esperan en una barrera después de contar: sin lock,
    cuentan las dos antes de que ninguna escriba. Con el lock, la segunda
    espera el commit de la primera y la barrera vence."""
    barrera = threading.Barrier(2, timeout=2)

    def contar_y_esperar(original):
        def contar(db, taller_id):
            cantidad = original(db, taller_id)
            try:
                barrera.wait()
            except threading.BrokenBarrierError:
                pass
            return cantidad
        return contar

    monkeypatch.setattr(users_service, "personal_activo",
                        contar_y_esperar(users_service.personal_activo))
    monkeypatch.setattr(suscripcion_service, "personal_activo",
                        contar_y_esperar(suscripcion_service.personal_activo))
    respuestas = [None] * len(pedidos)

    def correr(i):
        respuestas[i] = pedidos[i]()

    hilos = [threading.Thread(target=correr, args=(i,)) for i in range(len(pedidos))]
    for hilo in hilos:
        hilo.start()
    for hilo in hilos:
        hilo.join(timeout=30)
    return respuestas


def _taller_dentro_del_cupo(taller_id: int) -> bool:
    with SessionLocal() as db:
        plan = db.get(Plan, db.get(Taller, taller_id).plan_codigo)
    return plan.max_personal is None or _personal_activo(taller_id) <= plan.max_personal


def test_alta_en_paralelo_con_bajada_de_plan(api, datos, monkeypatch):
    _plan_chico_con_cupo_justo(1)
    h = datos["headers"]["admin"]

    respuestas = _en_paralelo(
        monkeypatch,
        [
            lambda: api.post("/api/v1/users", headers=h, json=_body_usuario("nuevo@x.com")),
            lambda: api.put("/api/v1/suscripcion/plan", headers=h, json={"plan": "chico"}),
        ],
    )

    codigos = [r.status_code for r in respuestas]
    assert _taller_dentro_del_cupo(1), f"taller fuera del cupo del plan: {codigos}"
    assert sorted(codigos) in ([200, 409], [201, 409]), codigos


def test_la_bajada_de_plan_libera_el_lock_si_falla(api, datos):
    """Un 409 de la bajada no deja tomado el lock del cupo: el alta siguiente entra."""
    ocupados = _plan_chico_con_cupo_justo(1)
    with SessionLocal() as db:
        db.get(Plan, "chico").max_personal = ocupados - 1
        db.commit()
    h = datos["headers"]["admin"]

    assert api.put("/api/v1/suscripcion/plan", headers=h, json={"plan": "chico"}).status_code == 409
    alta = api.post("/api/v1/users", headers=h, json=_body_usuario("despues@x.com"))
    assert alta.status_code == 201, alta.text
