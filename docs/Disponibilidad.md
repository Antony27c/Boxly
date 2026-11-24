# Disponibilidad real de las funciones de los planes

Auditoría del estado real de cada función de la oferta (`docs/Oferta.md`),
verificada en el código del backend (`backend/app`) y del frontend
(`frontend/src` del worktree Boxly-chiquito), no en los textos comerciales.
Es el insumo para corregir la landing (C4) y la ayuda (C5).

**Estados:**

- **existe**: implementada de punta a punta, backend + interfaz usable.
- **parcial**: existe una parte; se detalla qué falta.
- **no existe**: solo hay texto comercial, código de plan o maqueta.

**Regla por planes (a la fecha de esta auditoría).** La infraestructura ya
existe: `planes.funciones`, `adicionales_taller`, `talleres.tipo_acceso`
(commit `7943d89`, C0) y `taller_tiene()` en `backend/app/core/funciones.py`.
`SuscripcionResponse` expone `funciones_efectivas` (C2, en curso). Pero
**ninguna ruta de negocio verifica la función del plan**: hoy los tres planes
tienen en la práctica todo lo implementado, porque todo entra en `gestion` o
`whatsapp_manual`, códigos que comparten Esencial, Pro y Profesional. Las
funciones que diferencian planes (`whatsapp_automatico`, `arca`,
`recordatorios_service`, `marca_propia`) todavía no están construidas. El
único límite por plan que se aplica de verdad es `max_personal`
(409 al crear/reactivar personal por encima del cupo).

## Tabla resumen

| # | Función | Estado | Evidencia principal | Tests |
| --- | --- | --- | --- | --- |
| 1 | Clientes y vehículos | existe | `api/v1/clientes`, `api/v1/vehiculos`, portal con cuenta propia | `test_clientes_permisos`, `test_activacion`, `test_portal_permisos`, `test_aislamiento_talleres` |
| 2 | Turnos | existe | `api/v1/turnos` con grilla fija y anti-solape | `test_turnos*`, `test_horarios_catalogo`, `test_aislamiento_talleres` |
| 3 | Órdenes de trabajo | existe | `api/v1/ordenes` con estados, detalles, "a cotizar" y mecánico sin precios | `test_ordenes_*`, `test_precios_mecanico`, `test_stock_ordenes`, `test_flujo_completo` |
| 4 | Fotos de las órdenes | existe | `POST/GET/DELETE /ordenes/{id}/imagenes`, Pillow sin EXIF/GPS | `test_imagenes` |
| 5 | Historial del vehículo | parcial | `GET /vehiculos/{id}/ordenes`: solo órdenes, no services ni turnos | sin test dedicado (matriz + aislamiento) |
| 6 | Inventario | existe | `api/v1/repuestos` con stock, ingresos y descuento atómico | `test_stock_ordenes`, `test_constraints`, `test_paginacion` |
| 7 | Alerta de stock mínimo | parcial | `stock_minimo` + `GET /repuestos/stock-bajo` + panel visual en Hoy; sin avisos automáticos | matriz + aislamiento (sin test del umbral) |
| 8 | Registro de cobros (efectivo/local) | parcial | cobro interno emitir/aprobar existe; no hay medio de pago ni constancia de pago presencial | `test_precios_mecanico`, `test_notificaciones`, `test_flujo_completo` |
| 9 | Métricas básicas | existe | `api/v1/metricas/{finanzas,mecanicos,mejor-mecanico}` + dashboard | `test_metricas_sql`, `test_precios_mecanico` |
| 10 | Portal del cliente | parcial | solo lectura (`mis-vehiculos`, `mis-ordenes`) + pago online del taller 1 | `test_portal_permisos`, `test_flujo_completo`, `test_activacion` |
| 11 | Avisos por email | existe | `core/email.py` (SMTP), 4 eventos reales con comprobante | `test_email`, `test_notificaciones`, `test_activacion` |
| 12 | WhatsApp manual | no existe | solo código de plan `whatsapp_manual`; sin `wa.me` ni compositor | solo `test_funciones_plan` (flag) |
| 13 | WhatsApp automático | no existe | solo código de plan en Pro/Profesional; sin integración | solo `test_funciones_plan` (flag) |
| 14 | Facturación electrónica ARCA | no existe | solo flag + CRUD de adicional `arca` para superadmin | `test_funciones_plan`, `test_acceso_adicionales` (adicional) |
| 15 | Recordatorios de service | no existe | solo flag en Profesional; sin km ni scheduler | solo `test_funciones_plan` (flag) |
| 16 | Personalización de marca | no existe | `ConfiguracionTaller` tiene textos, no logo ni colores | `test_taller` (config) |
| 17 | Pago online de clientes | parcial | MP completo pero hardcodeado a `TALLER_PRINCIPAL_ID` | `test_pagos_*`, `test_servicios_por_taller` |
| 18 | Débito automático del abono | existe | preapproval MP de la cuenta de Boxly + webhook idempotente | `test_suscripcion_mp`, `test_acceso_adicionales`, `test_suscripciones` |
| 19 | Acceso de soporte | existe | `AccesoSoporte` + modo soporte solo-lectura con enmascarado | `test_soporte`, `test_auditoria`, `test_aislamiento_talleres` |
| 20 | Respaldo | parcial | `GET /taller/respaldo` ZIP con 11 CSV; sin respaldo de plataforma ni programado | `test_sistema`, `test_aislamiento_talleres` |
| 21 | Auditoría | existe | middleware ASGI + `/taller/auditoria` y `/plataforma/auditoria` | `test_auditoria`, `test_soporte` |

