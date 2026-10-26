from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class ImagenOrdenResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    orden_id: int
    etapa: Optional[str] = None
    url: str
    usuario_id: Optional[int] = None
    usuario_nombre: Optional[str] = None
    fecha: datetime
