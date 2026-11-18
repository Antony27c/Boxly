from datetime import date, datetime, time
from zoneinfo import ZoneInfo

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.api.v1.clientes import repository as clientes_repository
from app.api.v1.turnos import repository
from app.api.v1.vehiculos import repository as vehiculos_repository
from app.models.usuario import RolUsuario, Usuario
from app.schemas.turno import (
    TurnoCreate,
    TurnoEstadoUpdate,
    TurnoResponse,
    TurnoUpdate,
)


HORAS_TURNO = (8, 10, 12, 14, 16)

ZONA_TALLER = ZoneInfo("America/Argentina/Buenos_Aires")

# Estados del schema (DER §3.7): el turno avanza hacia completado y se puede
# cancelar desde cualquier estado no terminal; completado y cancelado son
# terminales.
TRANSICIONES_TURNO = {
    "pendiente": ["confirmado", "cancelado"],
    "confirmado": ["asistio", "en_taller", "completado", "cancelado"],
    "asistio": ["en_taller", "completado", "cancelado"],
    "en_taller": ["completado", "cancelado"],
    "completado": [],
    "cancelado": [],
}


def _normalizar_horario(fecha_hora: datetime) -> datetime:
    """Deja la hora en horario del taller, sin zona: la grilla y la
    superposición comparan contra lo que queda guardado."""
    if fecha_hora.tzinfo is None:
        return fecha_hora
    return fecha_hora.astimezone(ZONA_TALLER).replace(tzinfo=None)


def _validar_horario(fecha_hora) -> None:
    """Los turnos se dan cada 2 horas, en punto (misma grilla que el formulario)."""
    if fecha_hora.hour not in HORAS_TURNO or fecha_hora.minute or fecha_hora.second:
        horarios = ", ".join(f"{hora:02d}:00" for hora in HORAS_TURNO)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Los turnos se dan cada 2 horas. Horarios disponibles: {horarios}.",
        )


def _to_response(turno) -> TurnoResponse:
    return TurnoResponse.model_validate(turno)


def _get_or_404(db: Session, turno_id: int, mecanico_id: int | None = None):
    turno = repository.get_by_id(db, turno_id)
    if turno is None or (mecanico_id is not None and turno.mecanico_id != mecanico_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Turno no encontrado",
        )
    return turno


def _validar_relaciones(
    db: Session, cliente_id: int, vehiculo_id: int | None
) -> None:
    if clientes_repository.get_by_id(db, cliente_id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No encontramos ese cliente.",
        )
    if vehiculo_id is not None:
        vehiculo = vehiculos_repository.get_by_id(db, vehiculo_id)
        if vehiculo is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No encontramos ese vehículo.",
            )
        if vehiculo.cliente_id != cliente_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El vehículo no pertenece al cliente seleccionado.",
            )


def _validar_mecanico(db: Session, mecanico_id: int | None) -> None:
    if mecanico_id is None:
        return
    mecanico = db.get(Usuario, mecanico_id)
    if mecanico is None or mecanico.rol != RolUsuario.mecanico or not mecanico.activo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El usuario asignado no es un mecánico activo.",
        )


def _validar_transicion(estado_actual: str, estado_nuevo: str) -> None:
    if estado_nuevo == estado_actual:
        return
    if estado_nuevo not in TRANSICIONES_TURNO.get(estado_actual, []):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Transición inválida: no se puede pasar de "
                f"'{estado_actual}' a '{estado_nuevo}'."
            ),
        )


def _validar_disponibilidad(
    db: Session,
    fecha_hora: datetime,
    mecanico_id: int | None = None,
    excluir_id: int | None = None,
) -> None:
    # TODO: es check-then-act; dos requests simultáneos pueden crear el mismo
    # slot. El índice único parcial (fecha_hora, mecanico_id) WHERE
    # estado <> 'cancelado' que suma la migración posterior lo vuelve a
    # prueba de carreras.
    if repository.horario_ocupado(
        db, fecha_hora, mecanico_id=mecanico_id, excluir_id=excluir_id
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ese horario ya está ocupado. Elegí otro.",
        )


