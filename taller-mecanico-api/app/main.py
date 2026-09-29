from fastapi import FastAPI

app = FastAPI(
    title="Taller Mecanico API",
    description="API REST con FastAPI + PostgreSQL + SQLAlchemy (capa de datos: 8 entidades)",
    version="1.0.0",
)


@app.get("/")
def home():
    return {"mensaje": "Taller Mecanico API - capa de datos lista. Endpoints REST: proximo paso."}


# Los routers (endpoints REST) todavia no estan implementados.
# Por ahora este proyecto solo expone los modelos SQLAlchemy + migraciones Alembic + seed.
