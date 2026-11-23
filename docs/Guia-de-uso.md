# Guía de uso de Boxly

Manual para quien usa Boxly día a día: dueños de taller, recepción, mecánicos y
clientes. Está pensado para leerse sin saber nada de tecnología.

> Boxly es el sistema donde el taller maneja sus clientes, vehículos, órdenes de
> trabajo, repuestos, turnos y cobros. Cada taller tiene su propio espacio: los
> datos de tus clientes son tuyos.
>
> Dentro de la app, la pantalla **Ayuda** (en el menú de usuario, la
> hamburguesa de arriba a la derecha, o al pie de Configuración) tiene más
> preguntas frecuentes por tema: turnos, cobros, inventario y portal.

## 1. Qué es Boxly y quiénes lo usan

Boxly tiene dos caras:

- **Tu taller**: la aplicación que usás todos los días para trabajar.
- **Boxly, la empresa**: la plataforma que te presta el servicio. El equipo de
  Boxly administra los talleres desde un panel propio, pero **no ve los datos de
  tus clientes** (nombres, teléfonos, patentes, órdenes, pagos) salvo que vos le
  des un acceso de soporte puntual — te explicamos cómo en la sección del
  administrador.

### Los roles

Cada persona del taller tiene un rol, y el rol define qué puede hacer:

| Rol | Qué hace |
| --- | --- |
| **Administrador** | Todo lo del taller, más: alta de personal, métricas del negocio, panel del taller (datos, auditoría, respaldo), acceso de soporte y suscripción. |
| **Recepción** | El mostrador: clientes, vehículos, turnos, órdenes, inventario, horarios y cobros. |
| **Mecánico** | "Mi trabajo": sus órdenes asignadas, cambios de etapa, carga de trabajos y repuestos (sin precio), fotos, propuesta de cobro y su horario. |
| **Cliente** | No es del taller: es tu cliente. Entra a su portal para ver el estado de sus autos y pagar online. |

El menú de cada persona solo muestra lo que su rol puede usar. Si algo no
aparece, probablemente no es tu rol: hablalo con el administrador.

## 2. Primer ingreso

### Personal del taller (administrador, recepción, mecánico)

1. Entrás a Boxly con tu **correo** y tu **contraseña**.
2. Si es tu primera vez, tu administrador te da una **contraseña temporal**. Podés
   cambiarla cuando quieras desde **Usuarios → Editar → Nueva contraseña** sobre
   tu propio usuario.
3. Si sos **administrador** y es la primera vez que entrás, Boxly te lleva
   primero a leer y aceptar los **Términos y privacidad**. Es una sola vez por
   versión: aceptás con un botón y ya podés usar todo.

### Cliente

1. El taller te carga con tu correo y te manda un correo con un enlace.
2. Abrís el enlace, revisás tus datos, elegís tu contraseña (mínimo 8
   caracteres, letras y números) y confirmás.
3. Después entrás con tu correo y esa contraseña.

> Si perdiste la contraseña no hay recuperación automática: pedile al
> administrador que la restablezca. Si sos cliente y el enlace no llega o venció,
> hablale al taller.

## 3. Recepción: el día a día del mostrador

### Clientes y vehículos

- **Clientes → Nuevo cliente**: asistente de tres pasos — datos del cliente
  (nombre, DNI, teléfono; el correo es opcional pero hace falta para invitarlo
  al portal), su vehículo (patente, marca, modelo, año) y qué sigue (recibir el
  auto, darle turno o invitarlo al portal).
- Si el DNI o el teléfono ya existen, Boxly avisa y te deja usar ese cliente en
  vez de cargarlo dos veces.
- **Vehículos**: buscás por patente o modelo, filtrás por cliente y con "Ver
  ficha" ves todos los datos y el historial de reparaciones del auto.

### Turnos

- **Turnos → Nuevo turno**: cliente, vehículo, fecha, horario y servicio. La
  agenda es de lunes a sábado y cada horario admite un solo vehículo —los
  ocupados no se pueden elegir—.
- Los estados del turno: **pendiente** y **confirmado** (agendado), **en el
  taller** (el auto ya llegó), **completado** y **cancelado**.
- Cuando el cliente llega con turno, la tarjeta tiene **"Recibir auto"**: se
  abre el ingreso con los datos ya cargados y el turno pasa solo a "En el
  taller".

### Recibir un auto y crear la orden

- Si llega **sin turno**: **Órdenes → "Recibir un auto"** (también está en
  Hoy). Escribís la patente y el sistema busca todo solo; si es una patente
  nueva, te pide cargar cliente y vehículo en el mismo paso.
- Contás qué trabajo hay que hacerle (hay sugerencias: Service, Frenos, etc.),
  elegís mecánico y entrega estimada si querés, y confirmás.

### Las líneas "a cotizar"

Cada línea de la orden (trabajo o repuesto) tiene un precio. Cuando el mecánico
carga trabajos, la mano de obra queda **"a cotizar"**: es tu trabajo ponerle
precio. En la página de la orden, pestaña **Trabajo**, cada línea a cotizar
tiene su casillero para ingresar el precio y guardar. Mientras queden líneas a
cotizar, el cobro no se puede emitir.

