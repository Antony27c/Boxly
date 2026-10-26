from pydantic import BaseModel, ConfigDict

class MarcaResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str
    activo: bool

class ModeloResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:int
    marca_id: int
    nombre: str
    activo: bool
