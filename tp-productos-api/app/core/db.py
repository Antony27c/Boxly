from app.models.categoria import Categoria
from app.models.producto import Producto

#Categorias
categorias: list[Categoria] =[
    Categoria(id=1, nombre="PERIFERICOS"),
    Categoria(id=2, nombre="PLACA DE VIDEO"),
    Categoria(id=3, nombre="PROCESADORES"),
]
#Productos
productos: list[Producto]= [
    Producto(
        id=1,
        nombre="MOUSE GAMER",
        precio=15000,
        categoria_id=1,
        stock=10),
    Producto(
        id=2,
        nombre="TECLADO GAMER",
        precio=20000,
        categoria_id=1,
        stock=5),
    Producto(
        id=3,
        nombre="5600XT",
        precio=380000,
        categoria_id=2,
        stock=3),
    Producto(
        id=4,
        nombre="1050TI",
        precio=125000,
        categoria_id=2,
        stock=7),
    Producto(
        id=5,
        nombre="RYZEN 5 5600X",
        precio=395900,
        categoria_id=3,
        stock=5),
    Producto(
        id=6,
        nombre="INTEL I7 12700K",
        precio=254000,
        categoria_id=3,
        stock=3),
    Producto(
        id=7,
        nombre="INTEL I5 12400F",
        precio=198900,
        categoria_id=3,
        stock=10),
    Producto(
        id=8,
        nombre="RYZEN 5 5600G",
        precio=356000,
        categoria_id=3,
        stock=10),
]
id_proximo=9;

def bump_producto_id() -> int:
    global id_proximo
    id_actual = id_proximo
    id_proximo += 1
    return id_actual
