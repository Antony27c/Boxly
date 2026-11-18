# Boxly

**Sistema de gestión de taller mecánico automotriz**

Aplicación web Full Stack para administrar clientes, vehículos, órdenes de trabajo, repuestos, turnos, cobros y pagos online, con portal para el cliente.

Repositorio: [github.com/Antony27c/Boxly](https://github.com/Antony27c/Boxly)

## Integrantes

| Nombre | Rol |
|--------|-----|
| Antony Chocobar | Líder de proyecto / Scrum Master — autenticación, roles y DER |
| Julieta Andrea Cardozo | Frontend — clientes, vehículos, agenda y turnos |
| Gabriel Ulunqui | Backend — órdenes de trabajo y turnos |
| Pablo Romano | Backend / base de datos — PostgreSQL e inventario |

## Qué va a hacer el sistema

- **Clientes y vehículos:** alta, ficha técnica e historial de reparaciones.
- **Órdenes de trabajo:** flujo Pendiente → Ingresado → En diagnóstico → Esperando repuestos → Listo → Entregado (o Cancelado), con diagnóstico, repuestos, mano de obra e imágenes por etapa.
- **Cobro:** el taller emite el cobro (el mecánico propone el monto y recepción lo aprueba) y el cliente paga online.
- **Pagos online:** Mercado Pago en sandbox; el cliente paga desde su portal y el webhook confirma el resultado.
- **Inventario:** stock de repuestos con descuento automático al cargar líneas en la orden, devolución al cancelar y alertas de bajo inventario.
- **Agenda y turnos:** turnos cada 2 horas (08, 10, 12, 14 y 16), con mecánico opcional y calendario por mecánico.
- **Portal del cliente:** sus vehículos, el seguimiento de sus órdenes con línea de tiempo y fotos, y el pago.
- **Roles:** Administrador, Recepción, Mecánico y Cliente, con login JWT + bcrypt. El mecánico solo ve los clientes, vehículos, turnos y órdenes vinculados a sus trabajos.

## Stack

| Capa | Tecnología |
|------|------------|
| Frontend | React 18 + Vite + Tailwind CSS |
| Backend | Python / FastAPI / SQLAlchemy / Pydantic |
| Base de datos | PostgreSQL |
| Pagos | Mercado Pago (sandbox) |
| Email | Gmail SMTP |
| Versionado | Git + GitHub |
| Despliegue | VPS con Docker Compose (próximamente) |

## Estado actual del repositorio

```
Boxly/
├── backend/           # API FastAPI (auth JWT, usuarios, clientes, vehículos, turnos, órdenes, repuestos, pagos, portal, métricas)
├── frontend/          # Interfaz React + Vite
├── docs/DER.md        # Modelo entidad-relación (generado desde los modelos)
├── docs/Contratos_API_Semana7.md  # Contratos de la API
└── README.md
```

## Setup

### Backend

Desde `backend/`:

```bash
python -m venv venv
venv\Scripts\activate          # Windows (en Linux/macOS: source venv/bin/activate)
pip install -r requirements.txt
pip install -r requirements-dev.txt   # solo para correr los tests (pytest, httpx, ruff)
copy .env.example .env                # Linux/macOS: cp .env.example .env
```

Ajustar `backend/.env` (ver la tabla de variables más abajo). Crear la base `boxly` en PostgreSQL y luego:

```bash
alembic upgrade head             # crea las tablas
python -m scripts.create_admin   # admin inicial: pide la contraseña por terminal (o BOXLY_ADMIN_PASSWORD)
python -m scripts.seed_demo      # datos de demo (se puede correr varias veces, no duplica)
uvicorn app.main:app --reload
```

API en `http://127.0.0.1:8000`. La documentación interactiva está en `/docs`, **solo cuando `ENVIRONMENT=dev`** (en producción no se expone).

Tests:

```bash
python -m pytest -q
```

Otros scripts: `python -m scripts.seed` (datos aleatorios con Faker) y `python -m scripts.seed_catalogo` (solo marcas y modelos). Para cambios de modelo: `alembic revision --autogenerate -m "descripcion del cambio"` y luego `alembic upgrade head`.

### Frontend

Desde `frontend/`:

```bash
npm install
copy .env.example .env          # Linux/macOS: cp .env.example .env
npm run dev
```

`VITE_API_URL` tiene que apuntar al backend (`http://localhost:8000` por defecto). La app queda en `http://localhost:5173`.

## Variables de entorno del backend

Todas se definen en `backend/.env` (partir de `.env.example`). Las sensibles **nunca** se suben al repo.

### Entorno y seguridad

| Variable | Default | Descripción |
|----------|---------|-------------|
| `ENVIRONMENT` | `dev` | `dev` o `prod`. En `prod` la app no arranca sin `JWT_SECRET_KEY` real (≥ 32 caracteres, sin placeholders) y con `DEBUG=true`, y no expone `/docs` ni `/openapi.json`. |
| `DEBUG` | `false` | Modo debug. Habilita `POST /pagos/{id}/simular` (solo para el administrador) y permite crear pagos sin `MP_ACCESS_TOKEN`. Debe ser `false` en producción. |
| `RATE_LIMIT_ENABLED` | `true` | Rate limiting con slowapi. En `false` se desactiva (por ejemplo, para pruebas). Límites actuales: `POST /auth/login` 5/minuto y `POST /auth/activacion` 10/minuto por IP; al superarlos responde `429`. |
| `JWT_SECRET_KEY` | *(vacío)* | Secreto para firmar los JWT. Generar con `python -c "import secrets; print(secrets.token_urlsafe(48))"`. Obligatorio en producción; en dev, si queda vacío se usa uno inseguro de prueba (con warning en el log). |
| `JWT_ALGORITHM` | `HS256` | Algoritmo de firma del JWT. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` | Duración del token de acceso. |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Orígenes permitidos, separados por coma. |

### Base de datos

| Variable | Default | Descripción |
|----------|---------|-------------|
| `DATABASE_URL` | — | Si está definida, tiene prioridad sobre `POSTGRES_*` (ej. `sqlite:///./boxly.db` para pruebas rápidas). |
| `POSTGRES_USER` | `postgres` | Usuario de PostgreSQL. |
| `POSTGRES_PASSWORD` | — | Contraseña de PostgreSQL. |
| `POSTGRES_HOST` | `localhost` | Host de PostgreSQL. |
| `POSTGRES_PORT` | `5432` | Puerto de PostgreSQL. |
| `POSTGRES_DB` | `boxly` | Nombre de la base. |

### Mercado Pago

| Variable | Default | Descripción |
|----------|---------|-------------|
| `MP_ACCESS_TOKEN` | — | Access Token de **prueba** de la cuenta de desarrollador de Mercado Pago. Sin token (y con `DEBUG=true`) los pagos se simulan en local. |
| `MP_WEBHOOK_SECRET` | — | Secreto para validar la firma `x-signature` de las notificaciones del webhook. Generar con `python -c "import secrets; print(secrets.token_urlsafe(48))"`. |
| `FRONTEND_URL` | `http://localhost:5173` | URL del frontend; Mercado Pago redirige ahí al terminar el pago. |
| `BACKEND_PUBLIC_URL` | — | URL pública **https** del backend para el webhook (en local, con ngrok). Vacía = sin notificaciones de MP. |

### Email (Gmail SMTP)

| Variable | Default | Descripción |
|----------|---------|-------------|
| `SMTP_HOST` | `smtp.gmail.com` | Servidor SMTP. |
| `SMTP_PORT` | `587` | Puerto SMTP (STARTTLS). |
| `SMTP_USER` | — | Cuenta de Gmail que envía los correos. |
| `SMTP_PASSWORD` | — | **App Password** de Google (no la contraseña de la cuenta). Se genera en la cuenta de Google → Seguridad → Verificación en 2 pasos → Contraseñas de aplicaciones. |
| `SMTP_FROM_NAME` | `Boxly Taller Mecánico` | Nombre del remitente. |
| `SMTP_FROM_EMAIL` | — | Dirección del remitente; si está vacía usa `SMTP_USER`. |
| `SMTP_TLS` | `true` | Conexión cifrada. |

Se usan para: invitación al portal del cliente, aviso de activación de cuenta, notificación de cambio de estado de la orden y aviso de cobro.

### Solo para demo / scripts

| Variable | Default | Descripción |
|----------|---------|-------------|
| `CLIENTE_PASSWORD_DNI` | `false` | **SOLO DEMO — insegura.** En `true`, un cliente sin cuenta puede entrar con su email y su DNI/CUIT como contraseña (la cuenta se crea en el primer login). Dejar en `false` fuera de una demo. |
| `BOXLY_ADMIN_EMAIL` | `admin@boxly.com` | Email del admin inicial (`scripts/create_admin.py`). |
| `BOXLY_ADMIN_PASSWORD` | — | Contraseña del admin inicial. Si falta, el script la pide por terminal. |
| `BOXLY_ADMIN_NOMBRE` / `BOXLY_ADMIN_APELLIDO` | `Admin` / `Boxly` | Nombre del admin inicial. |

## Integraciones

### Mercado Pago (sandbox)

1. Crear una aplicación en [Mercado Pago Developers](https://www.mercadopago.com.ar/developers) y copiar el **Access Token de prueba** en `MP_ACCESS_TOKEN`.
2. El cliente paga desde el portal (`/portal/pago`). El backend crea la preferencia con `costo_final` de la orden y Mercado Pago vuelve a `{FRONTEND_URL}/portal/pago/{aprobado|rechazado|pendiente}?pago_id=N`.
3. **Webhook:** Mercado Pago avisa a `{BACKEND_PUBLIC_URL}/api/v1/pagos/webhook`. En local hace falta exponer el backend con ngrok (`ngrok http 8000`) y poner la URL https en `BACKEND_PUBLIC_URL`. El backend consulta el pago a la API de MP (no confía en el cuerpo), valida la firma con `MP_WEBHOOK_SECRET` y actualiza el `Pago`.
4. **Sin token y con `DEBUG=true`** (solo dev): `url_pago` apunta a una pantalla interna y el administrador puede usar `POST /api/v1/pagos/{id}/simular` para aprobar o rechazar el pago a mano. En producción ese endpoint responde `404`.
5. Al volver del checkout, el frontend confirma el resultado con `POST /api/v1/pagos/{id}/confirmar`.

### Email con Gmail

Los correos salen por SMTP de Gmail. Gmail no acepta la contraseña normal: hay que generar una **App Password** (requiere verificación en 2 pasos) y ponerla en `SMTP_PASSWORD`. Si falta configuración, los avisos quedan registrados como `omitido`/`fallido` en la tabla `notificaciones` sin romper la operación.

## API

Base: `http://localhost:8000/api/v1`. Autenticación: `Authorization: Bearer <token>` en todo salvo `POST /auth/login`, `GET|POST /auth/activacion` y `POST /pagos/webhook`.

Contratos y ejemplos JSON: [`docs/Contratos_API_Semana7.md`](docs/Contratos_API_Semana7.md). Swagger interactivo en `http://127.0.0.1:8000/docs` (**solo en dev**). Rate limit activo por defecto (`RATE_LIMIT_ENABLED`); al superarlo responde `429`.

Resumen de routers (roles: **A**dministrador, **R**ecepción, **M**ecánico, **C**liente):

| Módulo | Qué expone | Quién accede |
|--------|-----------|--------------|
| `auth` | `POST /login` (5 req/min), `GET /me`, `GET /activacion` y `POST /activacion` (10 req/min, enlace del correo) | Público / autenticado |
| `users` | CRUD de usuarios y `GET /users/mecanicos` (para asignar) | A (CRUD) · A+R (mecánicos) |
| `clientes` | CRUD de clientes, `?q=` y `POST /clientes/{id}/invitacion` (envía/reenvía el correo de activación del portal) | Lectura: personal (el mecánico solo los de sus órdenes) · Escritura y aviso: A+R |
| `vehiculos` | CRUD y `GET /vehiculos/{id}/ordenes` (historial) | Lectura: personal (el mecánico solo los de sus órdenes) · Escritura: A+R |
| `turnos` | CRUD, `PUT /{id}/estado`, grilla cada 2 h y `mecanico_id` opcional | Lectura: personal (el mecánico solo los de sus órdenes) · Escritura: A+R |
| `ordenes` | CRUD, `GET /estados` (cualquier autenticado), `PATCH` (cambio de estado con comentario), detalles, imágenes, historial, cobro y notificaciones | Lectura y cambio de estado: personal (mecánico solo las suyas) · Crear/eliminar: A+R |
| `repuestos` | CRUD, `GET /stock-bajo` y `POST /{id}/ingresos` (suma stock) | Lectura: personal · Escritura: A+R |
| `catalogo` | `GET /catalogo/marcas` y `GET /catalogo/modelos` (con `?q=`) | Cualquier usuario autenticado |
| `metricas` | `GET /mecanicos`, `GET /finanzas`, `GET /mejor-mecanico` | A |
| `mecanicos` | Horarios del mecánico (CRUD) y `GET /{id}/calendario` | Lectura: personal (el mecánico solo el suyo) · Escritura de horarios: A |
| `pagos` | `POST /webhook` (MP), `POST /ordenes/{id}`, `GET /{id}`, `POST /{id}/confirmar`, `POST /{id}/simular` (solo dev) | Webhook: público · Resto: A+C (cliente solo los suyos) |
| `portal` | `GET /mis-vehiculos`, `GET /mis-ordenes`, `GET /mis-ordenes/{id}` | C |

## Datos de demo

`python -m scripts.seed_demo` carga el catálogo de marcas y modelos, 2 clientes con cuenta, vehículos, repuestos (2 con stock bajo), turnos y órdenes con historial, repuestos, mano de obra, pagos y notificaciones. Las fechas son relativas al día en que se corre.

| Usuario | Rol | Para probar |
|---|---|---|
| `admin@boxly.com` | Administrador | Todo el sistema |
| `recepcion@boxly.com` | Recepción | Clientes, vehículos, turnos y órdenes |
| `mecanico@boxly.com` | Mecánico (Mario) | Solo sus órdenes y vehículos |
| `mecanico2@boxly.com` | Mecánico (Lucía) | Solo sus órdenes y vehículos |
| `cliente@boxly.com` | Cliente (Juan Perez) | Portal: tiene la orden `OT-DEMO-10` lista para pagar |
| `cliente2@boxly.com` | Cliente (Laura Gomez) | Portal: orden con pago rechazado y reintentado, y una cancelada |

Contraseña de todos: `Demo1234`.

Otros scripts: `python -m scripts.create_admin` (admin inicial). El único seed de datos es `python -m scripts.seed_demo`.
Para cambios de modelo: `alembic revision --autogenerate -m "descripcion del cambio"` y luego `alembic upgrade head`.

## Despliegue

El deploy es un **VPS con Docker Compose** (backend + frontend + PostgreSQL + Caddy con HTTPS y backups). Guía paso a paso en [`docs/DEPLOY.md`](docs/DEPLOY.md).

El backend expone `GET /health` (sin autenticación y fuera del schema de la API): devuelve `200` con `{estado, db, version}` si la base responde y `503` con `{estado: "degradado", db: "error"}` si falla. Docker y Caddy lo usan para el healthcheck.

## Cómo vamos a trabajar

Metodología Scrum adaptada, sprints de 2 semanas. Tablero en Trello (Por hacer / En progreso / Hecho).