### Cobrar y entregar

1. Cuando la orden está **Listo**, emitís el cobro desde la pestaña **Cobro**
   de la orden ("Emitir cobro").
2. El cliente lo ve en su portal y paga online con Mercado Pago.
3. Cuando el pago se acredita, la orden queda **Pagada** y el auto se entrega:
   "Cambiar etapa → Entregado".

## 4. Mecánico: el trabajo en el taller

- Tu pantalla es **Hoy**, que para vos es **"Mi trabajo"**: solo ves tus órdenes
  abiertas, ordenadas por lo que hay que hacer primero, cada una con el botón de
  la acción que te toca.
- **Cambiar de etapa**: cada paso pide un comentario (mínimo 5 caracteres) que
  queda en el historial y que el cliente ve en su portal como seguimiento. Podés
  adjuntar fotos de la etapa en el mismo paso o desde la pestaña **Fotos**.
- Las etapas: **Ingresado → En diagnóstico → (Esperando repuestos) → Listo →
  Entregado**. Podés pasar a "Esperando repuestos" si falta algo y marcar
  "Listo" cuando terminás.
- **Pestaña Trabajo**: cargás las líneas —trabajos (mano de obra) y repuestos
  del inventario— con cantidad y descripción. **No cargás precios**: el repuesto
  toma el precio del inventario solo, y la mano de obra queda "a cotizar" para
  que recepción o el administrador la cotice.
- **Cobro**: podés proponer el monto del cobro; recepción o el administrador lo
  revisa y lo emite.
- En **Horarios** ves "Mi horario": las franjas que el administrador cargó para
  vos (vos no las editás).

## 5. Administrador: la gestión del taller

Además de todo lo de recepción y lo del panel, el administrador tiene estas
pantallas:

### Usuarios y el límite del plan

- **Usuarios**: alta, edición, desactivación y restablecimiento de contraseña de
  todo el personal del taller. El último administrador activo está protegido:
  no se puede quedar el taller sin administrador.
- Tu plan tiene un **límite de personal** (usuarios del taller, sin contar
  clientes). Al llegar al límite, el alta se bloquea con el aviso del plan —
  desde ahí te conviene ver la suscripción.

### Dashboard

Métricas del taller: órdenes cerradas, facturado, tiempo promedio de trabajo,
órdenes por mecánico y finanzas, con comparativas por período.

### Panel del taller (`/admin`)

- **Datos del taller**: la configuración del taller.
- **Auditoría**: el registro de quién hizo qué en el taller (altas, cambios,
  cobros), con filtros y exportación a CSV.
- **Respaldo**: descargás un ZIP con todos los datos de tu taller en CSV, para
  tener una copia propia.

### Acceso de soporte

En **Configuración → Acceso de soporte** podés darle a Boxly acceso temporal a
tu taller para que te ayuden:

- Elegís la duración (**1, 4, 24 o 72 horas**) y un motivo, y Boxly entra en
  **modo soporte**: una franja amarilla arriba de todo avisa que está pasando,
  y todo queda **en solo lectura** — no puede cambiar nada.
- Los datos personales que Boxly ve aparecen **enmascarados** (por ejemplo el
  DNI se ve `****5678`).
- Todo lo que mira queda **registrado**: en la misma sección ves el historial de
  accesos y la **actividad de soporte** (qué pantallas y datos consultó).
- Podés **revocar** el acceso cuando quieras, y si vence solo, se corta solo.

> Regla de fondo: Boxly no ve los datos de tus clientes. Solo entra si vos se lo
> permitís, por tiempo limitado y quedando todo registrado.

### Suscripción

En **Suscripción** (`/suscripcion`) ves y manejás tu plan:

- **Estado**: al día, en gracia, solo lectura o suspendida, con la fecha de
  vencimiento y el próximo monto.
- **Planes**: comparación de Básico, Pro y Taller+ (precio por mes y límite de
  personal). "Pasar a este plan" pide confirmación: el precio nuevo rige desde
  el próximo período. Si tu personal activo supera el límite del plan elegido,
  Boxly te avisa y no deja hacer el cambio.
- **Pagos**: historial de lo pagado (transferencia o Mercado Pago).
- **Cobro automático**: con un botón activás el débito automático con Mercado
  Pago; también podés cancelarlo cuando quieras.

#### Qué pasa si se vence el pago

| Días desde el vencimiento | Estado | Qué pasa |
| --- | --- | --- |
| Hasta el día del vencimiento | **Al día** | Todo normal. |
| Días 1 a 7 | **Gracia** | Todo normal + aviso ámbar para regularizar antes del corte. |
| Días 8 a 30 | **Solo lectura** | El personal y los clientes solo pueden mirar: no se puede registrar nada nuevo. El administrador igual puede entrar a Suscripción para pagar. |
| 31 días o más | **Suspendida** | El taller queda bloqueado: solo el administrador entra, y solo a Suscripción para regularizar. El resto del personal ve un aviso para hablar con el administrador. |

