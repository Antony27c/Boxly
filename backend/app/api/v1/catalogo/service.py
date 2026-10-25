from sqlalchemy.orm import Session
from typing import List, Optional

from app.models.marca import Marca
from app.models.modelo import Modelo
from app.schemas.catalogo import MarcaResponse, ModeloResponse
from .repository import catalogo_repository

class CatalogoService:
    def listar_marcas(self,db: Session, q: Optional[str] = None) -> List[MarcaResponse]:
        marcas= catalogo_repository.buscar_marcas(db, q)
        return [MarcaResponse.model_validate(m) for m in marcas]

    def listar_modelos(self, db: Session, marca_id: Optional[int] = None) -> List[ModeloResponse]:
        modelos = catalogo_repository.buscar_modelos(db, marca_id)
        return [ModeloResponse.model_validate(m) for m in modelos]

Catalogo_service= CatalogoService()