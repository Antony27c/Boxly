# Boxly — Frontend (Sprint 1)

Interfaz web de Boxly, sistema de gestión de taller mecánico automotriz.
Proyecto Final — Tecnicatura Superior en Análisis de Sistemas y Desarrollo de
Software, IES N° 6001 "Gral. Manuel Belgrano" (Salta).

Responsable del frontend: **Cardozo Julieta**.

## Tareas del Sprint 1 cubiertas

| ID | Tarea | Dónde está resuelta |
|---|---|---|
| FE-01 | Inicializar proyecto Vite + ruteo base | `vite.config.js`, `src/App.jsx`, `src/routes/ProtectedRoute.jsx` |
| FE-02 | Sistema de estilos y componentes base (Tailwind) | `tailwind.config.js`, `src/index.css`, `src/components/ui/` |
| FE-03 | Maquetar pantalla de Login | `src/pages/Login.jsx` |
| FE-04 | Consumir endpoint de login | `src/lib/api.js`, `src/context/AuthContext.jsx` |
| FE-05 | Manejo de estados de carga y error | `AuthContext` (sesión), `Login` (envío), `ApiError` (mensajes) |
| FE-06 | Validación de formularios (login) | `src/utils/validation.js` |

## Cómo levantarlo

```bash
npm install
cp .env.example .env     # ajustar VITE_API_URL si la API no corre en el 8000
npm run dev              # http://localhost:5173
```

## Contrato con el backend

El login envía un `POST` a `/auth/login` en formato
`application/x-www-form-urlencoded` con los campos `username` y `password`
(formato de `OAuth2PasswordRequestForm` de FastAPI) y espera:

```json
{ "access_token": "<jwt>", "token_type": "bearer" }
```

Opcionalmente consume `GET /auth/me` con el header
`Authorization: Bearer <token>` para traer nombre y rol del usuario. Si ese
endpoint todavía no existe, la app igual funciona: guarda el usuario ingresado
y sigue.

> Si el backend prefiere recibir JSON en vez de formulario, cambiar en
> `src/lib/api.js` la línea de `authApi.login` por
> `api.post('/auth/login', { username: usuario, password })`.

El token se guarda en `localStorage` y se revalida contra la API en cada
recarga; si venció, la sesión se cierra sola y vuelve al login.

## Estructura

```
src/
├── components/ui/     Botón, campo, alerta, loader, logo
├── context/           AuthContext (sesión, login, logout)
├── layouts/           AppLayout (header + navegación)
├── lib/               Cliente HTTP y endpoints de auth
├── pages/             Login, Inicio, placeholders, 404
├── routes/            ProtectedRoute (por sesión y por rol)
└── utils/             Validaciones de formularios
```

## Decisiones de diseño

- Paleta grafito + ámbar de señalización: legible en pantalla de taller y con
  buen contraste en ambientes con poca luz.
- Tipografía Archivo (Google Fonts), una sola familia con pesos diferenciados.
- Radio de borde chico (4px) y franja de señalización como recurso de marca.
- Responsive desde 360px, foco visible en teclado y `prefers-reduced-motion`
  respetado.
