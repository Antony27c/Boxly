# Suscripciones, planes y precios del mecánico: contrato

Complementa `docs/Plataforma.md`. Fechas en `YYYY-MM-DD`; montos en pesos con 2 decimales.

## Planes

Tabla `planes` (la edita el superadmin): `codigo` (PK, `basico|pro|taller_plus`),
`nombre`, `precio_mensual`, `max_personal` (int o `null` = sin límite), `activo`.
Valores iniciales (provisorios): Básico $15.000 hasta 3; Pro $30.000 hasta 10;
Taller+ $50.000 sin límite. "Personal" = usuarios activos con rol administrador,
recepción o mecánico (no cuentan clientes).

`PlanResponse`: `codigo, nombre, precio_mensual, max_personal, activo`.

## Suscripción del taller

Campos nuevos en `talleres`: `plan_codigo` (FK `planes`, default `basico`),
`suscripcion_vence_en` (date: pagado hasta ese día inclusive), `cobro_automatico`
(bool), `mp_preapproval_id` (str|null). Alta de taller: `basico` y 30 días de prueba.
La migración deja los talleres existentes en `basico` con vencimiento en 30 días.

Estado (lo calcula `app/core/suscripcion.py::estado_suscripcion(vence_en, hoy)`):

| Días desde el vencimiento | Estado | Efecto |
| --- | --- | --- |
| ≤ 0 | `al_dia` | normal |
| 1 a 7 | `gracia` | normal + aviso |
| 8 a 30 | `solo_lectura` | el personal y los clientes solo pueden leer |
| ≥ 31 | `suspendida` | solo el administrador entra, y solo a `/suscripcion*`, `/auth*`, `/terminos*` |

Además sigue existiendo la suspensión manual del superadmin (`talleres.estado`).

Bloqueos (en `app/core/dependencies.py`, fase 0):
- `solo_lectura`: método distinto de GET/HEAD/OPTIONS → 403
  `"El taller está en solo lectura por falta de pago de la suscripción"`, salvo
  `/api/v1/suscripcion*`, `/api/v1/auth*` y `/api/v1/terminos*`.
- `suspendida`: todo → 403 `"La suscripción del taller está vencida"`, salvo el
  administrador en `/api/v1/suscripcion*`, `/api/v1/auth*` y `/api/v1/terminos*`.
  El login funciona (para que el admin pueda pagar).

`SuscripcionResponse`: `plan: PlanResponse, vence_en, estado, dias_para_vencer (int,
negativo si venció), cobro_automatico, personal_activo (int), max_personal (int|null),
proximo_monto`.

Tabla `pagos_suscripcion`: `id, taller_id, monto, periodo_desde, periodo_hasta,
medio (manual|mercadopago), estado (aprobado|pendiente|rechazado), referencia
(str|null: comprobante, n.º de transferencia), mp_payment_id (str|null),
registrado_por_id (null si fue automático), creado_en`.
`PagoSuscripcionResponse`: esos campos menos `taller_id` y `mp_payment_id`, más
`registrado_por` (nombre|null).

Un pago aprobado extiende `suscripcion_vence_en`: `periodo_desde = max(vence_en + 1,
hoy)`, `periodo_hasta = periodo_desde + 1 mes - 1 día` (o los meses que indique).

## S1. Planes, suscripción y pagos manuales (backend)

Taller (administrador; GET también recepción y mecánico para ver el aviso):

| Método | Ruta | Respuesta |
| --- | --- | --- |
| GET | `/api/v1/suscripcion` | `SuscripcionResponse` |
| GET | `/api/v1/suscripcion/planes` | `list[PlanResponse]` activos |
| PUT | `/api/v1/suscripcion/plan` | `{plan}` → `SuscripcionResponse`. Rige ya; el precio nuevo, desde el próximo período. Bajar a un plan con menos lugar que el personal activo: 409 `"Tu personal activo supera el límite de ese plan"`. |
| GET | `/api/v1/suscripcion/pagos` | `list[PagoSuscripcionResponse]` del taller |

Plataforma (superadmin):

