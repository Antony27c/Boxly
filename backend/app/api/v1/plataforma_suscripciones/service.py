"""Suscripciones vistas desde la plataforma (superadmin, docs/Suscripciones.md S1).

Delega en ``app.api.v1.suscripcion.service``: la lógica de planes, pagos y
vencimiento es la misma que usa el taller.
"""
from app.api.v1.suscripcion import service


def listar_planes(db):
    return service.listar_planes(db)


def actualizar_plan(db, codigo, datos):
    return service.actualizar_plan(db, codigo, datos)


def suscripcion_taller(db, taller_id):
    return service.suscripcion_con_pagos(db, taller_id)


def cambiar_plan_taller(db, taller_id, codigo):
    taller = service.taller_por_id(db, taller_id)
    return service.cambiar_plan(db, taller, codigo)


def registrar_pago(db, taller_id, datos, usuario):
    taller = service.taller_por_id(db, taller_id)
    return service.pago_response(
        db, service.registrar_pago_manual(db, taller, datos, usuario)
    )


def ajustar_vencimiento(db, taller_id, vence_en):
    taller = service.taller_por_id(db, taller_id)
    return service.ajustar_vencimiento(db, taller, vence_en)
