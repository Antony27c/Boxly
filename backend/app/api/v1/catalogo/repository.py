from sqlalchemy.orm import Session
from sqlalchemy import select
from typing import List, Optional

from app.models.marca import Marca
from app.models.modelo import Modelo

class CatalogoRepository:
    def buscar_marcas(self, db:Session, q: Optional[str] = None) -> List[Marca]:
        stmt = select(Marca).where(Marca.activo == True)
        if q:
            stmt = stmt.where(Marca.nombre.ilike(f"%{q}%"))
        stmt= stmt.order_by(Marca.nombre)
        return list(db.scalars(stmt).all())
    def buscar_modelos(self, db: Session, marca_id: Optional[int]= None) ->List[Modelo]:
        stmt = select(Modelo).where (Modelo.activo ==True)
        if marca_id:
            stmt=stmt.where(Modelo.marca_id == marca_id)
        stmt = stmt.order_by(Modelo.nombre)
        return list(db.scalars(stmt).all())

catalogo_repository = CatalogoRepository()