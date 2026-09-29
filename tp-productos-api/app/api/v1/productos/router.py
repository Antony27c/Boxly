from fastapi import APIRouter, HTTPException, status

from app.api.v1.productos import repository
from app.api.v1.productos.schemas import (ProductoCreate, ProductoUpdate, ProductoResponse)

router=APIRouter(
    prefix="/productos",
    tags=["Productos"]
)

@router.get("", response_model=list[ProductoResponse])
def list_productos(query: str | None=None, categoria_id: int | None=None):
    productos=repository.search_by_nombre(query) if query else repository.list_productos()
    if categoria_id is not None:
        productos = [p for p in productos if p["categoria"] is not None and p["categoria"]["id"] == categoria_id]
    return productos 


@router.get("/{producto_id}", response_model=ProductoResponse)
def obtener_producto(producto_id: int):
    producto = repository.get_by_id(producto_id)
    if producto is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Producto no encontrado")
    return producto

@router.post("", response_model=ProductoResponse, status_code=status.HTTP_201_CREATED)
def crear_producto(data: ProductoCreate):
    ok, error = repository.ensure_categoria(data.categoria_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error)
    return repository.create(data)

@router.put("/{producto_id}", response_model=ProductoResponse)
def actualizar_producto(producto_id: int, data: ProductoUpdate):
    existente = repository.get_by_id(producto_id)
    if existente is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Producto no encontrado")
    if data.categoria_id is not None:
        ok, error = repository.ensure_categoria(data.categoria_id)
        if not ok:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error)
    return repository.update(producto_id, data)
    
@router.delete("/{producto_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_producto(producto_id: int):
    if not repository.delete(producto_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Producto no encontrado")
    return None

   

   