Si pagás por transferencia, el pago lo registra Boxly y el estado se actualiza
solo. Si una pantalla te responde que el taller está "en solo lectura" o
"suspendido", es esto: regularizá el pago desde Suscripción o escribinos.

## 6. Cliente: el portal

- Entrás con tu correo y contraseña (te llegaron por correo cuando el taller te
  cargó).
- **Mis órdenes**: cada tarjeta muestra la etapa actual, la entrega estimada y
  el total. "Ver seguimiento" te muestra el recorrido completo del trabajo:
  cada etapa, con la descripción y las fotos que subió el taller.
- **Mis vehículos**: el estado de cada auto; si tiene un trabajo en curso te
  lleva directo al seguimiento.
- **Pagar**: cuando el taller termina y emite el cobro, la orden aparece en
  "Listas para pagar" con el botón **Pagar** y el monto. Pagás de forma segura
  con Mercado Pago; si el pago se rechaza podés reintentar. Cuando se acredita,
  el taller te entrega el auto.

## 7. Preguntas frecuentes

**¿Boxly puede ver los datos de mis clientes?**
No. Boxly, la empresa, no ve nombres, teléfonos, patentes, órdenes ni pagos de
tus clientes. Solo entra a tu taller si vos le das un **acceso de soporte**
temporal desde Configuración: es solo lectura, los datos personales se ven
enmascarados y todo queda registrado. Vos podés revocarlo cuando quieras.

**¿Qué pasa si no pago la suscripción a tiempo?**
Tenés 7 días de gracia con aviso. Después el taller pasa a **solo lectura**
(podés mirar todo pero no registrar cambios) y, pasados 30 días, queda
**suspendido**: solo el administrador puede entrar, y solo a la pantalla de
Suscripción para pagar. Regularizar el pago te devuelve todo a la normalidad.

**¿Cómo subo o bajo de plan?**
En **Suscripción** comparás los planes y tocás "Pasar a este plan" en el que
quieras. Te pide confirmación porque el precio nuevo rige desde el próximo
período. Si tu personal activo supera el límite del plan elegido, Boxly te avisa
cuántos son y no deja hacer el cambio.

**¿Cómo pago la suscripción?**
Por transferencia (avisale a Boxly y registra el pago) o activando el **cobro
automático** con Mercado Pago desde la misma pantalla de Suscripción.

**¿Por qué no puedo cargar precio siendo mecánico?**
Por diseño: el mecánico no pone precios. El repuesto toma el precio del
inventario automáticamente y la mano de obra queda "a cotizar" para que
recepción o el administrador le ponga precio. Así los precios quedan siempre en
manos del taller.

**¿Qué es una línea "a cotizar"?**
Es una línea de la orden sin precio. Recepción o el administrador la cotiza
desde la pestaña Trabajo de la orden. Mientras queden líneas a cotizar no se
puede emitir el cobro.

**¿Cómo le doy acceso a Boxly para que me ayude?**
En **Configuración → Acceso de soporte** elegís la duración (1, 4, 24 o 72
horas) y el motivo. Boxly entra en modo soporte: solo lectura, datos personales
enmascarados y todo registrado en la actividad de soporte que ves ahí mismo.
También podés revocarlo antes.

**¿Qué es el Panel del taller?**
Está en el menú como "Panel del taller" (solo administrador): datos del taller,
auditoría de todo lo que se hizo en el taller y respaldo — un ZIP con tus datos
en CSV para tener copia propia.

**¿Cómo invito a un cliente al portal?**
Cargalo como cliente con su correo y en el alta elegí "Invitarlo al portal" (si
quedó pendiente, en Clientes está "Reenviar correo de verificación"). Le llega
un correo con el enlace para que elija su contraseña.

**¿El cliente puede pagar online?**
Sí: cuando el taller emite el cobro, el cliente lo ve en su portal y paga con
Mercado Pago. Si tu taller todavía no tiene habilitado el cobro online, el
cliente paga en el taller como siempre.

**¿Puedo usar Boxly desde el celular?**
Sí, se adapta sola: abajo aparece una barra con las secciones principales y "Más"
para el resto. En la orden, el botón con la acción que te toca queda fijo abajo.

**¿Cuánto personal puedo tener?**
Depende de tu plan: cada plan tiene su límite de usuarios del taller (los
clientes no cuentan). Lo ves en Suscripción, y al llegar al límite el alta de
usuarios se bloquea con el aviso de pasar a un plan mayor.

**¿Qué datos guarda Boxly de mi taller?**
Todo lo del taller: clientes, vehículos, órdenes, repuestos, turnos, pagos y el
registro de acciones. Son datos del taller — podés descargarlos cuando quieras
desde Panel del taller → Respaldo.

**¿Qué pasa si se corta internet o se va la luz?**
Los datos quedan guardados en Boxly, no en tu compu: cuando vuelve la conexión
entrás y seguís donde estabas. Si algo no se guardó, la pantalla te avisa y lo
reintentás.
