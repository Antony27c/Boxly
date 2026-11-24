# Oferta comercial de Boxly: contrato (tanda C)

Decisiones del dueño del 2026-11-23. **Este documento reemplaza** las partes de `docs/Suscripciones.md` y `docs/Landing.md` que lo contradigan. No describe código ya hecho: el estado real de cada función sale de `docs/Disponibilidad.md` (tarea C1).

## 1. Decidido

| Tema | Decisión |
| --- | --- |
| Planes | **Esencial**, **Pro** y **Profesional**, de menor a mayor. Códigos: `esencial`, `pro`, `profesional`. No se usan Básico, Taller+, Plus ni Premium. |
| Contenido | Los planes **no** tienen las mismas funciones. Esencial cubre la gestión diaria; los superiores suman automatización. |
| Esencial | Clientes, vehículos, turnos, órdenes con fotos e historial, inventario con alerta de stock mínimo, registro de cobros, métricas básicas, portal del cliente, avisos por email y WhatsApp **manual** (mensaje armado que el taller manda desde su teléfono). |
| Pro | Todo Esencial, más avisos **automáticos** por WhatsApp y Telegram (turnos y estados) y **facturas electrónicas ARCA** incluidas, con un cupo mensual de facturas. Telegram lo sumó el dueño el 2026-11-23. |
| Profesional | Todo Pro, más un **cupo mayor de facturas ARCA**, **recordatorios automáticos de service** y **personalización de marca**. Entre Pro y Profesional, en ARCA lo único que cambia es la cantidad de facturas por mes (dueño, 2026-11-23). |
| ARCA | Incluido en Pro y Profesional, con distinto cupo mensual de facturas. En Esencial, es un **pack aparte que se paga por separado** (adicional), solo si el taller lo necesita. Es para emitir la factura de una reparación con una acción y una confirmación del usuario. No es para cargar facturas de proveedores ni para emitir facturas sin intervención de nadie. |
| Adicionales | Confirmado solo para ARCA. No se asume que otros módulos futuros sean adicionales. |
| Prueba | **No hay prueba abierta.** Desde la landing se pide una demo y Boxly elige a quién aprobar. |
| Demo | **Plan Pro durante 14 días**, otorgada por el superadmin a una solicitud aprobada. |
| Piloto | El superadmin puede dar acceso sin cargo a talleres elegidos, con una duración que fija en cada caso. Nunca es gratis para siempre por defecto. |
| Cobro del abono | **Mercado Pago**, con débito automático (ya hecho en S2). **Sin transferencias.** La cuenta de Mercado Pago del abono es separada de la de los cobros a clientes de cada taller: nunca se mezclan cuentas ni fondos. |
| Mercado Pago de los talleres | Se mantiene para los cobros de los talleres a sus clientes. La forma de conectar la cuenta de cada taller queda pendiente. |

## 2. Pendiente (no inventar ni prometer)

- **Precios:** quedan como referencia de trabajo $35.000 (Esencial), $79.000 (Pro) y $169.000 (Profesional) por mes. No son los precios comerciales definitivos.
- **Cupos:** de WhatsApp, de ARCA y de órdenes. No se confirmaron los topes viejos de 100, 300 y 1.000.
- **Límites de personal:** 3, 10 y sin límite, aceptados en forma tentativa y con el sin límite en revisión. Se mantienen en el sistema como valores editables.
- **Comercial y fiscal:** precio del adicional ARCA, excedentes, política de ajustes, pago anual, proveedor ARCA, condición fiscal de Boxly y comprobantes propios de Boxly.
- **Mercado Pago:** comisión y plazo de acreditación.
- **Detalles de la personalización de marca:** dominio propio, número de WhatsApp propio, costos.
- **Legal:** términos y privacidad siguen como borrador. No se inventan razón social, CUIT ni contacto legal.
- **Las 26 preguntas** de `docs/Contexto-para-definir.md` que no se trataron siguen abiertas: hosting, dominio, base de datos, respaldos, soporte, baja y retención de datos, presupuesto aprobado por el cliente, sucursales y pilotos.

## 3. Contradicciones con lo que ya existe (hay que corregir)

| Dónde | Hoy | Corrección |
| --- | --- | --- |
| Planes en la base (migración b8d4f2a6c013) y `PLANES_INICIALES` | `basico`, `pro`, `taller_plus` con $15.000, $30.000 y $50.000 | Códigos y nombres nuevos, con los precios de referencia (C0) |
| `docs/Suscripciones.md` | "todos los planes tienen las mismas funciones" | Funciones por plan (C0 y C2) |
| Alta de taller (S1) | Plan básico con 30 días de prueba | Tipo de acceso al crear: demo (Pro, 14 días), piloto (plan y fecha a elección) o pago (C2) |
| Migración b8d4f2a6c013 | Talleres existentes con 30 días de prueba | Pasan a Esencial; su vencimiento queda como está (C0) |
| Landing (Hero, Planes, Preguntas, Contacto) | "30 días de prueba", "transferencia o débito", las mismas funciones en todos | Demo de 14 días con solicitud, solo Mercado Pago, funciones por plan marcadas como disponibles o próximamente según C1 (C4) |
| Pantalla `/suscripcion` (S6) | El 503 dice "pagá por transferencia y avisale a Boxly" | "El débito automático todavía no está habilitado, escribinos" (C4) |
| Ayuda, `docs/Guia-de-uso.md` | 30 días de prueba, transferencia, las mismas funciones | Lo nuevo (C5) |
| Pago manual del superadmin (S1) | Pensado para transferencias | Queda como herramienta interna para ajustes, cortesías y pilotos, sin ofrecerla a los talleres. **Pregunta abierta al dueño** |