| Método | Ruta | Respuesta |
| --- | --- | --- |
| GET | `/api/v1/plataforma/planes` | todos los planes |
| PUT | `/api/v1/plataforma/planes/{codigo}` | `{nombre?, precio_mensual?, max_personal?, activo?}` → `PlanResponse` |
| GET | `/api/v1/plataforma/talleres/{id}/suscripcion` | `SuscripcionResponse` + `pagos` |
| PUT | `/api/v1/plataforma/talleres/{id}/plan` | `{plan}`; mismas reglas que el taller |
| POST | `/api/v1/plataforma/talleres/{id}/pagos` | `{monto, meses (1-12, default 1), referencia?, fecha?}` → `201 PagoSuscripcionResponse` (manual, aprobado) y extiende el vencimiento |
| POST | `/api/v1/plataforma/talleres/{id}/vencimiento` | `{vence_en}` → ajuste manual (cortesía o corrección), queda en auditoría |

`TallerResumen` (P1) suma `plan_codigo`, `suscripcion_estado`, `suscripcion_vence_en`.

Límite de personal en `/api/v1/users`: crear o reactivar personal por encima de
`max_personal` → 409 `"Tu plan permite hasta N usuarios del personal. Pasá a un plan
mayor para sumar más."`.

## S2. Cobro automático con Mercado Pago (backend)

Cuenta de Mercado Pago **de Boxly** (distinta de la de los talleres): variables
`BOXLY_MP_ACCESS_TOKEN`, `BOXLY_MP_WEBHOOK_SECRET`. Sin token: el cobro automático
responde 503 `"El cobro automático todavía no está configurado"`, salvo el simulador
en dev+debug.

| Método | Ruta | Respuesta |
| --- | --- | --- |
| POST | `/api/v1/suscripcion/cobro-automatico` | administrador → crea la suscripción (preapproval) por `precio_mensual` del plan y devuelve `{init_point}` para ir a Mercado Pago |
| DELETE | `/api/v1/suscripcion/cobro-automatico` | administrador → cancela la preapproval y pone `cobro_automatico=false` |
| POST | `/api/v1/suscripcion/webhook` | sin auth, firma verificada como el webhook de pagos; `preapproval` → actualiza `cobro_automatico`; `authorized_payment` aprobado → `pago_suscripcion` (medio mercadopago) y extiende el vencimiento; idempotente por `mp_payment_id` |
| POST | `/api/v1/suscripcion/simular-cobro` | solo dev+debug: simula un cobro aprobado o rechazado |

Cambio de plan con cobro automático: actualizar el monto de la preapproval.

## S3. El mecánico no pone precios (backend)

- `detalles_orden.precio_unitario` pasa a nullable (migración de fase 0). `null` = "a
  cotizar".
- `POST /ordenes/{id}/detalles` como mecánico: si manda `precio_unitario` → 403
  `"El mecánico no carga precios"`; línea con repuesto → toma el precio del inventario;
  mano de obra → `precio_unitario = null`.
- Nuevo `PATCH /ordenes/{id}/detalles/{detalle_id}` `{precio_unitario}` (administrador
  o recepción; mecánico 403) para cotizar o corregir.
- Totales y subtotales ignoran las líneas a cotizar; `OrdenResponse` y
  `DetalleOrdenResponse` exponen `a_cotizar: bool` / `lineas_a_cotizar: int`.
- Emitir cobro: mecánico 403; con líneas a cotizar 409 `"Hay trabajos sin cotizar"`.
- El portal del cliente no muestra líneas a cotizar como $0: las muestra "a cotizar".

## Frontend

- S5 superadmin: suscripción y pagos en `/plataforma/talleres/:id`, página
  `/plataforma/planes` (editar planes), plan y estado en las tarjetas de talleres.
- S6 administrador: página `/suscripcion` (estado, plan, comparación y cambio de plan,
  pagos, activar o cancelar el cobro automático) y aviso global según el estado
  (gracia: aviso; solo lectura: aviso + acciones deshabilitadas; suspendida: solo
  `/suscripcion`).
- S7 órdenes: el mecánico no ve campos de precio; líneas "A cotizar"; recepción y el
  admin cotizan en línea; cobro deshabilitado con líneas a cotizar.
- S8 usuarios: contador "3 de 3 en tu plan", alta deshabilitada al llegar al límite con
  link a `/suscripcion`, mensaje del 409.
