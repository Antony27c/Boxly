from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session
from fastapi import HTTPException
from typing import List, Optional
from datetime import date, datetime, timedelta

from app.models.horario_mecanico import HorarioMecanico
from app.models.orden import Orden
from app.models.turno import Turno
from app.models.usuario import Usuario, RolUsuario
from app.schemas.horario_mecanico import (
    HorarioMecanicoCreate,
    HorarioMecanicoUpdate,
    HorarioMecanicoResponse,
)
from .repository import mecanicos_repository

ESTADOS_CERRADOS = ("entregado", "cancelado")


class MecanicosService:
    def _validar_acceso(self, usuario: Usuario, mecanico_id: int, que: str) -> None:
        # Admin y recepción ven a todos los mecánicos; un mecánico solo a sí mismo
        if usuario.rol == RolUsuario.mecanico and usuario.id != mecanico_id:
            raise HTTPException(status_code=403, detail=f"Solo podés ver tu propio {que}")

    def _obtener_mecanico(self, db: Session, mecanico_id: int) -> Usuario:
        mecanico = db.get(Usuario, mecanico_id)
        if not mecanico or mecanico.rol != RolUsuario.mecanico:
            raise HTTPException(status_code=404, detail="Mecánico no encontrado")
        return mecanico

    def _obtener_horario(self, db: Session, mecanico_id: int, horario_id: int) -> HorarioMecanico:
        horario = mecanicos_repository.obtener_horario(db, horario_id)
        if not horario or horario.mecanico_id != mecanico_id:
            raise HTTPException(status_code=404, detail="Horario no encontrado")
        return horario

    def listar_horarios(self, db: Session, mecanico_id: int, usuario: Usuario) -> List[HorarioMecanicoResponse]:
        self._validar_acceso(usuario, mecanico_id, "horario")
        self._obtener_mecanico(db, mecanico_id)
        return [
            HorarioMecanicoResponse.model_validate(h)
            for h in mecanicos_repository.listar_horarios(db, mecanico_id)
        ]

    def crear_horario(
        self, db: Session, mecanico_id: int, datos: HorarioMecanicoCreate
    ) -> HorarioMecanicoResponse:

        mecanico = db.get(Usuario, mecanico_id)

        if not mecanico or mecanico.rol != RolUsuario.mecanico or not mecanico.activo:
            raise HTTPException(status_code=400, detail="El usuario no es un mecánico activo")

        if datos.hora_desde >= datos.hora_hasta:
            raise HTTPException(status_code=400, detail="hora_desde debe ser menor que hora_hasta")

        self._validar_superposicion(db, mecanico_id, datos.dia_semana, datos.hora_desde, datos.hora_hasta)

        horario = HorarioMecanico(
            mecanico_id=mecanico_id,
            dia_semana=datos.dia_semana,
            hora_desde=datos.hora_desde,
            hora_hasta=datos.hora_hasta,
        )
        return HorarioMecanicoResponse.model_validate(
            mecanicos_repository.crear_horario(db, horario)
        )

    def actualizar_horario(
        self, db: Session, mecanico_id: int, horario_id: int, datos: HorarioMecanicoUpdate
    ) -> HorarioMecanicoResponse:
        horario = self._obtener_horario(db, mecanico_id, horario_id)

        dia = datos.dia_semana if datos.dia_semana is not None else horario.dia_semana
        desde = datos.hora_desde if datos.hora_desde is not None else horario.hora_desde
        hasta = datos.hora_hasta if datos.hora_hasta is not None else horario.hora_hasta

        if desde >= hasta:
            raise HTTPException(status_code=400, detail="hora_desde debe ser menor que hora_hasta")

        self._validar_superposicion(
            db, horario.mecanico_id, dia, desde, hasta, excluir_id=horario_id
        )

        horario.dia_semana = dia
        horario.hora_desde = desde
        horario.hora_hasta = hasta

        return HorarioMecanicoResponse.model_validate(
            mecanicos_repository.actualizar_horario(db, horario)
        )

    def eliminar_horario(self, db: Session, mecanico_id: int, horario_id: int) -> None:
        horario = self._obtener_horario(db, mecanico_id, horario_id)
        mecanicos_repository.eliminar_horario(db, horario)

    def _validar_superposicion(
        self,
        db: Session,
        mecanico_id: int,
        dia_semana: int,
        hora_desde: str,
        hora_hasta: str,
        excluir_id: Optional[int] = None,
    ) -> None:
        stmt = select(HorarioMecanico).where(
            HorarioMecanico.mecanico_id == mecanico_id,
            HorarioMecanico.dia_semana == dia_semana,
        )
        if excluir_id:
            stmt = stmt.where(HorarioMecanico.id != excluir_id)

        for h in db.scalars(stmt).all():
            if hora_desde < h.hora_hasta and hora_hasta > h.hora_desde:
                raise HTTPException(
                    status_code=409,
                    detail="La franja horaria se superpone con otra del mismo día",
                )

    def calendario(
        self, db: Session, mecanico_id: int, usuario: Usuario, desde: Optional[date] = None, hasta: Optional[date] = None
    ) -> dict:
        self._validar_acceso(usuario, mecanico_id, "calendario")
        mecanico = self._obtener_mecanico(db, mecanico_id)

        if not desde or not hasta:
            hoy = date.today()
            desde = hoy - timedelta(days=hoy.weekday())
            hasta = desde + timedelta(days=6)
        if desde > hasta:
            raise HTTPException(status_code=400, detail="desde no puede ser posterior a hasta")

        inicio = datetime.combine(desde, datetime.min.time())
        fin = datetime.combine(hasta + timedelta(days=1), datetime.min.time())

        horarios = mecanicos_repository.listar_horarios(db, mecanico_id)

        stmt_turnos = select(Turno).where(
            Turno.mecanico_id == mecanico_id,
            Turno.fecha_hora >= inicio,
            Turno.fecha_hora < fin,
        ).order_by(Turno.fecha_hora)
        turnos = list(db.scalars(stmt_turnos).all())

        # Contrato S7: órdenes abiertas en el rango (ingresaron antes del fin y siguen
        # abiertas) o que se entregaron dentro del rango.
        stmt_ordenes = select(Orden).where(
            Orden.mecanico_id == mecanico_id,
            or_(
                and_(Orden.estado.not_in(ESTADOS_CERRADOS), Orden.fecha_ingreso < fin),
                and_(Orden.estado == "entregado", Orden.fecha_entrega >= inicio, Orden.fecha_entrega < fin),
            ),
        ).order_by(Orden.fecha_ingreso)
        ordenes = list(db.scalars(stmt_ordenes).all())

        return {
            "mecanico": {
                "id": mecanico.id,
                "nombre": mecanico.nombre,
                "apellido": mecanico.apellido,
            },
            "desde": desde.isoformat(),
            "hasta": hasta.isoformat(),
            "horarios": [
                {
                    "id": h.id,
                    "mecanico_id": h.mecanico_id,
                    "dia_semana": h.dia_semana,
                    "hora_desde": h.hora_desde,
                    "hora_hasta": h.hora_hasta,
                }
                for h in horarios
            ],
            "turnos": [
                {
                    "id": t.id,
                    "cliente_id": t.cliente_id,
                    "vehiculo_id": t.vehiculo_id,
                    "mecanico_id": t.mecanico_id,
                    "fecha_hora": t.fecha_hora.isoformat() if t.fecha_hora else None,
                    "estado": t.estado,
                    "motivo": t.motivo,
                    "notas": t.notas,
                    "registrado_por_id": t.registrado_por_id,
                }
                for t in turnos
            ],
            "ordenes": [
                {
                    "id": o.id,
                    "codigo": o.codigo,
                    "estado": o.estado,
                    "vehiculo_patente": o.vehiculo.patente if o.vehiculo else None,
                    "vehiculo_marca": o.vehiculo.marca if o.vehiculo else None,
                    "vehiculo_modelo": o.vehiculo.modelo if o.vehiculo else None,
                    "fecha_ingreso": o.fecha_ingreso.isoformat() if o.fecha_ingreso else None,
                    "fecha_estimada_entrega": o.fecha_estimada_entrega.isoformat() if o.fecha_estimada_entrega else None,
                }
                for o in ordenes
            ],
        }


mecanicos_service = MecanicosService()