## 1. Clientes y vehículos — existe

- **Backend:** `app/api/v1/clientes/router.py` (CRUD + `POST /{id}/invitacion`),
  `app/api/v1/vehiculos/router.py` (CRUD + `GET /{id}/ordenes`),
  `app/api/v1/auth/router.py` (`/activacion` para el alta de la cuenta del
  cliente), `app/api/v1/users/service.py` (alta de usuario con `rol=cliente`
  y `cliente_id`). DNI único por taller (`uq_clientes_taller_dni`), patente
  única por taller. El portal identifica al cliente por `usuarios.cliente_id`.
- **Frontend:** `pages/Clientes.jsx` con asistente `AltaClienteGuiada.jsx`
  (tres pasos, aviso de duplicados por DNI/teléfono del lado cliente),
  `pages/Vehiculos.jsx`, `pages/VehiculoDetalle.jsx`, invitación al portal
  desde la ficha del cliente.
- **Tests:** `test_clientes_permisos.py`, `test_activacion.py` (13),
  `test_password_dni.py`, `test_portal_permisos.py`, `test_paginacion.py`,
  `test_aislamiento_talleres.py`, `test_matriz_roles.py`.
- **Landing vs realidad:** "asistente de tres pasos" y "si el DNI o el
  teléfono ya existen, Boxly te avisa" — real (el teléfono duplicado lo
  detecta el frontend; el backend garantiza unicidad de DNI y patente por
  taller). Matiz: el cliente no puede registrar sus propios vehículos ni
  pedir turnos desde el portal (es solo lectura); la landing no lo promete.

## 2. Turnos — existe

- **Backend:** `app/api/v1/turnos/router.py` (CRUD + `PUT /{id}/estado`),
  `app/api/v1/turnos/service.py`: grilla fija `HORAS_TURNO` (8, 10, 12, 14,
  16), anti-solape por mecánico o por slot del taller, índice único parcial
  `uq_turnos_mecanico_fecha_hora`, estados con transiciones válidas,
  normalización horaria a `America/Argentina/Buenos_Aires`. Solo el
  mostrador agenda (admin/recepción).
- **Matiz:** `HorarioMecanico` (franjas del mecánico) existe como catálogo
  (`/mecanicos/{id}/horarios`, `/mecanicos/{id}/calendario`) pero **no
  valida disponibilidad** al agendar: solo grilla + slot ocupado.
- **Frontend:** `pages/Turnos.jsx` agenda semanal lunes a sábado con "Recibir
  auto" que abre la orden.