## 4. Modelo técnico

**Funciones por plan.** La tabla `planes` suma `funciones` (lista JSON de códigos) y una tabla de cupos para más adelante. Los códigos de función:

| Código | Esencial | Pro | Profesional |
| --- | --- | --- | --- |
| `gestion` (todo lo diario) | sí | sí | sí |
| `whatsapp_manual` | sí | sí | sí |
| `whatsapp_automatico` | no | sí | sí |
| `telegram_automatico` | no | sí | sí |
| `arca` | adicional | sí | sí |
| `recordatorios_service` | no | no | sí |
| `marca_propia` | no | no | sí |

**Cupo de facturas ARCA por plan:** es un campo `cupo_facturas_arca` en `planes`, entero o null, que edita el superadmin. Mientras sea null, la landing no muestra ningún número (los cupos siguen pendientes).

**Cómo muestra la landing una función que todavía no existe:** sin tilde de "incluido", con otro ícono y texto atenuado, y la marca "Próximamente". Así no parece que ya funciona.

El helper `taller_tiene(db, taller, funcion) -> bool` mira el plan y los adicionales del taller. Las funciones que todavía no existen tienen su código, pero nada las usa hasta que se construyan.

**Adicionales.** Tabla `adicionales_taller` (`taller_id`, `codigo` (`arca`), `activo`, `desde`, `hasta`). El superadmin los activa. Precio y cupo siguen pendientes.

**Tipo de acceso del taller.** `talleres.tipo_acceso`: `pago`, `demo` o `piloto`.
- **Demo:** plan Pro, vencimiento a hoy + 14 días.
- **Piloto:** el plan y el vencimiento los elige el superadmin, con motivo.
- **Fin de la demo (decidido el 2026-11-23):**
  - Al vencer, la demo **no tiene gracia**. Arranca un período de **3 días en solo lectura** para elegir y pagar un plan. Pasados esos 3 días sin pago, el taller queda **suspendido**: nadie ve nada, ni en lectura. El administrador solo puede entrar a `/suscripcion` para pagar.
  - Al entrar después del vencimiento, el administrador ve una pantalla **"Gracias por probar Boxly"** con una encuesta corta: qué le gustó, qué mejoraría, sugerencias y si piensa contratar. La encuesta es opcional, se puede saltear y se responde una sola vez por taller.
  - Después de la encuesta, o de saltearla, va a `/suscripcion` a elegir un plan.
  - Las respuestas las ve el superadmin en `/plataforma/encuestas`.
  - Si paga un plan en cualquier momento, el taller pasa a `pago` al instante.
- **Piloto:** al vencer, rige el esquema normal de gracia, solo lectura y suspensión. **Pendiente de confirmar con el dueño.**
- El superadmin puede convertir una demo o un piloto en pago.

**API de C2** (todo del superadmin, salvo donde se indica):

| Método | Ruta | Detalle |
| --- | --- | --- |
| POST | `/api/v1/plataforma/talleres` | El alta de P1 suma `acceso: {tipo: pago\|demo\|piloto, plan?, vence_en?, motivo?}`. **Demo:** fuerza el plan Pro y el vencimiento a hoy + 14 días. **Piloto:** pide `plan`, `vence_en` y `motivo`. **Pago:** pide `plan` y `vence_en` es opcional (por defecto, hoy). Sin `acceso`, el valor por defecto es demo. |
| POST | `/api/v1/plataforma/talleres/{id}/acceso` | Recibe `{tipo, plan?, vence_en?, motivo?}` para convertir el acceso (por ejemplo, de demo a pago o a piloto). Queda auditado. |
| GET | `/api/v1/plataforma/talleres/{id}/adicionales` | Lista de los adicionales del taller. |
| POST | `/api/v1/plataforma/talleres/{id}/adicionales` | Recibe `{codigo: "arca", desde?, hasta?}`. Si el plan ya incluye la función, responde 409 `"El plan ya incluye esta función"`. |
| DELETE | `/api/v1/plataforma/talleres/{id}/adicionales/{codigo}` | Desactiva el adicional. |
| PUT | `/api/v1/plataforma/planes/{codigo}` | Suma `funciones` (lista de códigos válidos) a lo que ya aceptaba. |

`PlanResponse` suma `funciones: list[str]`. `SuscripcionResponse` suma `tipo_acceso`, `adicionales: list[{codigo, desde, hasta}]` y `funciones_efectivas: list[str]` (las del plan más las de los adicionales). `TallerResumen` suma `tipo_acceso`. Un pago aprobado (manual o de Mercado Pago) en un taller demo o piloto lo pasa a `pago`.

