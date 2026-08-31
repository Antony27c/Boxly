from fastapi import FastAPI

from app.api.v1.productos.router import router as productos_router

app = FastAPI(
    title="Boxly API",
    description="API de productos - TP Practicas Profesionalizantes II",
)


@app.get("/")
def home():
    return {"mensaje": "Bienvenido a la API de Boxly"}


app.include_router(productos_router)
