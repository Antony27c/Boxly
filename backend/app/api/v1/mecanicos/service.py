from sqlalchemy import select
from sqlalchemy.orm import Session
from fastapi import HTTPException
from typing import List, Optional
from datetime import date, timedelta, time

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


class MecanicosService:
    def listar_horarios(self, db: Session, mecanico_id: int, usuario: Usuario) -> List[HorarioMecanicoResponse]:
        if usuario.rol != RolUsuario.administrador and usuario.id != mecanico_id:
            raise HTTPException(status_code=403, detail="Solo podés ver tus propios horarios")
        return [
            HorarioMecanicoResponse.model_validate(h)
            for h in mecanicos_repository.listar_horarios(db, mecanico_id)
        ]

    def crear_horario(
        self, db: Session, mecanico_id: int, datos: HorarioMecanicoCreate
    ) -> HorarioMecanicoResponse:
        
        mecanico = db.get(Usuario, mecanico_id)
    
        if not mecanico or mecanico.rol != RolUsuario.mecanico:
            raise HTTPException(status_code=400, detail="El usuario no es un mecánico")

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
        self, db: Session, horario_id: int, datos: HorarioMecanicoUpdate
    ) -> HorarioMecanicoResponse:
        horario = mecanicos_repository.obtener_horario(db, horario_id)
        if not horario:
            raise HTTPException(status_code=404, detail="Horario no encontrado")

        dia = datos.dia_semana if datos.dia_semana is not None else horario.dia_semana
        desde = datos.hora_desde if datos.hora_desde is not None else horario.hora_desde
        hasta = datos.hora_hasta if datos.hora_hasta is not None else horario.hora_hasta

        
        if desde >= hasta:
            raise HTTPException(status_code=400, detail="hora_desde debe ser menor que hora_hasta")

        self._validar_superposicion(
            db, horario.mecanico_id, dia, desde, hasta, excluir_id=horario_id
        )

        if datos.dia_semana is not None:
            horario.dia_semana = datos.dia_semana
        if datos.hora_desde is not None:
            horario.hora_desde = datos.hora_desde
        if datos.hora_hasta is not None:
            horario.hora_hasta = datos.hora_hasta

        return HorarioMecanicoResponse.model_validate(
            mecanicos_repository.actualizar_horario(db, horario)
        )

    def eliminar_horario(self, db: Session, horario_id: int) -> None:
        horario = mecanicos_repository.obtener_horario(db, horario_id)
        if not horario:
            raise HTTPException(status_code=404, detail="Horario no encontrado")
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
        if usuario.rol != RolUsuario.administrador and usuario.id != mecanico_id:
            raise HTTPException(status_code=403, detail="Solo podés ver tu propio calendario")
        
        
        if not desde or not hasta:
            hoy = date.today()
            desde = hoy - timedelta(days=hoy.weekday())
            hasta = desde + timedelta(days=6)

        
        horarios = mecanicos_repository.listar_horarios(db, mecanico_id)

        
        stmt_turnos = select(Turno).where(
            Turno.mecanico_id == mecanico_id,
            Turno.fecha_hora >= desde,
            Turno.fecha_hora < (hasta + timedelta(days=1)), 
        )
        turnos = list(db.scalars(stmt_turnos).all())

        stmt_ordenes = select(Orden).where(
            Orden.mecanico_id == mecanico_id,
            Orden.fecha_ingreso >= desde,
            Orden.fecha_ingreso < (hasta + timedelta(days=1)),
        )
        ordenes = list(db.scalars(stmt_ordenes).all())

        mecanico = db.get(Usuario, mecanico_id)
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