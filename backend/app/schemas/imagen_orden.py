from pydantic import BaseModel, ConfigDict
from datetime import datetime

class ImagenOrdenResponse(BaseModel):
    model_config= ConfigDict(from_attributes=True)

    id:int
    orden_id: int
    url: str
    fecha_subida: datetime
    