- **Tests:** `test_turnos.py`, `test_turnos_permisos.py`,
  `test_turnos_integridad.py` (14), `test_horarios_catalogo.py`,
  `test_flujo_completo.py`, `test_aislamiento_talleres.py`.
- **Landing vs realidad:** "Agenda de lunes a sábado con un auto por
  horario", "Turnos sin superposiciones" — real. El cliente no pide turnos
  desde el portal; la landing no lo promete (dice "Recepción agenda").

## 3. Órdenes de trabajo — existe

- **Backend:** `app/api/v1/ordenes/router.py` + `service.py`: estados
  `pendiente → ingresado → en_diagnostico → esperando_repuestos → listo →
  entregado` (+ `cancelado`), comentario obligatorio al cambiar, código
  `OT-N`, `DETALLE` con mano de obra o repuesto, `precio_unitario` nullable
  = "a cotizar" (S3: el mecánico no puede mandar precio, `PATCH
  /ordenes/{id}/detalles/{detalle_id}` cotiza), `costo_final` solo en
  listo/entregado, cobro bloqueado con líneas a cotizar, historial de
  estados.
- **Frontend:** `pages/Ordenes.jsx` (tablero por etapas), `OrdenDetalle.jsx`
  (fotos, historial, líneas, cobro), `IngresoRapido.jsx` (buscar por
  patente).
- **Tests:** `test_ordenes_estados.py`, `test_ordenes_integridad.py`,
  `test_ordenes_cerradas.py`, `test_precios_mecanico.py` (13),
  `test_stock_ordenes.py`, `test_flujo_completo.py`,
  `test_aislamiento_talleres.py`.
- **Landing vs realidad:** coincide con lo prometido (etapas, comentarios,
  mecánico sin precios, "a cotizar").

## 4. Fotos de las órdenes — existe

- **Backend:** `GET/POST /ordenes/{id}/imagenes`,
  `DELETE /ordenes/{id}/imagenes/{imagen_id}` (admin o quien la subió).
  Multipart `archivo` + `etapa` opcional (default = estado actual).
  `app/core/imagenes.py` (Pillow): verifica firma real JPG/PNG/WEBP, máx
  5 MB (413), re-encodea sin EXIF/GPS, lado máx 4000 px. Se guardan en
  `backend/uploads` y se sirven en `/uploads`. El portal las muestra.
- **Frontend:** pestaña Fotos de `OrdenDetalle.jsx` y subida al cambiar de
  etapa.
- **Tests:** `test_imagenes.py` (5: EXIF/GPS eliminados, archivo falso 400,
  gigante reducida, >5 MB 413, PNG transparente).
- **Landing vs realidad:** "Sube fotos desde el celular al cambiar de etapa
  o desde la pestaña Fotos" — real.

## 5. Historial del vehículo — parcial

- **Existe:** `GET /vehiculos/{id}/ordenes` devuelve las órdenes del
  vehículo por `fecha_ingreso` desc. `pages/VehiculoDetalle.jsx` las muestra
  como "Libreta de service" y suma el próximo turno consultando `/turnos`
  aparte.
- **Falta:** no es un historial consolidado (turnos + services + km); no hay
  registro de services por kilometraje ni fecha próxima; solo hay órdenes.
- **Tests:** cubierto por `test_aislamiento_talleres.py` y
  `test_matriz_roles.py`; sin test dedicado del endpoint.
- **Landing vs realidad:** "queda en el historial del vehículo"
  (ComoFunciona, paso Entrega) — se cumple a medias: quedan las órdenes;
  no existe una "historia de service" propiamente dicha.

## 6. Inventario — existe

- **Backend:** `app/api/v1/repuestos/router.py` (CRUD + `GET /stock-bajo` +
  `POST /{id}/ingresos`), modelo `Repuesto` con `codigo` único por taller,
  `stock`, `stock_minimo`, `precio`, `activo` (soft delete). Al agregar un
  detalle con repuesto, `ordenes/service.py` descuenta stock con UPDATE
  atómico (`stock >= cantidad`, 409 "Stock insuficiente") y lo devuelve al
  quitar la línea, cancelar o eliminar la orden.
