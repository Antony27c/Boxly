from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime

class OrdenBase(BaseModel):
    descripcion: str

class OrdenCreate(OrdenBase):
    pass

class OrdenUpdate(BaseModel):
    estado: Optional[str]=None
    mecanico_id: Optional[int]=None
    descripcion: Optional[str]=None

class OrdenResponse(OrdenBase):
    id:int
    estado:str
    fecha_creacion: datetime
    mecanico_id=Optional[int]= None