# Redirige al entrypoint en capas (app.main).
# Ejecutar desde esta carpeta:
#   uvicorn app.main:app --reload
from app.main import app

__all__ = ["app"]
