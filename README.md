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
├── backend/           # API del proyecto final (en construcción)
├── frontend/          # Interfaz React + Vite (en construcción)
├── tp-productos-api/  # Trabajo práctico de arquitectura de capas (FastAPI)
└── README.md
```

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
