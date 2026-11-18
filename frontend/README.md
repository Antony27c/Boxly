# Boxly — Frontend

Interfaz web del **Sistema de Gestión de Taller Mecánico**. React 18 + Vite + Tailwind CSS, consumiendo la API FastAPI del backend (`../backend`).

## Requisitos

- Node.js 18+ (recomendado LTS)
- El backend corriendo (`uvicorn app.main:app` en `backend/`, API en `http://localhost:8000`)

## Setup

```bash
npm install
copy .env.example .env          # Linux/macOS: cp .env.example .env
npm run dev
```

Variables de entorno (`.env`):

| Variable | Default | Descripción |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:8000` | URL base de la API de Boxly |

La app queda en `http://localhost:5173` y hace login contra `POST {VITE_API_URL}/api/v1/auth/login`. El token JWT se guarda en `localStorage` (ver `src/context/AuthContext.jsx`).

## Scripts

| Comando | Qué hace |
|---------|----------|
| `npm run dev` | Servidor de desarrollo con HMR |
| `npm run build` | Build de producción en `dist/` |
| `npm run preview` | Sirve el build de producción localmente |

## Estructura de carpetas

```
src/
├── main.jsx               # Entry point
├── App.jsx                # Rutas y guards por rol
├── index.css              # Tailwind + estilos base
├── context/
│   └── AuthContext.jsx    # Sesión (login/logout, usuario, token)
├── routes/
│   ├── navegacion.js      # Menú por rol y destinos post-login
│   ├── ProtectedRoute.jsx # Guard de rutas por rol
│   └── Raiz.jsx           # Redirección según sesión/rol
├── layouts/
│   └── AppLayout.jsx      # Menú superior + contenedor
├── pages/                 # Una pantalla por ruta
├── components/            # UI reutilizable
│   ├── ui/                # Botones, modales, badges, campos...
│   ├── clientes/ ordenes/ vehiculos/ turnos/ inventario/
│   ├── mecanicos/ metricas/ admin/
├── services/              # Un archivo por recurso de la API
│   └── config.js          # (config de servicios)
├── lib/
│   └── api.js             # Cliente fetch: VITE_API_URL, Bearer, ApiError
├── hooks/                 # useRecurso (carga de datos)
└── utils/                 # formato, fechas, validaciones
```

## Roles y pantallas

El backend devuelve `rol` en el login y el frontend decide qué ve cada uno (`routes/navegacion.js`):

| Rol | Pantallas |
|-----|-----------|
| **Cliente** | `/portal` (Mis órdenes: vehículos y seguimiento con línea de tiempo), `/portal/orden/:id`, `/portal/pago/:resultado` (vuelve de Mercado Pago), `/activar` (activar cuenta desde el correo) |
| **Recepción** | Lo del taller + `/inicio`, `/turnos`, `/clientes` (alta, invitación al portal) |
| **Mecánico** | `/ordenes` (solo las suyas), `/vehiculos`, `/inventario`, `/horarios` — el backend ya filtra por sus órdenes |
| **Administrador** | Todo lo anterior + `/usuarios` y `/dashboard` (métricas y finanzas) |

Destino post-login: cliente → `/portal`; administrador y mecánico → `/ordenes`; recepción → `/inicio`.

## Conexión con la API

- `src/lib/api.js` arma el `fetch` con `VITE_API_URL`, el `Authorization: Bearer` y traduce los errores a `ApiError`.
- `src/services/*.js` agrupa las llamadas por recurso (`ordenes.js`, `clientes.js`, `pagos` vía `portal.js`, etc.).
- Los contratos de cada endpoint (payloads, respuestas, errores) están en `../docs/Contratos_API_Semana7.md`; la documentación interactiva de la API está en `http://localhost:8000/docs` (solo con `ENVIRONMENT=dev` en el backend).
- Las imágenes de las órdenes se sirven desde `{VITE_API_URL}/uploads/...` (ver `urlArchivo()` en `lib/api.js`).

## Lint y formato

El proyecto usa ESLint (`eslint.config.js`) y Tailwind (`tailwind.config.js`). No hay script de lint en `package.json` todavía.
