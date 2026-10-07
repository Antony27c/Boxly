from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models.turno import Turno
from app.schemas.turno import TurnoCreate, TurnoUpdate, TurnoOut

router = APIRouter(prefix="/turnos", tags=["Turnos"])


@router.get("/", response_model=List[TurnoOut])
def listar_turnos(db: Session = Depends(get_db)):
    return db.query(Turno).all()


@router.get("/{turno_id}", response_model=TurnoOut)
def obtener_turno(turno_id: int, db: Session = Depends(get_db)):
    turno = db.query(Turno).filter(Turno.id == turno_id).first()
    if not turno:
        raise HTTPException(status_code=404, detail="Turno no encontrado")
    return turno


@router.post("/", response_model=TurnoOut, status_code=status.HTTP_201_CREATED)
def crear_turno(data: TurnoCreate, db: Session = Depends(get_db)):
    turno = Turno(**data.model_dump())
    db.add(turno)
    db.commit()
    db.refresh(turno)
    return turno


@router.put("/{turno_id}", response_model=TurnoOut)
def editar_turno(turno_id: int, data: TurnoUpdate, db: Session = Depends(get_db)):
    turno = db.query(Turno).filter(Turno.id == turno_id).first()
    if not turno:
        raise HTTPException(status_code=404, detail="Turno no encontrado")

    for campo, valor in data.model_dump(exclude_unset=True).items():
        setattr(turno, campo, valor)

    db.commit()
    db.refresh(turno)
    return turno