def _limite_rango(valor: date | datetime | None, *, es_fin: bool) -> datetime | None:
    """Normaliza el parámetro de rango a datetime naive del taller.

    Un `date` abarca el día completo: desde = 00:00:00, hasta = 23:59:59.999999.
    Un `datetime` se usa tal cual (con zona se pasa a horario del taller).
    """
    if valor is None:
        return None
    if isinstance(valor, datetime):
        return _normalizar_horario(valor)
    if es_fin:
        return datetime.combine(valor, time.max)
    return datetime.combine(valor, time.min)


def list_turnos(
    db: Session,
    *,
    estado: str | None = None,
    cliente_id: int | None = None,
    mecanico_id: int | None = None,
    desde: date | datetime | None = None,
    hasta: date | datetime | None = None,
    limit: int | None = None,
    offset: int = 0,
) -> tuple[list[TurnoResponse], int]:
    turnos, total = repository.list_turnos(
        db,
        estado=estado,
        cliente_id=cliente_id,
        mecanico_id=mecanico_id,
        desde=_limite_rango(desde, es_fin=False),
        hasta=_limite_rango(hasta, es_fin=True),
        limit=limit,
        offset=offset,
    )
    return [_to_response(t) for t in turnos], total


def get_turno(
    db: Session, turno_id: int, mecanico_id: int | None = None
) -> TurnoResponse:
    return _to_response(_get_or_404(db, turno_id, mecanico_id))


def create_turno(
    db: Session, data: TurnoCreate, registrado_por: Usuario
) -> TurnoResponse:
    payload = data.model_dump()
    payload["fecha_hora"] = _normalizar_horario(payload["fecha_hora"])
    _validar_relaciones(db, payload["cliente_id"], payload.get("vehiculo_id"))
    _validar_mecanico(db, payload.get("mecanico_id"))
    _validar_horario(payload["fecha_hora"])
    _validar_disponibilidad(
        db, payload["fecha_hora"], mecanico_id=payload.get("mecanico_id")
    )

    turno = repository.create(
        db, {**payload, "registrado_por_id": registrado_por.id, "estado": "pendiente"}
    )
    return _to_response(turno)


def update_turno(db: Session, turno_id: int, data: TurnoUpdate) -> TurnoResponse:
    turno = _get_or_404(db, turno_id)

    payload = data.model_dump(exclude_unset=True)
    if "fecha_hora" in payload:
        payload["fecha_hora"] = _normalizar_horario(payload["fecha_hora"])
    cliente_id = payload.get("cliente_id", turno.cliente_id)
    vehiculo_id = payload.get("vehiculo_id", turno.vehiculo_id)
    fecha_hora = payload.get("fecha_hora", turno.fecha_hora)
    nuevo_estado = payload.get("estado", turno.estado)
    mecanico_id = payload["mecanico_id"] if "mecanico_id" in payload else turno.mecanico_id

    _validar_relaciones(db, cliente_id, vehiculo_id)
    if payload.get("mecanico_id") is not None and payload["mecanico_id"] != turno.mecanico_id:
        _validar_mecanico(db, payload["mecanico_id"])
    if payload.get("estado") is not None and payload["estado"] != turno.estado:
        _validar_transicion(turno.estado, payload["estado"])
    # Un turno viejo (fuera de la grilla) se puede seguir editando mientras no se le cambie la hora.
    if "fecha_hora" in payload and payload["fecha_hora"].replace(tzinfo=None) != turno.fecha_hora.replace(tzinfo=None):
        _validar_horario(fecha_hora)
    if nuevo_estado != "cancelado" and ("fecha_hora" in payload or "mecanico_id" in payload):
        _validar_disponibilidad(
            db, fecha_hora, mecanico_id=mecanico_id, excluir_id=turno.id
        )

    return _to_response(repository.update(db, turno, payload))


def cambiar_estado(
    db: Session, turno_id: int, data: TurnoEstadoUpdate, mecanico_id: int | None = None
) -> TurnoResponse:
    turno = _get_or_404(db, turno_id, mecanico_id)
    _validar_transicion(turno.estado, data.estado)
    return _to_response(repository.update(db, turno, {"estado": data.estado}))


def delete_turno(db: Session, turno_id: int) -> None:
    turno = _get_or_404(db, turno_id)
    repository.delete(db, turno)