- **Matiz:** `POST /repuestos/{id}/ingresos` recibe `nota` pero **no la
  persiste**: no hay tabla de movimientos de stock.
- **Frontend:** `pages/Inventario.jsx` (CRUD, stock mínimo, ingreso de
  stock).
- **Tests:** `test_stock_ordenes.py` (7), `test_paginacion.py`,
  `test_constraints.py`, `test_aislamiento_talleres.py`.
- **Landing vs realidad:** "Inventario de repuestos con su precio y su
  stock" — real.

## 7. Alerta de stock mínimo — parcial

- **Existe:** campo `stock_minimo`, flag `stock_bajo` calculado en cada
  `RepuestoResponse`, `GET /api/v1/repuestos/stock-bajo` (activos con
  `stock <= stock_minimo`), y panel visual "Stock bajo" en `pages/Hoy.jsx` /
  `components/dashboard/AlertasDash.jsx`.
- **Falta:** ninguna notificación automática (ni email ni push ni tarea
  programada — la app no tiene scheduler); la "alerta" es un listado/panel
  on-demand. Tampoco hay test funcional del umbral `stock <= stock_minimo`.
- **Tests:** `test_matriz_roles.py` y `test_aislamiento_talleres.py` cubren
  la ruta y el aislamiento; no hay test del filtrado por mínimo.
- **Landing vs realidad:** "aviso de stock bajo en la pantalla de hoy" —
  literalmente cierto como panel visual; si se espera una alerta activa
  (mail/WhatsApp), no existe.

## 8. Registro de cobros (efectivo/local) — parcial

- **Existe:** flujo interno de cobro de la orden: `POST
  /ordenes/{id}/cobro` y `POST /ordenes/{id}/cobro/aprobar`
  (admin/recepción fija `costo_final`, `cobro_estado="aprobado"`,
  `cobro_aprobado_por/en`, email al cliente). Requisitos: orden
  listo/entregado, sin líneas a cotizar, monto > 0, no pagada. También
  `PATCH /ordenes/{id}` con `costo_final` aprueba el cobro.
- **Falta:** no hay medio de pago (no existe campo método/efectivo en
  ningún modelo); un cobro aprobado **no marca `orden.pagada`** (esa
  propiedad solo mira `pagos` aprobados de Mercado Pago); y los campos
  `monto_propuesto`/`cobro_propuesto_por_id` del modelo no los escribe
  nadie (aprobar sin monto propuesto falla con "No hay un cobro propuesto").
  Es decir: se puede aprobar el cargo, pero **no registrar que el cliente
  pagó en efectivo o en el local**.
- **Tests:** `test_precios_mecanico.py`, `test_notificaciones.py`,
  `test_flujo_completo.py`.
- **Landing vs realidad:** "emitís el cobro" y "el cliente paga en el
  taller" (ComoFunciona) — ambiguo: la aprobación del cobro existe, pero no
  queda registro de un pago presencial ni la orden se marca como pagada.

## 9. Métricas básicas — existe

- **Backend:** `app/api/v1/metricas/router.py` (solo admin/recepción):
  `GET /finanzas` (ingresos, cobrado online, egresos de repuestos, balance,
  mensual/diario), `GET /mecanicos` (órdenes cerradas/en curso, tiempo
  promedio, facturado por mecánico), `GET /mejor-mecanico` (trimestre).
  Agregaciones SQL con `GROUP BY`, filtradas por taller.
- **Frontend:** `pages/Dashboard.jsx`, `pages/Hoy.jsx` y componentes de
  `components/dashboard/` (Facturación = ingresos, Equipo, gráficos,
  comparación de períodos).
- **Tests:** `test_metricas_sql.py` (8 con valores exactos),
  `test_precios_mecanico.py`, `test_matriz_roles.py`,
  `test_aislamiento_talleres.py`.
- **Landing vs realidad:** "órdenes cerradas, facturado, tiempo promedio de
  trabajo y órdenes por mecánico, comparando períodos" — real.

## 10. Portal del cliente — parcial

