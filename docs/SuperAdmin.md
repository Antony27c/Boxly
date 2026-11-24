# Superadmin: contrato de la API

Rol `superadmin`, por encima de `administrador`. Pasa cualquier control de rol del
personal (`require_roles` lo deja pasar siempre) y `es_admin(usuario)` en
`app/models/usuario.py` lo trata como administrador. Las rutas `/api/v1/admin/*`
son solo para superadmin (`SuperAdminUser` en `app/core/dependencies.py`):
cualquier otro rol recibe `403`, y sin token `401`.

Modelos ya creados (no tocar): `app/models/auditoria.py` y
`app/models/configuracion_taller.py`, con sus migraciones `b7d2f4a8c913` y
`c3e8a6b1d527`. Cadena de migraciones: `f2a9c4e17b83 → a1c5e9d3f701 (rol) →
b7d2f4a8c913 (auditoria) → c3e8a6b1d527 (configuracion_taller)`.

Listados paginados: `limit` (1–100, por defecto 20) y `offset`, total en el header
`X-Total-Count`, como el resto de la API (`app/schemas/paginacion.py`).

## B1. Roles y cuentas (`app/api/v1/admin_cuentas`, `app/api/v1/users`)

Reglas nuevas en `/api/v1/users`:
- Solo un superadmin puede crear, editar o desactivar usuarios con rol
  `administrador` o `superadmin`, o asignar esos roles. Un administrador recibe `403`
  `"Solo el superadmin puede gestionar administradores"`.
- No se puede desactivar ni quitar el rol al último superadmin activo: `409`
  `"Tiene que quedar al menos un superadmin activo"`.
- Nadie puede desactivarse a sí mismo: `409` `"No podés desactivar tu propio usuario"`.

Rutas nuevas (superadmin):

| Método | Ruta | Respuesta |
| --- | --- | --- |
| POST | `/api/v1/admin/usuarios/{id}/restablecer-password` | `200` `{"password_temporal": "Xk4p9qLm2vRt"}`: 12 caracteres con letras y números, se muestra una sola vez. Sube `token_version` (cierra sus sesiones). `404` si no existe. |
| POST | `/api/v1/admin/usuarios/{id}/cerrar-sesiones` | `200` `{"detail": "Se cerraron las sesiones de ana@x.com"}`. Sube `token_version`. |

## B2. Auditoría (`app/core/auditoria.py`, `app/api/v1/admin_auditoria`)

El middleware registra cada `POST/PUT/PATCH/DELETE` bajo `/api/v1` después de
responder: usuario (del JWT, si lo hay), método, ruta, `entidad` (primer segmento
después de `/api/v1/`, por ejemplo `ordenes`), `entidad_id` (primer segmento
numérico de la ruta), código HTTP, IP. En `POST /api/v1/auth/login` guarda en
`usuario_email` el email intentado (nunca la contraseña), así quedan visibles los
intentos fallidos. Un error al registrar nunca rompe la respuesta.

`AuditoriaResponse`: `id, creado_en, usuario_id, usuario_email, rol, metodo, ruta,
entidad, entidad_id, estado_http, ip, detalle`.

| Método | Ruta | Respuesta |
| --- | --- | --- |
| GET | `/api/v1/admin/auditoria` | `list[AuditoriaResponse]`, más nuevo primero. Filtros: `usuario_id`, `metodo`, `entidad`, `desde` y `hasta` (fechas `YYYY-MM-DD`, inclusivas), `solo_errores` (bool: `estado_http >= 400`). Paginado. |
| GET | `/api/v1/admin/auditoria/exportar` | `text/csv` con los mismos filtros, sin paginar (tope 10.000 filas). `Content-Disposition: attachment; filename="auditoria-YYYYMMDD.csv"`. |

## B3. Datos del taller (`app/api/v1/taller`)

`TallerResponse`: `nombre, razon_social, cuit, direccion, telefono, email,
sitio_web, hora_apertura, hora_cierre, mensaje_portal, pie_ticket, dias_garantia,
actualizado_en`. Si la fila `id=1` no existe se crea con los valores por defecto.

| Método | Ruta | Quién | Respuesta |
| --- | --- | --- | --- |
| GET | `/api/v1/taller` | cualquier usuario con sesión (también cliente) | `TallerResponse` |
| PUT | `/api/v1/taller` | superadmin | actualización parcial (`TallerUpdate`, todos opcionales) → `TallerResponse`. Validaciones `422`: `hora_*` en `HH:MM` con apertura < cierre; `cuit` con 11 dígitos (acepta guiones); `email` válido; `dias_garantia` entre 0 y 3650; `nombre` de 2 a 120 caracteres. |

## B4. Sistema y respaldo (`app/api/v1/sistema`)

| Método | Ruta | Respuesta |
| --- | --- | --- |
| GET | `/api/v1/admin/sistema` | ver abajo |
| GET | `/api/v1/admin/exportar` | `application/zip` con un CSV por tabla (`usuarios, clientes, vehiculos, ordenes, detalles_orden, historial_estados, repuestos, turnos, pagos, horarios_mecanico, configuracion_taller`; usar los `__tablename__` reales). Nunca incluye `password_hash`, `token_version` ni tokens de activación. `Content-Disposition: attachment; filename="boxly-respaldo-YYYYMMDD-HHMM.zip"`. |

```json
{
  "version": "1.0.0",
  "entorno": "dev",
  "db": {"motor": "sqlite", "ok": true, "revision": "c3e8a6b1d527"},
  "conteos": {"usuarios": 5, "clientes": 40, "vehiculos": 52, "ordenes": 130,
              "ordenes_abiertas": 12, "repuestos": 80, "turnos": 30, "pagos": 70},
  "usuarios_por_rol": {"superadmin": 1, "administrador": 1, "recepcion": 1, "mecanico": 2, "cliente": 30},
  "uploads": {"archivos": 120, "bytes": 3456789},
  "integraciones": {"email": true, "mercadopago": false, "rate_limit": true}
}
```

`revision` es `null` si no se puede leer `alembic_version`. Las integraciones dicen
solo si están configuradas, nunca el valor de un secreto.

## Frontend

- `ROLES_SUPERADMIN` y el ítem "Panel de control" (`/admin`) ya están en
  `src/routes/navegacion.js`; la ruta `/admin` muestra `src/pages/Admin.jsx`, con
  una pestaña por componente de `src/components/superadmin/`.
- F1 `ResumenSistema.jsx` (B4), F2 `Auditoria.jsx` (B2), F3 `ConfigTaller.jsx` (B3),
  F4 pantalla Usuarios (B1).
