# syntax=docker/dockerfile:1
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# libpq5: cliente de PostgreSQL que usa psycopg2
RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq5 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
# gunicorn no está en requirements.txt: se instala acá sin tocar ese archivo.
RUN pip install --no-cache-dir -r requirements.txt gunicorn==23.0.0

RUN groupadd --system boxly && useradd --system --gid boxly --home-dir /app boxly

COPY . .
RUN mkdir -p uploads && chown -R boxly:boxly /app
USER boxly

EXPOSE 8000

# Primero las migraciones, después el servidor. `exec` deja a gunicorn
# como proceso principal para que reciba las señales de Docker.
CMD ["sh", "-c", "alembic upgrade head && exec gunicorn app.main:app -k uvicorn.workers.UvicornWorker -w ${WEB_CONCURRENCY:-2} -b 0.0.0.0:8000"]
