# Taller Mecanico API - Capa de Datos (SQLAlchemy + Alembic + Seed)

Modelo de datos completo para un sistema de taller mecánico: 8 entidades
relacionadas, migraciones con Alembic, y script de carga de datos de prueba.

**Alcance de esta entrega:** solo la capa de datos (modelos SQLAlchemy +
migraciones + seed). Los endpoints REST no están implementados todavía.

## Estructura

```
taller-mecanico-api/
├── app/
│   ├── main.py                # App FastAPI minima (sin endpoints aun)
│   ├── database.py            # Conexión a PostgreSQL (SQLAlchemy)
│   └── models/                # Las 8 entidades del DER
│       ├── usuario.py
│       ├── cliente.py
│       ├── vehiculo.py
│       ├── orden_trabajo.py
│       ├── detalle_orden.py
│       ├── repuesto.py
│       ├── turno.py
│       └── historial_estado.py
├── alembic/                    # Migraciones de base de datos
├── seed.py                     # Script de carga de datos de prueba
├── .env.example                 # Plantilla de variables de entorno
└── requirements.txt
```

## Diagrama de entidades y relaciones

```
USUARIO ||--o{ ORDEN_TRABAJO   (crea, via creado_por_id)
USUARIO ||--o{ ORDEN_TRABAJO   (asigna, via mecanico_id)
USUARIO ||--o{ TURNO           (registra, via registrado_por_id)
USUARIO ||--o{ HISTORIAL_ESTADO (via usuario_id)

CLIENTE ||--o{ VEHICULO
CLIENTE ||--o{ ORDEN_TRABAJO
CLIENTE ||--o{ TURNO

VEHICULO ||--o{ ORDEN_TRABAJO
VEHICULO ||--o{ TURNO

ORDEN_TRABAJO ||--o{ DETALLE_ORDEN
ORDEN_TRABAJO ||--o{ HISTORIAL_ESTADO

REPUESTO ||--o{ DETALLE_ORDEN
```

**Detalle importante:** `ORDEN_TRABAJO` tiene DOS columnas que apuntan a
`USUARIO` (`creado_por_id` y `mecanico_id`). En `app/models/orden_trabajo.py`
y `app/models/usuario.py`, cada `relationship()` usa `foreign_keys=` explícito
para que SQLAlchemy sepa distinguir cuál es cuál (si no se indica, tira error
de ambigüedad al arrancar).

## 1. Instalación

```bash
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
```

## 2. Configurar la conexión a PostgreSQL

```bash
copy .env.example .env
```

Completá `.env` con tus datos reales:

```
DB_USER=postgres
DB_PASSWORD=tu_password
DB_HOST=localhost
DB_PORT=5433
DB_NAME=taller_mecanico
```

**Importante:** creá antes la base de datos vacía en pgAdmin (clic derecho en
Databases → Create → Database..., nombre: `taller_mecanico`). Alembic crea
las TABLAS, pero no la base de datos en sí.

## 3. Generar y aplicar las migraciones

```bash
alembic revision --autogenerate -m "Crear las 8 tablas del taller mecanico"
alembic upgrade head
```

Verificado en este entorno: las 8 tablas se generan correctamente y todas
las relaciones (incluida la doble FK de OrdenTrabajo hacia Usuario) resuelven
sin errores.

## 4. Cargar datos de prueba

```bash
python seed.py
```

Esto carga: 4 usuarios, 10 clientes, 15 vehículos, 10 repuestos, 12 órdenes
de trabajo (cada una con 1-3 repuestos usados y su historial de estados), y
8 turnos agendados. **Probado end-to-end en este entorno de desarrollo**:
corrió sin errores y generó datos coherentes (29 detalles de orden, 22
registros de historial).

## Próximo paso (no incluido en esta entrega)

Construir los routers REST (GET/POST/PUT/DELETE) para cada entidad, siguiendo
el mismo patrón de arquitectura en capas (schemas → repositories → routers)
que ya se usó en los proyectos anteriores de la materia.