- **Existe (solo lectura + pago):** `GET /api/v1/mis-vehiculos`,
  `GET /api/v1/mis-ordenes` (`?vehiculo_id=`), `GET
  /api/v1/mis-ordenes/{id}` con etapas, historial, fotos, total,
  `puede_pagar` y `pago`. Login propio: invitación por email
  (`/clientes/{id}/invitacion` + `/auth/activacion`), alta manual de usuario
  cliente, o modo demo con DNI como contraseña.
- **Falta:** el cliente **no puede** registrar vehículos, pedir turnos,
  subir fotos ni ver notificaciones: el portal es 100 % GET (más las rutas
  de pago).
- **Frontend:** `pages/Portal.jsx`, `PortalOrden.jsx`, `ResultadoPago.jsx`,
  `ActivarCuenta.jsx`.
- **Tests:** `test_portal_permisos.py`, `test_activacion.py`,
  `test_flujo_completo.py`, `test_aislamiento_talleres.py`.
- **Landing vs realidad:** "ve sus órdenes: la etapa actual, la entrega
  estimada y el total", fotos y "pagan online si tu taller lo tiene
  habilitado" — coincide con lo que hay; el pago online tiene la limitación
  de la función 17.

## 11. Avisos por email — existe

- **Backend:** `app/core/email.py` (FastMail + Gmail SMTP; settings `smtp_*`).
  Eventos que **realmente** mandan correo:
  1. Cambio de estado de la orden → `enviar_notificacion_cambio_estado`
     (background task, con template HTML y barra de progreso).
  2. Cobro emitido/aprobado → `enviar_notificacion_cobro` (background).
  3. Reenvío manual `POST /ordenes/{id}/notificaciones` (solo admin,
     sincrónico).
  4. Invitación al portal → automática al crear cliente con email
     (background) y manual `POST /clientes/{id}/invitacion` (sincrónico;
     devuelve 502 si el SMTP falla).
  Cada intento queda como comprobante en la tabla `notificaciones`
  (`resultado`: enviado/fallido/omitido). Sin SMTP configurado no rompe
  nada: registra "omitido".
- **No hay** emails para turnos, pagos ni suscripción. La tabla
  `notificaciones` no es una bandeja in-app: el cliente no ve sus avisos.
- **Tests:** `test_email.py`, `test_notificaciones.py` (10),
  `test_activacion.py`, `test_clientes_permisos.py`.
- **Landing vs realidad:** "le llega un correo cuando su orden cambia de
  etapa y cuando el taller emite el cobro" — exacto.

## 12. WhatsApp manual — no existe

- **Solo hay:** el código de plan `whatsapp_manual`
  (`app/core/funciones.py`, presente en los tres planes) y textos. **Cero**
  `wa.me`, cero compositor de mensaje, cero botón o endpoint en backend y
  frontend.
