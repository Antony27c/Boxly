# Deploy de Boxly en un VPS con Docker Compose

Boxly en producción: API FastAPI + PostgreSQL + frontend estático (React/Vite)
detrás de Caddy, que emite el HTTPS automáticamente. Todo arranca con
`docker compose up -d`.

## Requisitos del VPS

- Ubuntu 22.04/24.04 (o similar) con ~2 GB de RAM libres.
- Docker Engine + plugin Compose:
  <https://docs.docker.com/engine/install/> (`docker compose version` tiene que responder).
- Un dominio con registro DNS tipo **A** apuntando a la IP pública del VPS.
- Puertos **80** y **443** abiertos (Caddy los usa para HTTP→HTTPS y el desafío ACME).

## Primer deploy, paso a paso

```bash
# 1. Subir el código al VPS (git clone o rsync de la carpeta del proyecto)
cd Boxly-chiquito        # la raíz donde está docker-compose.yml

# 2. Crear la configuración y completarla
cp .env.prod.example .env
nano .env
```

En `.env` completar como mínimo:

| Variable | Qué poner |
| --- | --- |
| `DOMINIO` | El dominio, sin `https://` (ej. `taller.example.com`) |
| `POSTGRES_PASSWORD` | Clave larga y aleatoria (y la misma dentro de `DATABASE_URL`) |
| `JWT_SECRET_KEY` | Generar con `openssl rand -hex 32` |
| `MP_ACCESS_TOKEN` | Access Token de **producción** de Mercado Pago |
| `SMTP_*` | Gmail SMTP con contraseña de aplicación |
| `BOXLY_ADMIN_PASSWORD` | Clave del primer administrador |

```bash
# 3. Levantar todo (primera vez tarda: baja imágenes y compila)
docker compose up -d --build

# 4. Verificar
docker compose ps              # db "healthy", api/web/caddy "running"
docker compose logs -f api     # las migraciones corren solas al arrancar api
docker compose logs -f caddy
```

Cuando el DNS ya propaga, `https://tudominio` sirve el frontend con certificado
válido (Caddy lo emite solo; los puertos 80/443 tienen que estar abiertos).

```bash
# 5. Crear el usuario administrador
#    (usa BOXLY_ADMIN_* del .env; si el usuario ya existe, no hace nada)
docker compose exec api python -m scripts.create_admin

# 6. Mercado Pago → ir a "Webhooks" del panel de desarrollador y registrar:
#    https://tudominio/api/v1/pagos/webhook
```

## Actualizar a una versión nueva

```bash
git pull
docker compose up -d --build    # recrea solo los servicios que cambiaron
docker compose logs -f api      # verificar que las migraciones corrieron bien
```

Las migraciones de Alembic corren automáticamente cada vez que arranca el
servicio `api` (`alembic upgrade head` en su entrypoint).

## Backups

`scripts/backup.sh` genera un dump comprimido de PostgreSQL y un tar del
volumen `uploads` en `./backups/boxly-AAAAMMDD-HHMMSS/`, conservando los
últimos 14 días (`DIAS_RETENCION` para cambiarlo).

Cron diario, por ejemplo a las 3:00:

```bash
crontab -e
# 0 3 * * *  cd /ruta/al/proyecto && bash scripts/backup.sh >> backups/backup.log 2>&1
```

## Restaurar un backup

```bash
bash scripts/restore.sh backups/boxly-20260101-030000
# pide confirmación; --yes la salta (para automatizar)
```

**Ojo:** borra la base de datos actual y reemplaza `uploads` antes de cargar
el backup. Hacerlo con la API detenida o aceptar el `restart` final que hace el
script.

## Logs y diagnóstico

```bash
docker compose logs -f api      # API (uvicorn/gunicorn + migraciones)
docker compose logs -f web      # nginx del frontend
docker compose logs -f caddy    # HTTPS, certificados y enrutado
docker compose logs -f db       # PostgreSQL
docker compose ps               # estado y healthchecks
docker compose exec api python -c "import urllib.request;print(urllib.request.urlopen('http://127.0.0.1:8000/').status)"
```

## Notas

- La API **no** expone puerto público: solo Caddy le habla por la red interna
  de compose. Todo el tráfico entra por `https://DOMINIO`.
- `/api/*` y `/uploads/*` van a `api:8000`; el resto al frontend (`web:80`).
- El frontend se compila con `VITE_API_URL` vacío: las llamadas a la API son
  relativas al mismo origen y las resuelve Caddy. No hace falta tocarla salvo
  que la API viviera en otro dominio.
- `uploads/` vive en el volumen `uploads` de compose: sobrevive a
  `docker compose down` y a rebuilds. `pgdata` guarda la base de datos.
- Mantenimiento ocasional: `docker system prune` y revisar `docker compose ps`.