**Estado según el tipo de acceso.** `estado_suscripcion` recibe el tipo de acceso:

| Días desde el vencimiento | Pago y piloto | Demo |
| --- | --- | --- |
| 1 a 7 | gracia | solo lectura |
| 8 a 30 | solo lectura | 1 a 3: solo lectura; desde el 4: suspendida |
| 31 o más | suspendida | suspendida |

**Encuesta de fin de demo.** Tabla `encuestas_demo`:
- `id`, `taller_id` (único), `respondida_por_id`, `creado_en`;
- `gusto` (texto, hasta 1000), `mejoras` (texto, hasta 1000), `sugerencias` (texto, hasta 1000);
- `puntaje` (1 a 5, opcional);
- `intencion` (`contratar`, `tal_vez`, `no`; opcional);
- `salteada` (bool).

Es dato de la plataforma sobre el taller, sin datos de clientes.

| Método | Ruta | Detalle |
| --- | --- | --- |
| GET | `/api/v1/suscripcion/encuesta` | Administrador. `{corresponde: bool, respondida: bool}`. `corresponde` es true si el taller es demo, ya venció y todavía no respondió ni salteó. |
| POST | `/api/v1/suscripcion/encuesta` | Administrador. Recibe los campos de arriba, o `{salteada: true}`. Una sola vez por taller; si ya respondió, 409. |
| GET | `/api/v1/plataforma/encuestas` | Superadmin. Lista paginada con el taller, la fecha, las respuestas y `X-Total-Count`. Filtros `?intencion=` y `?taller_id=`. |

Las rutas `/suscripcion*` ya quedan libres del bloqueo, así que la encuesta anda aunque el taller esté en solo lectura o suspendido.

## 4b. Lo que falta construir para que Esencial cumpla lo que promete

C1 (`docs/Disponibilidad.md`) encontró tres funciones de Esencial que todavía no están completas. Son funciones ya decididas para el plan, no inventadas:

- **W1. WhatsApp manual** (solo frontend).
  - Botón "WhatsApp" en la orden, el turno y el cliente. Abre `https://wa.me/<teléfono>?text=<mensaje>` con un mensaje armado según el evento: turno confirmado, recordatorio del turno, auto recibido, presupuesto o trabajos a cotizar, auto listo y link al portal.
  - El taller lo manda desde su propio teléfono. No hay integración, ni cupo, ni costo.
  - El teléfono se normaliza al formato argentino (`549` + código de área + número). Si falta, el botón queda deshabilitado con su explicación.
  - Los textos van en un solo módulo de plantillas.
- **W2. Cobro registrado en el local** (backend y frontend).
  - Recepción o el administrador registran el pago presencial de una orden con cobro emitido: `POST /api/v1/ordenes/{id}/pago-local` con `{medio: efectivo|tarjeta|transferencia|otro, monto, referencia?}`.
  - El pago queda en `pagos` con su medio y la orden queda pagada, igual que con un pago online aprobado. El mecánico recibe 403.
  - Se ve en el detalle de la orden, en el portal ("Pagada") y en las métricas.
  - El "transferencia" de acá es el cobro del taller a su cliente, no el abono de Boxly.
- **W3. Aviso de stock mínimo** (backend).
  - Cuando un descuento o un ajuste deja un repuesto en `stock_minimo` o por debajo, se crea una notificación interna para el administrador y recepción.
  - Hay una sola notificación por cruce del umbral: no se repite mientras siga bajo. Se rearma cuando el stock vuelve a subir por encima.
- **Historial del vehículo:** hoy son sus órdenes. La landing tiene que decir "historial de órdenes del vehículo" y no prometer más.

## 5. Tareas

| Tarea | Qué | Depende de |
| --- | --- | --- |
| C1 | Auditoría de disponibilidad: cada función de cada plan, marcada como existe, parcial o no existe, con evidencia en el código. Resultado en `docs/Disponibilidad.md`. Solo lectura. | — |
| C0 | Backend fase 0: migración con los códigos y nombres nuevos y los precios de referencia, `planes.funciones`, `adicionales_taller`, `talleres.tipo_acceso`, `taller_tiene`, y los tests que nombran `basico` o `taller_plus` | — |
| C2 | Backend: alta con tipo de acceso (demo, piloto o pago), conversión, adicionales para el superadmin, funciones en las respuestas de planes y de suscripción | C0 |
| C3 | Frontend del superadmin: alta con tipo de acceso, editor de planes con funciones, adicionales del taller | C0 y C2 (contrato) |
| C4 | Frontend: textos de la landing y de `/suscripcion` según las decisiones y la disponibilidad | C1 |
| C5 | Ayuda y `docs/Guia-de-uso.md` al día | C1 |
| C6 | Backend: fin de la demo (estado según el tipo de acceso), tabla y rutas de la encuesta | C0 |
| C7 | Frontend: pantalla "Gracias por probar Boxly" con la encuesta y página `/plataforma/encuestas` del superadmin | Contrato (programa contra la API, con mocks) |