- **Tests:** solo `test_funciones_plan.py` cubre el flag (`taller_tiene`).
- **Landing vs realidad:** **promesa rota.** `Preguntas.jsx` lo anuncia como
  parte de Esencial ("mensajes de WhatsApp armados para que los mandes desde
  tu teléfono") y `ayuda/preguntas.js` repite "Boxly arma el mensaje y el
  taller lo manda desde su teléfono". Ninguna de las dos está implementada.

## 13. WhatsApp automático — no existe

- **Solo hay:** el código de plan `whatsapp_automatico` en Pro y
  Profesional. Sin Twilio, Meta Cloud API ni ninguna integración; el cupo
  mensual está pendiente de definir (`docs/Oferta.md` §2).
- **Tests:** solo `test_funciones_plan.py` (flag).
- **Landing vs realidad:** la landing lo marca "Próximamente" (correcto),
  pero `Planes.jsx` afirma que "los avisos automáticos por WhatsApp y las
  facturas ARCA tienen un cupo mensual según el plan" — el cupo no existe
  ni está definido.

## 14. Facturación electrónica ARCA — no existe

- **Solo hay:** el código de plan `arca` (Pro/Profesional) y la
  infraestructura del adicional: modelo `AdicionalTaller` + CRUD del
  superadmin `GET/POST/DELETE /plataforma/talleres/{id}/adicionales`
  (`plataforma_suscripciones/adicionales.py`, solo código `"arca"`).
- **No hay:** modelo ni endpoint de factura, CAE, integración AFIP/ARCA.
- **Tests:** `test_funciones_plan.py` (flags), `test_acceso_adicionales.py`
  (alta/baja del adicional).
- **Landing vs realidad:** honesta — "Todavía no: está en desarrollo" y chip
  "Próximamente". El "cupo mensual" de `Planes.jsx` es promesa futura.

## 15. Recordatorios de service — no existe

- **Solo hay:** el código de plan `recordatorios_service` en Profesional.
- **No hay:** campo de kilometraje en `Vehiculo` ni en ningún modelo (0
  resultados de `km`/`kilometraje`/`odometro`), ni scheduler ni jobs (la app
  no tiene tareas periódicas). El "Service de 60.000 km" del frontend es
  texto libre del motivo del turno.
- **Tests:** solo `test_funciones_plan.py` (flag).
- **Landing vs realidad:** "Próximamente" — correcto.

## 16. Personalización de marca — no existe

- **Existe (parcial de textos):** `ConfiguracionTaller`
  (`app/models/configuracion_taller.py`) con `nombre`, `razon_social`,
  `cuit`, `direccion`, `telefono`, `email`, `sitio_web`, horarios,
  `mensaje_portal`, `pie_ticket`, `dias_garantia`; editable por admin en
  `GET/PUT /api/v1/taller`. El portal lee esos datos (el cliente puede ver
  `GET /taller`).
- **No existe:** logo, colores, dominio propio ni número de WhatsApp propio.
  El código `marca_propia` solo está en Profesional y nada lo usa.
- **Tests:** `test_taller.py` (config); nada de marca.
- **Landing vs realidad:** "Próximamente" para marca — correcto; el
  `mensaje_portal`/`pie_ticket` existen pero la landing no los anuncia como
  personalización de marca.

## 17. Pago online de los clientes — parcial

- **Existe (completo pero para un solo taller):** `app/api/v1/pagos/`:
  `POST /pagos/ordenes/{id}` crea `Pago` + preferencia de Mercado Pago y
  devuelve `url_pago`; `GET /pagos/{id}`; `POST /{id}/confirmar`
  (reconsulta MP); `POST /{id}/simular` (solo dev+debug y admin);
  `POST /pagos/webhook` sin auth con firma HMAC. Estados
  pendiente/aprobado/rechazado/reembolsado, un pendiente por orden,
  pagable solo en listo/entregado con `costo_final > 0` y no pagada.
- **Limitación dura:** `pagos/service.py` rechaza con 409 todo taller que no
  sea `TALLER_PRINCIPAL_ID` (id = 1); `pago_online` en `TallerResponse` es
  `config.taller_id == 1`; hay **un solo `MP_ACCESS_TOKEN` global** —
  ningún taller conecta su cuenta de Mercado Pago.
- **Frontend:** botón "Pagar" del portal solo si `taller.pago_online`;
  `ResultadoPago.jsx` para el retorno de MP; simulación solo en dev.
- **Tests:** `test_pagos_integridad.py` (11), `test_pagos_seguridad.py`
  (11), `test_pagos_concurrencia.py` (4),
  `test_servicios_por_taller.py::test_crear_pago_en_otro_taller_da_409`.
- **Landing vs realidad:** "pagan online si tu taller lo tiene habilitado" —
  hoy solo el taller principal (id 1) lo tiene; para cualquier otro taller
  la promesa no se cumple.

## 18. Débito automático del abono — existe

- **Backend:** `app/api/v1/suscripcion_mp/` + `suscripcion/`:
  `POST /suscripcion/cobro-automatico` crea la preapproval mensual en la
  **cuenta de Mercado Pago de Boxly** (`BOXLY_MP_ACCESS_TOKEN`) y devuelve
  `init_point`; `DELETE` la cancela; `POST /suscripcion/webhook` verifica
  firma HMAC y procesa `preapproval`/`authorized_payment` de forma
  idempotente (`mp_payment_id` único) extendiendo `suscripcion_vence_en`;
  `POST /suscripcion/simular-cobro` solo dev+debug; al cambiar de plan se
  actualiza el monto de la preapproval. Sin token → 503 "El cobro automático
  todavía no está configurado".
- **Matices:** depende 100 % del webhook de MP; si la respuesta de creación
  se pierde, un reintento puede dejar una preapproval huérfana en MP
  (documentado en `service.py`). Las transferencias no existen como medio
  (correcto según `docs/Oferta.md`); el pago manual del superadmin
  (`POST /plataforma/talleres/{id}/pagos`) es herramienta interna.
- **Frontend:** `pages/Suscripcion.jsx` activar/cancelar el débito y aviso
  "El débito automático todavía no está habilitado. Escribinos" ante el 503.
- **Tests:** `test_suscripcion_mp.py` (19), `test_acceso_adicionales.py`,
  `test_suscripciones.py`, `test_caminos_criticos.py`.
- **Landing vs realidad:** "débito automático de Mercado Pago. Lo activás o
  lo cancelás con un botón" — real, sujeto a que el servidor tenga
  `BOXLY_MP_ACCESS_TOKEN` configurado.

## 19. Acceso de soporte — existe

- **Backend:** modelo `AccesoSoporte` (`otorgado_por`, `motivo`,
  `desde`/`hasta`, `revocado_*`). Lado taller (admin): `GET/POST
  /soporte/accesos` (horas ∈ {1, 4, 24, 72} + motivo; 409 si ya hay vigente),
  `POST /soporte/accesos/{id}/revocar`, `GET /soporte/actividad`.
  Lado plataforma: `GET /plataforma/soporte`.
- **Modo soporte:** superadmin + header `X-Taller-Soporte` + acceso vigente
  → sesión fijada al taller, `require_roles` lo trata como administrador en
  **solo lectura** (GET/HEAD/OPTIONS; escrituras 403). Middleware
  `app/core/enmascarado.py` enmascara `dni`, `telefono`, `email`,
  `direccion`, `cuit` en las respuestas JSON.
- **Frontend:** `components/soporte/AccesoSoporte.jsx` (en Configuración),
  `context/SoporteContext.jsx`, vistas de plataforma.
- **Tests:** `test_soporte.py` (15), `test_auditoria.py`,
  `test_aislamiento_talleres.py`.
- **Landing vs realidad:** "dura el tiempo que elegís, es de solo lectura,
  los datos personales se ven enmascarados y lo podés revocar" — exacto.

## 20. Respaldo — parcial

- **Existe:** `GET /api/v1/taller/respaldo` (admin) → ZIP en memoria con 11
  CSV: usuarios, clientes, vehículos, órdenes, detalles, historial de
  estados, repuestos, turnos, pagos, horarios de mecánicos y configuración
  del taller. Excluye columnas `password`/`token`/`secret`. El filtro por
  taller garantiza que no mezcle datos.
- **Falta:** no hay respaldo de plataforma para el superadmin ni backups
  programados/externos (la app no tiene scheduler).
- **Frontend:** `pages/Admin.jsx` descarga el respaldo (la UI lo llama CSV;
  en realidad es un ZIP de CSVs).
- **Tests:** `test_sistema.py` (9),
  `test_aislamiento_talleres.py::test_respaldo_del_taller_a_no_contiene_datos_de_b`.
- **Landing vs realidad:** "descargás un archivo con todos tus datos en CSV"
  — real para el taller (matiz: es ZIP y cubre 11 tablas; no incluye
  notificaciones ni accesos de soporte, que son razonables de omitir).

## 21. Auditoría — existe

- **Backend:** `AuditoriaMiddleware` (`app/core/auditoria.py`, ASGI):
  registra todo `POST|PUT|PATCH|DELETE` bajo `/api/v1` (cualquier status),
  los GET solo cuando vienen en modo soporte confirmado, y el email
  intentado en `POST /auth/login` (sin password). Cada fila guarda usuario,
  taller, rol, método, ruta, entidad, estado HTTP e IP.
- **Lectura:** `GET /taller/auditoria` + `/taller/auditoria/exportar` (admin,
  filtrado por taller) y `GET /plataforma/auditoria` + `/exportar`
  (superadmin, filtro `taller_id`), CSV con BOM, tope 10.000 filas.
- **No audita:** GETs de uso normal, OPTIONS, ni rutas fuera de `/api/v1`.
  El campo `detalle` existe pero hoy siempre es NULL (no guarda el antes/
  después del cambio).
- **Frontend:** `components/superadmin/Auditoria.jsx`, panel admin.
- **Tests:** `test_auditoria.py` (14), `test_soporte.py`,
  `test_aislamiento_talleres.py`.
- **Landing vs realidad:** "guarda quién hizo qué en el taller, y cada
  consulta de soporte aparece en tu actividad de soporte" — real; matiz: no
  guarda el detalle del cambio ni los GETs normales.

## Frases de la landing que prometen algo que no existe o no aplica a todos los planes

1. **`Preguntas.jsx` — "¿Qué diferencia hay entre los planes?":** "Esencial
   trae la gestión diaria: … avisos por email y **mensajes de WhatsApp
   armados para que los mandes desde tu teléfono**". El WhatsApp manual **no
   existe** (sin `wa.me`, sin compositor, sin botón). Es la única función
   presentada como existente que no está implementada. Además figura en la
   tarjeta del plan Esencial sin chip "Próximamente" (`funcionesPlan.js`
   excluye `whatsapp_manual` de `PROXIMAMENTE`).
2. **`ayuda/preguntas.js` — "¿Qué trae cada plan?":** repite "WhatsApp
   manual (Boxly arma el mensaje y el taller lo manda desde su teléfono)"
   dentro de la app — mismo problema.
3. **`Planes.jsx` — pie de sección:** "Los avisos automáticos por WhatsApp y
   las facturas ARCA **tienen un cupo mensual según el plan**". El cupo
   mensual no existe: está pendiente de definir (`docs/Oferta.md` §2) y las
   funciones tampoco están construidas.
4. **`Preguntas.jsx` / `Funciones.jsx` — pago online del cliente:** "pagan
   online **si tu taller lo tiene habilitado**". Hoy solo el taller
   principal (`TALLER_PRINCIPAL_ID` = 1) lo tiene: cualquier otro taller
   recibe 409. La frase es técnicamente cierta pero en la práctica aplica a
   un solo taller.
5. **`funcionesPlan.js` — `DETALLE_GESTION`:** "Inventario con **alerta** de
   stock mínimo" y `Funciones.jsx`: "aviso de stock bajo en la pantalla de
   hoy". Existe el panel visual en Hoy, pero no hay alerta activa (mail,
   WhatsApp ni notificación); si "alerta" se lee como aviso proactivo, la
   promesa es mayor que la realidad.
