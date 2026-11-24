# Boxly multi-taller: contrato de la plataforma

Boxly es un SaaS con varios talleres. Cada taller es **responsable** de los datos de
sus clientes (Ley 25.326) y Boxly es el **encargado del tratamiento**. Regla de diseño:

> El superadmin ve datos de la plataforma (talleres, su personal, uso, salud). No ve
> datos de los clientes de un taller (nombres, DNI, teléfonos, emails, patentes,
> órdenes, pagos, fotos) salvo con un **acceso de soporte** que el taller otorga:
> temporal, solo lectura, con datos personales enmascarados, revocable y registrado.

## Ya hecho (fase 0, no tocar salvo la tarea que lo indique)

- Modelos `Taller`, `AccesoSoporte`, `TallerMixin` en `app/models/taller.py`;
  `taller_id` en `clientes, vehiculos, ordenes, repuestos, turnos, horarios_mecanico,
  pagos, notificaciones` (NOT NULL), `usuarios` y `auditoria` (nullable; el superadmin
  no tiene taller), `configuracion_taller` (una fila por taller). `auditoria.soporte`.
  Únicos por taller: DNI, patente, código de repuesto, código de orden. Migración
  `e9a4b2c6d801`: todo lo existente pasa al taller 1 (`TALLER_PRINCIPAL_ID`).
- **Filtro automático** (`app/db/session.py`): `session.info["taller_id"]`
  - clave ausente → contexto de sistema (scripts, tests, login, webhook): sin filtro;
    las filas nuevas sin `taller_id` van al taller 1.
  - `int` → cada SELECT de modelos con `TallerMixin`, y de `Usuario`, `Auditoria`,
    `ConfiguracionTaller`, `AccesoSoporte`, se filtra por ese taller; las filas nuevas
    lo heredan; guardar una fila de otro taller lanza `TallerAjenoError`.
  - `None` → plataforma: ninguna fila con `TallerMixin`; sí todos los usuarios,
    auditoría, accesos y talleres.
  - `fijar_taller(session, id)` lo fija; `execution_options(sin_filtro_taller=True)`
    lo saltea para una consulta puntual (solo agregados de plataforma o el webhook).
  - Ojo: el filtro aplica a consultas ORM (`select(Modelo)`, `db.get`, relaciones).
    `select(tabla)` de Core o SQL crudo NO se filtran: no usarlos sobre datos de taller.
- `get_current_user` fija el taller del usuario y devuelve 403
  `"El taller está suspendido. Comunicate con Boxly."` si su taller no está activo.
- `require_roles` ya no deja pasar al superadmin; `ROLES_PERSONAL` no lo incluye;
  `es_admin()` es solo el administrador del taller.
- Mecánico sin dinero (decisión del dueño): hace sus tareas y avisa qué repuestos
  usó. Ninguna respuesta le trae precios, montos, presupuesto, cobros ni pagos
  (las claves van en null o vacías) y no carga precios, presupuesto ni propone o
  emite cobros (403). Lo vigilan `tests/test_mecanico_sin_dinero.py` y
  `tests/test_mecanico_sin_dinero_rutas.py`.
- Routers vacíos: `/plataforma` (P1), `/soporte` (P2), `/terminos` (P8);
  `EnmascaradoSoporteMiddleware` vacío en `app/core/enmascarado.py` (P2).
- Frontend: menú del superadmin = Talleres (`/plataforma`) y Sistema
  (`/plataforma/sistema`); el admin del taller tiene "Panel del taller" (`/admin`).
  Páginas vacías `Plataforma`, `PlataformaTaller`, `PlataformaSistema`, `Terminos`;
  `GuardiaTerminos` y `SoporteProvider` vacíos ya montados en `App.jsx`.

## P1. Talleres y personal (superadmin)

| Método | Ruta | Respuesta |
| --- | --- | --- |
| GET | `/api/v1/plataforma/talleres` | `list[TallerResumen]` paginado (`X-Total-Count`), filtros `estado`, `q` (nombre) |
| POST | `/api/v1/plataforma/talleres` | body `{nombre, admin: {nombre, apellido, email}}` → `201 {taller: TallerResumen, admin_email, password_temporal}`. Crea el taller, su `configuracion_taller` (nombre) y su primer administrador con contraseña temporal (12 caracteres, letras y números). Email repetido: 409. |
| GET | `/api/v1/plataforma/talleres/{id}` | `TallerDetalle` = `TallerResumen` + `personal: [{id, nombre, apellido, email, rol, activo, ultimo_ingreso}]` (sin cuentas de clientes) + `accesos_soporte: [AccesoSoporteResponse]` (últimos 20) |
| PUT | `/api/v1/plataforma/talleres/{id}` | `{nombre}` → `TallerResumen` |
| POST | `/api/v1/plataforma/talleres/{id}/suspender` | → `TallerResumen` (estado `suspendido`, `suspendido_en`). El taller 1 también se puede suspender. |
| POST | `/api/v1/plataforma/talleres/{id}/reactivar` | → `TallerResumen` |
| POST | `/api/v1/plataforma/usuarios/{id}/restablecer-password` | `{password_temporal}`; solo personal (rol administrador, recepción o mecánico); con un cliente: 404 |
| POST | `/api/v1/plataforma/usuarios/{id}/cerrar-sesiones` | `{detail}`; mismas reglas |

`TallerResumen`: `id, nombre, estado, creado_en, suspendido_en, personal (int, activos),
clientes (int), ordenes_mes (int, creadas en los últimos 30 días), ultimo_uso
(datetime|null: última fila de auditoría del taller), soporte_vigente_hasta
(datetime|null), terminos_aceptados_en (datetime|null)`. Son conteos: ningún dato personal
de clientes.

