from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import usuarios, turnos

app = FastAPI(
    title="Taller Mecanico API",
    description="API REST con FastAPI + PostgreSQL + SQLAlchemy",
    version="1.0.0",
)

# CORS (para que el frontend pueda consumir la API)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # En producción poné solo el dominio del frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(usuarios.router)
app.include_router(turnos.router)


@app.get("/")
def home():
    return {"mensaje": "Taller Mecanico API funcionando"}