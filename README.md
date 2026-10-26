# Boxly

**Sistema de gestión de taller mecánico automotriz**

Aplicación web Full Stack para administrar clientes, vehículos, órdenes de trabajo, repuestos, turnos e historial de reparaciones.

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
- **Órdenes de trabajo:** flujo Ingresado → En diagnóstico → Esperando repuestos → Listo → Entregado.
- **Inventario:** stock de repuestos y alertas de bajo inventario.
- **Agenda y turnos:** calendario y disponibilidad.
- **Roles:** Administrador, Recepción y Mecánico, con login (JWT + bcrypt).

## Stack

| Capa | Tecnología |
|------|------------|
| Frontend | React 18 + Vite + Tailwind CSS |
| Backend | Python / FastAPI / SQLAlchemy / Pydantic |
| Base de datos | PostgreSQL |
| Versionado | Git + GitHub |
| Despliegue | Railway (talvez) |

## Estado actual del repositorio

El proyecto está en desarrollo. Hoy el repo incluye:

```
Boxly/
├── backend/           # API FastAPI (auth JWT, usuarios, clientes, vehículos, turnos, órdenes, repuestos)
├── frontend/          # Interfaz React + Vite (en construcción)
├── docs/DER.md        # Modelo entidad-relación completo
├── tp-productos-api/  # TP de arquitectura de capas (práctica)
└── README.md
```

### Backend

Desde `backend/` (venv activo):

```bash
pip install -r requirements.txt
alembic upgrade head             # crea las tablas (la API ya no las crea sola)
python -m scripts.seed_demo      # datos de demo (se puede correr varias veces, no duplica)
uvicorn app.main:app --reload
```

El seed de demo carga 3 clientes, 4 vehículos, 6 repuestos (2 con stock bajo), 3 turnos y 13 órdenes repartidas en los últimos meses, con historial por etapa, repuestos, mano de obra y pagos (aprobados, uno rechazado y órdenes cobradas en el taller). Las fechas son relativas al día en que se corre.

| Usuario | Rol | Para probar |
|---|---|---|
| `admin@boxly.com` | Administrador | Todo el sistema |
| `recepcion@boxly.com` | Recepción | Clientes, vehículos, turnos y órdenes |
| `mecanico@boxly.com` | Mecánico (Mario) | Solo sus órdenes y vehículos |
| `mecanico2@boxly.com` | Mecánico (Lucía) | Solo sus órdenes y vehículos |
| `cliente@boxly.com` | Cliente (Juan Perez) | Portal: tiene la orden `OT-DEMO-10` lista para pagar |
| `cliente2@boxly.com` | Cliente (Laura Gomez) | Portal: orden con pago rechazado y reintentado, y una cancelada |

Contraseña de todos: `Demo1234`.

Otros scripts: `python -m scripts.create_admin` (admin inicial) y `python -m scripts.seed` (datos aleatorios con Faker).
Para cambios de modelo: `alembic revision --autogenerate -m "descripcion del cambio"` y luego `alembic upgrade head`.

Swagger: http://127.0.0.1:8000/docs

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/v1/auth/login` | Login (JSON: email, password) → JWT |
| GET | `/api/v1/auth/me` | Usuario actual (Bearer token) |
| CRUD | `/api/v1/users` | Gestión de usuarios (solo administrador) |
| CRUD | `/api/v1/repuestos` | Repuestos con control de stock (escritura: administrador y recepción) |
| GET | `/api/v1/repuestos/stock-bajo` | Repuestos con stock menor o igual al mínimo |

`tp-productos-api/` es un trabajo práctico de la materia (CRUD de productos en memoria). No es el sistema del taller: sirve de práctica de FastAPI, Pydantic y capas (router / schemas / repository / models) antes de pasar a PostgreSQL.

Para correr ese TP:

```bash
cd tp-productos-api
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
fastapi dev app/main.py
```

Swagger: http://127.0.0.1:8000/docs

## Cómo vamos a trabajar

Metodología Scrum adaptada, sprints de 2 semanas. Tablero en Trello (Por hacer / En progreso / Hecho).