6. **`ComoFunciona.jsx` — paso Cobro:** "El cliente paga en el taller". No
   hay registro de pago presencial: se puede aprobar el cobro pero no
   constatar que se cobró en efectivo, y la orden nunca queda "pagada" por
   esa vía (solo pagos de Mercado Pago aprobados la marcan).
7. **`Planes.jsx` — "Gestión diaria del taller" → `DETALLE_GESTION`:**
   "Registro de cobros" se cumple solo como aprobación del cargo; si se
   interpreta como registrar cobros recibidos en el local (efectivo,
   transferencia, tarjeta), esa parte no existe (ver función 8).

### Lo que la landing actual ya dice bien (verificado)

- Demo de **14 días del plan Pro, previa aprobación** (Hero, Planes,
  Preguntas, PasosDemo) — coincide con `docs/Oferta.md`.
- Planes diferenciados por funciones con chips "Próximamente" en
  `whatsapp_automatico`, `arca`, `recordatorios_service`, `marca_propia`.
- Pago del abono **solo** por débito automático de Mercado Pago (sin
  transferencias en la landing; `Suscripcion.jsx` dice "escribinos" ante el
  503).
- Soporte de solo lectura con datos enmascarados y revocable; respaldo CSV;
  aislamiento entre talleres; auditoría — todo real.
- Emails solo en cambio de etapa y cobro — exacto.
