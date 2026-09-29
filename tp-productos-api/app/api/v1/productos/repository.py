from typing import Optional

from app.core import db
from app.models.producto import Producto
from app.models.categoria import Categoria
from app.api.v1.productos.schemas import ProductoCreate , ProductoUpdate

def _find_categoria(categoria_id: int) -> Optional[Categoria]:
    for categoria in db.categorias:
        if categoria.id == categoria_id:
            return categoria
    return None


def _to_dict(p: Producto) -> dict: 
    categoria = _find_categoria(p.categoria_id)
    return {
        "id": p.id,
        "nombre": p.nombre,
        "precio": p.precio,
        "stock": p.stock,
        "activo": p.activo,
        "categoria": {
            "id": categoria.id,
            "nombre": categoria.nombre
        } if categoria else None
    }
def list_productos() -> list[dict]:
    return [_to_dict(p) for p in db.productos]

def get_by_id(producto_id: int) -> Optional[dict]:
    for p in db.productos:
        if p.id == producto_id:
            return _to_dict(p)
    return None

def search_by_nombre(query:str) -> list[dict]:
    query_lower = query.lower()
    return [_to_dict(p) for p in db.productos 
            if query_lower in p.nombre.lower()]
def ensure_categoria(categoria_id:int) -> tuple[bool, Optional[str]]:
            if _find_categoria(categoria_id) is None:
                return False, f"La Categoria {categoria_id} no existe"
            return True, None

def create(data: ProductoCreate) -> dict:
    producto = Producto(
        id=db.bump_producto_id(),
        nombre=data.nombre,
        precio=data.precio,
        stock=data.stock,
        categoria_id=data.categoria_id,
        activo=True
    )
    db.productos.append(producto)
    return _to_dict(producto)

def update(producto_id: int, data: ProductoUpdate) -> dict | None:
    for p in db.productos:
        if p.id == producto_id:
            cambios = data.model_dump(exclude_unset=True)
            for campo, valor in cambios.items():
                setattr(p, campo, valor)
            return _to_dict(p)
    return None

def delete(producto_id: int) -> bool:
    for i, p in enumerate(db.productos):
        if p.id == producto_id:
            del db.productos[i]
            return True
    return False