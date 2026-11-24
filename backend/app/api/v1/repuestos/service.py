from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.api.v1.repuestos import repository
from app.models.notificacion import NotificacionInterna
from app.models.repuesto import Repuesto
from app.models.usuario import Usuario
from app.schemas.paginacion import ParametrosPagina
from app.schemas.repuesto import IngresoStockRequest, RepuestoCreate, RepuestoResponse, RepuestoUpdate
from app.schemas.sin_dinero import ve_dinero


class AvisoStockResponse(BaseModel):
    """Aviso interno del taller (hoy: stock mínimo de repuestos)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    tipo: str
    repuesto_id: Optional[int] = None
    mensaje: str
    creado_en: datetime
    leida_en: Optional[datetime] = None


def _to_response(repuesto, usuario: Usuario | None = None) -> RepuestoResponse:
    """Respuesta del repuesto. Las lecturas pasan el usuario: si su rol no ve
    dinero (el mecánico), el precio va en null. Las escrituras son solo de
    administración y recepción, que sí lo ven."""
    respuesta = RepuestoResponse.model_validate(repuesto)
    respuesta.stock_bajo = repuesto.stock <= repuesto.stock_minimo
    respuesta.sin_dinero = usuario is not None and not ve_dinero(usuario)
    return respuesta


def _get_or_404(db: Session, repuesto_id: int):
    repuesto = repository.get_by_id(db, repuesto_id)
    if repuesto is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Repuesto no encontrado",
        )
    return repuesto


def _validar_codigo_unico(db: Session, codigo: str, excluir_id: int | None) -> None:
    repetido = repository.get_by_codigo(db, codigo)
    if repetido and repetido.id != excluir_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya hay un repuesto cargado con ese código.",
        )


def _evaluar_aviso_stock_minimo(db: Session, repuesto: Repuesto) -> None:
    """Maneja el aviso de stock mínimo después de un movimiento.

    `stock_minimo` en 0 significa "sin mínimo configurado": no se avisa.
    Una sola notificación por cruce del umbral: mientras el stock siga en o
    por debajo del mínimo (`alerta_stock_enviada`) no se repite; cuando el
    stock vuelve a superarlo el flag se rearma y el próximo cruce avisa de
    nuevo. Todo queda en la misma transacción que el movimiento.
    """
    if repuesto.stock_minimo <= 0:
        return
    if repuesto.stock > repuesto.stock_minimo:
        repuesto.alerta_stock_enviada = False
        return
    if repuesto.alerta_stock_enviada:
        return
    repuesto.alerta_stock_enviada = True
    db.add(
        NotificacionInterna(
            taller_id=repuesto.taller_id,
            tipo=NotificacionInterna.TIPO_STOCK_BAJO,
            repuesto_id=repuesto.id,
            mensaje=(
                f"Stock bajo: {repuesto.nombre} ({repuesto.codigo}) "
                f"quedó en {repuesto.stock}; mínimo {repuesto.stock_minimo}"
            ),
        )
    )


def registrar_movimiento_stock(db: Session, repuesto: Repuesto, delta: int) -> bool:
    """Único punto que mueve el stock de un repuesto.

    `delta` es la variación (negativo = descuento por uso en una orden,
    positivo = ingreso o devolución). El descuento es atómico: si no alcanza
    el stock no se mueve nada y devuelve False (el caller traduce a 409).
    Al terminar evalúa el umbral de stock mínimo y crea/rearma el aviso
    interno. Devuelve True si el movimiento se aplicó.
    """
    if delta == 0:
        return True
    if delta < 0:
        movimiento = db.execute(
            update(Repuesto)
            .where(Repuesto.id == repuesto.id, Repuesto.stock >= -delta)
            .values(stock=Repuesto.stock + delta)
        )
        if movimiento.rowcount == 0:
            return False
    else:
        db.execute(
            update(Repuesto)
            .where(Repuesto.id == repuesto.id)
            .values(stock=Repuesto.stock + delta)
        )
    db.refresh(repuesto)
    _evaluar_aviso_stock_minimo(db, repuesto)
    return True


def list_repuestos(
    db: Session,
    *,
    solo_activos: bool = False,
    q: str | None = None,
    pagina: ParametrosPagina | None = None,
    usuario: Usuario | None = None,
) -> tuple[list[RepuestoResponse], int]:
    items = repository.list_repuestos(
        db, solo_activos=solo_activos, q=q, pagina=pagina
    )
    total = repository.contar_repuestos(db, solo_activos=solo_activos, q=q)
    return [_to_response(r, usuario) for r in items], total


def list_stock_bajo(db: Session, usuario: Usuario) -> list[RepuestoResponse]:
    return [_to_response(r, usuario) for r in repository.list_stock_bajo(db)]


def get_repuesto(db: Session, repuesto_id: int, usuario: Usuario) -> RepuestoResponse:
    return _to_response(_get_or_404(db, repuesto_id), usuario)


def create_repuesto(db: Session, data: RepuestoCreate) -> RepuestoResponse:
    payload = data.model_dump()
    _validar_codigo_unico(db, payload["codigo"], excluir_id=None)
    # Si nace ya por debajo del mínimo no hubo cruce por movimiento: el aviso
    # queda "enviado" para que el primer descuento no dispare una alerta
    # espuria (docs/Oferta.md 4b W3).
    payload["alerta_stock_enviada"] = (
        payload["stock_minimo"] > 0 and payload["stock"] <= payload["stock_minimo"]
    )
    return _to_response(repository.create(db, payload))


def update_repuesto(db: Session, repuesto_id: int, data: RepuestoUpdate) -> RepuestoResponse:
    repuesto = _get_or_404(db, repuesto_id)
    payload = data.model_dump(exclude_unset=True)
    for campo in ("codigo", "nombre", "stock", "stock_minimo", "precio", "activo"):
        if campo in payload and payload[campo] is None:
            payload.pop(campo)
    if "codigo" in payload:
        _validar_codigo_unico(db, payload["codigo"], excluir_id=repuesto.id)
    # El stock se mueve por delta para que un ajuste que baje del mínimo
    # también dispare el aviso (y uno que lo supere lo rearme).
    nuevo_stock = payload.pop("stock", None)
    repuesto = repository.update(db, repuesto, payload)
    if nuevo_stock is not None and nuevo_stock != repuesto.stock:
        if not registrar_movimiento_stock(db, repuesto, nuevo_stock - repuesto.stock):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="No se puede bajar el stock por debajo de cero.",
            )
        db.commit()
        db.refresh(repuesto)
    return _to_response(repuesto)


def delete_repuesto(db: Session, repuesto_id: int) -> None:
    repuesto = _get_or_404(db, repuesto_id)
    if repository.tiene_detalles(db, repuesto.id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se puede eliminar: el repuesto se usó en órdenes. Desactivalo.",
        )
    repository.delete(db, repuesto)


def ingresar_stock(db: Session, repuesto_id: int, datos: IngresoStockRequest) -> RepuestoResponse:
    repuesto = _get_or_404(db, repuesto_id)
    if not repuesto.activo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede ingresar stock de un repuesto inactivo.",
        )
    registrar_movimiento_stock(db, repuesto, datos.cantidad)
    db.commit()
    db.refresh(repuesto)
    return _to_response(repuesto)


def list_avisos(db: Session, *, solo_no_leidas: bool = False) -> list[AvisoStockResponse]:
    """Avisos internos del taller, más nuevos primero (tope 100)."""
    stmt = (
        select(NotificacionInterna)
        .order_by(NotificacionInterna.id.desc())
        .limit(100)
    )
    if solo_no_leidas:
        stmt = stmt.where(NotificacionInterna.leida_en.is_(None))
    return [AvisoStockResponse.model_validate(a) for a in db.scalars(stmt)]


def marcar_aviso_leido(db: Session, aviso_id: int, usuario: Usuario) -> None:
    aviso = db.get(NotificacionInterna, aviso_id)
    if aviso is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Aviso no encontrado",
        )
    if aviso.leida_en is None:
        aviso.leida_en = datetime.now(timezone.utc)
        aviso.leida_por_id = usuario.id
        db.commit()
