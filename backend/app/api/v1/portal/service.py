from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.api.v1.ordenes.service import orden_service
from app.api.v1.pagos.service import puede_pagar
from app.api.v1.portal import repository
from app.api.v1.vehiculos import repository as vehiculos_repository
from app.models.orden import Orden
from app.models.usuario import Usuario
from app.schemas.orden import ESTADOS_ORDEN as ETAPAS
from app.schemas.pago import PagoResponse
from app.schemas.portal import (
    EtapaResponse,
    MiOrdenDetalle,
    MiOrdenResumen,
    MiVehiculoResponse,
    OrdenActivaResumen,
    PasoResponse,
    VehiculoResumen,
)

CAMINO = ("pendiente", "ingresado", "en_diagnostico", "esperando_repuestos", "listo", "entregado")
OPCIONALES = {"esperando_repuestos"}
CERRADOS = {"entregado", "cancelado"}


def _nombre(codigo: str) -> str:
    return ETAPAS.get(codigo, (codigo, ""))[0]


def _etapa(codigo: str) -> EtapaResponse:
    nombre, descripcion = ETAPAS.get(codigo, (codigo, ""))
    return EtapaResponse(codigo=codigo, nombre=nombre, descripcion=descripcion)


def _paso(codigo: str, estado: str) -> PasoResponse:
    return PasoResponse(codigo=codigo, nombre=_nombre(codigo), estado=estado)


def _armar_pasos(orden: Orden) -> list[PasoResponse]:
    historial = sorted(orden.historial_estados, key=lambda h: (h.fecha, h.id))
    visitados = {h.estado_nuevo for h in historial}
    cancelado = orden.estado == "cancelado"
    if cancelado:
        cancelaciones = [h for h in historial if h.estado_nuevo == "cancelado"]
        ultimo = cancelaciones[-1].estado_anterior if cancelaciones else None
        hasta = CAMINO.index(ultimo) if ultimo in CAMINO else 0
    else:
        hasta = CAMINO.index(orden.estado) if orden.estado in CAMINO else 0

    pasos = []
    for indice, codigo in enumerate(CAMINO):
        salteado = codigo in OPCIONALES and codigo not in visitados
        if cancelado:
            estado = "completado" if indice <= hasta and not salteado else "omitido"
        elif indice < hasta:
            estado = "omitido" if salteado else "completado"
        elif indice == hasta:
            estado = "actual"
        else:
            estado = "pendiente"
        pasos.append(_paso(codigo, estado))
    if cancelado:
        pasos.append(_paso("cancelado", "actual"))
    return pasos


def _resumen(orden: Orden) -> MiOrdenResumen:
    return MiOrdenResumen(
        id=orden.id,
        codigo=orden.codigo,
        estado=orden.estado,
        vehiculo_id=orden.vehiculo_id,
        vehiculo_patente=orden.vehiculo.patente,
        vehiculo_marca=orden.vehiculo.marca,
        vehiculo_modelo=orden.vehiculo.modelo,
        fecha_ingreso=orden.fecha_ingreso,
        fecha_estimada_entrega=orden.fecha_estimada_entrega,
        costo_final=orden.costo_final,
        pagada=orden.pagada,
    )


def list_mis_vehiculos(db: Session, usuario: Usuario) -> list[MiVehiculoResponse]:
    ordenes = repository.list_ordenes(db, usuario.cliente_id)
    respuesta = []
    for vehiculo in vehiculos_repository.list_vehiculos(db, cliente_id=usuario.cliente_id):
        propias = [o for o in ordenes if o.vehiculo_id == vehiculo.id]
        activa = next((o for o in propias if o.estado not in CERRADOS), None)
        item = MiVehiculoResponse.model_validate(vehiculo)
        item.orden_activa = OrdenActivaResumen.model_validate(activa) if activa else None
        item.ordenes_total = len(propias)
        respuesta.append(item)
    return respuesta


def list_mis_ordenes(
    db: Session, usuario: Usuario, *, vehiculo_id: int | None = None
) -> list[MiOrdenResumen]:
    ordenes = repository.list_ordenes(db, usuario.cliente_id, vehiculo_id=vehiculo_id)
    return [_resumen(o) for o in ordenes]


def get_mi_orden(db: Session, usuario: Usuario, orden_id: int) -> MiOrdenDetalle:
    orden = repository.get_orden(db, usuario.cliente_id, orden_id)
    if orden is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Orden no encontrada",
        )
    return MiOrdenDetalle(
        id=orden.id,
        codigo=orden.codigo,
        estado=orden.estado,
        descripcion_ingreso=orden.descripcion_ingreso,
        diagnostico=orden.diagnostico,
        mecanico_nombre=orden.mecanico_nombre,
        costo_estimado=orden.costo_estimado,
        costo_final=orden.costo_final,
        fecha_ingreso=orden.fecha_ingreso,
        fecha_estimada_entrega=orden.fecha_estimada_entrega,
        fecha_entrega=orden.fecha_entrega,
        vehiculo=VehiculoResumen.model_validate(orden.vehiculo),
        etapa_actual=_etapa(orden.estado),
        pasos=_armar_pasos(orden),
        historial=orden_service.obtener_historial_orden(db, orden.id),
        imagenes=orden_service.listar_imagenes(db, orden.id),
        detalles=orden_service.listar_detalles(db, orden.id),
        pagada=orden.pagada,
        puede_pagar=puede_pagar(orden),
        pago=PagoResponse.model_validate(orden.pagos[-1]) if orden.pagos else None,
    )