Las rutas viejas `/api/v1/admin/usuarios/*` se eliminan.

Reglas en `/api/v1/users` (para el administrador del taller): gestiona todo el personal
de su taller, incluidos otros administradores; no puede crear ni asignar `superadmin`
(403); el último administrador activo del taller está protegido (409
`"Tiene que quedar al menos un administrador activo en el taller"`); nadie se desactiva a
sí mismo (409). Los usuarios nuevos quedan en el taller del administrador (lo hace el
filtro). Script `create_admin --superadmin` crea el superadmin sin taller.

## P2. Acceso de soporte

Lado taller (administrador):

| Método | Ruta | Respuesta |
| --- | --- | --- |
| GET | `/api/v1/soporte/accesos` | `list[AccesoSoporteResponse]` del taller, más nuevo primero |
| POST | `/api/v1/soporte/accesos` | `{horas: 1|4|24|72, motivo?: str ≤300}` → `201 AccesoSoporteResponse`. Si ya hay uno vigente: 409. |
| POST | `/api/v1/soporte/accesos/{id}/revocar` | → `AccesoSoporteResponse` |
| GET | `/api/v1/soporte/actividad` | filas de auditoría del taller con `soporte = true`, paginado |

Lado plataforma: `GET /api/v1/plataforma/soporte` (superadmin) → accesos vigentes de
todos los talleres `[{taller_id, taller_nombre, hasta, motivo}]`.

`AccesoSoporteResponse`: `id, taller_id, otorgado_por (nombre y email | null), motivo,
desde, hasta, revocado_en, vigente (bool)`.

Modo soporte: el superadmin manda el header `X-Taller-Soporte: <taller_id>` en las
rutas del taller. Con un acceso vigente: el taller de la sesión es ese, pasa los
controles de rol como un administrador, **solo GET** (otro método: 403
`"El modo soporte es de solo lectura"`). Sin acceso vigente: 403
`"El taller no te dio acceso de soporte"`. En modo soporte, toda request (también los
GET) queda en la auditoría con `soporte = true` y el `taller_id` del taller. Las
respuestas JSON enmascaran `dni`, `telefono`, `email`, `direccion` y `cuit` en cualquier
nivel (`"****5678"`: últimos 4 caracteres visibles; menos de 5 caracteres: `"****"`).
`GET /auth/me` o equivalente no cambia.

## P3. Servicios por taller

- `SessionLocal()` directos (avisos por email en `clientes/service.py` y
  `ordenes/service.py`, notificaciones) fijan el taller de la orden o del cliente antes
  de crear filas.
- Webhook de Mercado Pago: busca el pago sin filtro y fija `pago.taller_id` antes de
  modificar o crear filas.
- Pago online solo en el taller 1 (hasta tener credenciales de Mercado Pago por taller):
  crear un pago en otro taller → 409 `"Este taller todavía no tiene cobro online"`.
  `GET /api/v1/taller` agrega `pago_online: bool`.
- `GET/PUT /api/v1/taller`: datos del taller de la sesión (crea su fila si falta). PUT
  lo hace el **administrador** del taller (ya no el superadmin). El superadmin recibe
  403 salvo en modo soporte (GET).
- `GET /api/v1/taller/respaldo` (administrador): ZIP con los CSV **solo de su taller**
  (consultas ORM filtradas, nunca `select(tabla)`), sin `password_hash` ni tokens.
- `GET /api/v1/taller/auditoria` y `/taller/auditoria/exportar` (administrador): la
  auditoría de su taller, mismos filtros que antes.
- Plataforma (superadmin): `GET /api/v1/plataforma/sistema` (versión, base, conteos
  **agregados** de toda la plataforma con `sin_filtro_taller`, `talleres` por estado,
  usuarios por rol, uploads, integraciones) y `GET /api/v1/plataforma/auditoria` (+
  `/exportar`), con filtro opcional `taller_id`.
- Se eliminan `/api/v1/admin/sistema`, `/api/v1/admin/exportar` y
  `/api/v1/admin/auditoria*`.
- El middleware de auditoría guarda el `taller_id` del usuario (buscándolo por
  `usuario_id`). Lo hace P2, que es dueño de `app/core/auditoria.py`.

## P4. Seguridad y demo

- `tests/test_aislamiento_talleres.py`: dos talleres con datos; con usuarios de cada rol
  del taller A, cada endpoint del taller con ids del taller B responde 404 (o 403), y
  ningún listado devuelve filas de B; el superadmin sin soporte recibe 403 en todas las
  rutas del taller; un usuario de un taller suspendido recibe 403.
- `seed_demo`: taller 1 como hoy + taller 2 "Taller Norte" con `admin2@boxly.com`,
  `recepcion2@boxly.com`, `mecanico3@boxly.com`, `cliente3@boxly.com` y sus datos.

## P5–P8. Frontend y términos

- P5: `/plataforma` (lista y alta de talleres) y `/plataforma/talleres/:id` (detalle).
- P6: modo soporte (franja, header, solo lectura) y sección "Acceso de soporte" del
  administrador en Configuración.
- P7: panel del taller (`/admin`: datos, auditoría y respaldo del taller),
  `/plataforma/sistema` (salud y auditoría de plataforma), ocultar el pago online cuando
  `pago_online` es false.
- P8: `GET /api/v1/terminos` → `{version, texto, aceptados_en|null}` del taller de la
  sesión; `POST /api/v1/terminos/aceptar` (administrador) → guarda versión, fecha y
  usuario en `talleres`. Texto en `backend/app/api/v1/terminos/texto.md` marcado como
  BORRADOR. `GuardiaTerminos`: el administrador de un taller sin la versión vigente
  aceptada va a `/terminos`; el resto del personal y los clientes no se bloquean.
