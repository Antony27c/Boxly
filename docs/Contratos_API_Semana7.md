# Contratos de API — Semana 7 — Boxly

**Proyecto:** Boxly – Sistema de Gestión de Taller Mecánico Automotriz  
**Sprint:** Semana 7 · **Tarea:** Definir contratos de API de la semana  
**Responsable:** Antonio Chocobar (Scrum Master)  
**Versión:** 1.0 · **Fecha:** 10/2026

---

## 1. Para qué sirve este documento

Acá quedan fijados los endpoints nuevos de la semana: ruta, método, quién puede usarlos, qué reciben y qué devuelven, con JSON de ejemplo.

- **Backend (Antonio, Gabriel):** implementa exactamente estas rutas y formas de respuesta. Si algo tiene que cambiar, se actualiza este documento y se avisa al equipo.
- **Frontend (Julieta, Pablo):** carga estos datos en `frontend/src/mocks/db.js` y arma los services contra estos contratos, así el día 5 alcanza con `VITE_USAR_MOCK=false`.

Estado de cada área al momento de escribir esto:

| Área | Responsable backend | Estado |
|---|---|---|
| Rol cliente y login | Antonio | Sin empezar |
| Permisos del mecánico | Antonio | Sin empezar |
| Portal del cliente | Antonio | Sin empezar |
| Pagos (Mercado Pago sandbox) | Antonio | Sin empezar |
| Descripción por etapa | Gabriel | PR #25 (con cambios pedidos) |
| Catálogo y búsquedas | Gabriel | PR #25 (falta migración, seed y `?q=`) |
| Imágenes de órdenes | Gabriel | Sin empezar · el frontend ya está en `juli/ram` |
| Inventario | Gabriel | Sin empezar |
| Métricas, finanzas y mejor mecánico | Gabriel | Sin empezar |
| Horarios y calendario | Gabriel | Sin empezar |

---

## 2. Convenciones generales

Aplican a todos los endpoints, nuevos y existentes.

| Tema | Regla |
|---|---|
| Base | `http://localhost:8000/api/v1` |
| Autenticación | `Authorization: Bearer <token>` en todo salvo `POST /auth/login` y el webhook de pagos |
| Estados de orden | Siempre en código: `pendiente`, `ingresado`, `en_diagnostico`, `esperando_repuestos`, `listo`, `entregado`, `cancelado`. El frontend los traduce con `CODIGOS` de `services/ordenes.js` |
| Fechas | ISO 8601. Órdenes e historial sin zona (`"2026-09-02T10:15:00"`); turnos con zona. Filtros por rango con fecha simple: `?desde=2026-07-01&hasta=2026-09-30` (ambos inclusive) |
| Montos | Llegan como **string decimal** (`"185000.00"`), porque Pydantic serializa `Decimal` así. El frontend usa `Number()` como ya hace en `desdeApi` |
| Listas | Array plano, sin paginación |
| Errores | `{"detail": "mensaje", "code": 400}`. Validación: `422` con `{"detail": "Error de validación", "code": 422, "errores": [{"campo": "...", "mensaje": "..."}]}` |
| Códigos | `400` regla de negocio · `401` sin sesión · `403` rol sin permiso · `404` no existe **o no es tuyo** · `409` duplicado o conflicto · `422` validación |

> Para el cliente y el mecánico, un recurso que existe pero no les pertenece responde **404**, no 403, para no revelar que existe.

---

## 3. Decisiones tomadas

| # | Tema | Decisión |
|---|---|---|
| D1 | Login del cliente | Mismo `POST /auth/login`. El usuario tiene `rol: "cliente"` y `cliente_id`. El frontend redirige según el rol |
| D2 | Orden pagada | Campo calculado `pagada: true/false` en la orden (hay un pago aprobado). **No** se agrega un estado nuevo, así no cambian las transiciones |
| D3 | Imágenes | Se guardan en `backend/uploads/ordenes/<orden_id>/<uuid>.<ext>` y se sirven como estáticos en `/uploads/...`. La API devuelve la ruta relativa y el frontend la completa con `urlArchivo()` |
| D4 | Texto de cada etapa | El historial guarda **solo** el comentario que escribe el usuario. Las explicaciones fijas se exponen en `GET /ordenes/estados` |
| D5 | Marca y modelo del vehículo | Siguen siendo texto en `Vehiculo`. El catálogo solo sugiere, no hay FK |
| D6 | Trimestre | Formato `AAAA-QN`, por ejemplo `2026-Q3` |
| D7 | Orden "cerrada" en métricas | Estado `entregado`, contada por `fecha_entrega` dentro del rango |
| D8 | Turnos en el calendario | Se agrega `mecanico_id` opcional a `Turno`, porque hoy los turnos no tienen mecánico |
| D9 | Pagos en local | Mercado Pago necesita una URL pública para el webhook. En local se usa `POST /pagos/{id}/simular` (solo con `DEBUG=true`) |

---

## 4. Matriz de permisos

`A` administrador · `R` recepción · `M` mecánico · `C` cliente. "Propio" significa que el backend filtra solo lo que le corresponde.

| Recurso | A | R | M | C |
|---|---|---|---|---|
| Clientes, turnos, repuestos (lectura) | ✔ | ✔ | ✔ | ✘ |
| Vehículos (lectura) | ✔ | ✔ | Propio | ✘ |
| Órdenes (lectura y cambio de estado) | ✔ | ✔ | Propio | ✘ |
| Crear o eliminar órdenes | ✔ | ✔ | ✘ | ✘ |
| Imágenes de órdenes (subir) | ✔ | ✔ | Propio | ✘ |
| Catálogo y `GET /ordenes/estados` | ✔ | ✔ | ✔ | ✔ |
| Ingreso de stock | ✔ | ✔ | ✘ | ✘ |
| Métricas y finanzas | ✔ | ✘ | ✘ | ✘ |
| Horarios (cargar y editar) | ✔ | ✘ | ✘ | ✘ |
| Calendario del mecánico | ✔ | ✔ | Propio | ✘ |
| Usuarios | ✔ | ✘ | ✘ | ✘ |
| `/mis-vehiculos`, `/mis-ordenes`, pagar | ✘ | ✘ | ✘ | Propio |

> **Importante para el backend:** hoy muchos endpoints usan solo `CurrentUser`. Cuando exista el rol cliente, cualquier cliente logueado podría leer todos los datos del taller. Todos los routers internos tienen que pasar a una dependencia de personal, por ejemplo `PersonalUser = require_roles(administrador, recepcion, mecanico)`.

---

## 5. Contratos por área

### 5.1 Rol cliente y login — Antonio

**Cambios de modelo:** `RolUsuario` suma `cliente`. `Usuario` suma `cliente_id` (FK a `clientes.id`, única, nula). Es obligatoria cuando `rol = "cliente"` y nula para los demás roles. Va con migración Alembic.

**`POST /auth/login`**: el mismo de siempre. La respuesta suma `cliente_id` en `usuario`.

```json
{
  "access_token": "eyJhbGciOi...",
  "token_type": "bearer",
  "usuario": {
    "id": 5,
    "nombre": "Marina",
    "apellido": "Villagra",
    "email": "marina.villagra@gmail.com",
    "rol": "cliente",
    "cliente_id": 1,
    "activo": true,
    "creado_en": "2026-08-12T10:15:00",
    "actualizado_en": null
  }
}
```

Para el personal `cliente_id` es `null`. `GET /auth/me` devuelve el mismo objeto `usuario`.

**`POST /users`** (A): para dar de alta un cliente con acceso se manda `"rol": "cliente"` y `"cliente_id": 1`. Errores: `400` si falta `cliente_id` con rol cliente, `404` si el cliente no existe y `409` si ese cliente ya tiene usuario.

**Redirección después del login (frontend, Pablo):** `administrador` y `mecanico` van a `/ordenes`, `recepcion` va a `/inicio` y `cliente` va a `/portal`.

---

### 5.2 Permisos del mecánico — Antonio

No hay endpoints nuevos. Cambia lo que devuelven los existentes cuando el usuario es mecánico:

| Endpoint | Comportamiento para `M` |
|---|---|
| `GET /ordenes` | Solo órdenes con `mecanico_id` igual al suyo |
| `GET /ordenes/{id}` y `/historial`, `/detalles`, `/imagenes` | `404` si la orden no es suya |
| `PATCH /ordenes/{id}` | Solo sus órdenes. No puede reasignar `mecanico_id` |
| `GET /vehiculos` | `200` con los vehículos que tienen al menos una orden asignada a él. Hoy las lecturas de vehículos usan `CurrentUser` y devuelven **todo**; el 403 que menciona el plan se revisa en esa tarea |
| `GET /vehiculos/{id}` y `/vehiculos/{id}/ordenes` | `404` si el vehículo no tiene órdenes suyas. En `/ordenes` solo ve las suyas |

**Campos nuevos en `OrdenResponse`** (aditivos, no rompen nada). Sirven para la tarjeta de la orden y para resaltar el modelo del auto:

```json
{
  "id": 2,
  "codigo": "OT-1002",
  "estado": "en_diagnostico",
  "cliente_id": 1,
  "cliente_nombre": "Villagra, Marina",
  "vehiculo_id": 1,
  "vehiculo_patente": "AC482KL",
  "vehiculo_marca": "Volkswagen",
  "vehiculo_modelo": "Gol Trend",
  "creado_por_id": 2,
  "mecanico_id": 3,
  "mecanico_nombre": "Chávez, Luis",
  "descripcion_ingreso": "Revisión de tren delantero por ruido.",
  "diagnostico": null,
  "costo_estimado": "95000.00",
  "costo_final": null,
  "pagada": false,
  "fecha_ingreso": "2026-09-02T09:30:00",
  "fecha_estimada_entrega": "2026-09-05T18:00:00",
  "fecha_entrega": null
}
```

---

### 5.3 Descripción por etapa — Gabriel (PR #25)

**`PATCH /ordenes/{id}`**: cuando cambia `estado`, `comentario_cambio` es **obligatorio** y no puede estar vacío.

```json
{ "estado": "en_diagnostico", "comentario_cambio": "Se levantó el auto, hay juego en el extremo de dirección izquierdo." }
```

| Caso | Respuesta |
|---|---|
| Sin comentario o solo espacios | `422` `"El comentario es obligatorio al cambiar de estado"` |
| Transición no permitida | `400` `"Transicion invalida. No se puede pasar de 'ingresado' a 'entregado'"` |
| Estado desconocido | `422` |

El historial guarda **solo** el comentario (D4). `GET /ordenes/{id}/historial` no cambia:

```json
[
  { "id": 7, "orden_id": 2, "usuario_id": 2, "usuario_nombre": "Rueda, Sofía", "estado_anterior": null, "estado_nuevo": "pendiente", "comentario": "Orden creada", "fecha": "2026-09-02T09:30:00" },
  { "id": 8, "orden_id": 2, "usuario_id": 3, "usuario_nombre": "Chávez, Luis", "estado_anterior": "ingresado", "estado_nuevo": "en_diagnostico", "comentario": "Se levantó el auto, hay juego en el extremo de dirección izquierdo.", "fecha": "2026-09-02T11:05:00" }
]
```

**`GET /ordenes/estados`** (A R M C): explicación fija de cada etapa y a qué estados puede pasar. Tiene que declararse **antes** de `GET /ordenes/{orden_id}` en el router; si no, FastAPI intenta leer `"estados"` como id y responde 422. Los textos son los mismos que `DESCRIPCION_ESTADOS` del frontend (`juli/ram`).

```json
[
  { "codigo": "pendiente", "nombre": "Pendiente", "descripcion": "La orden está abierta pero el vehículo todavía no entró al taller.", "siguientes": ["ingresado", "cancelado"] },
  { "codigo": "ingresado", "nombre": "Ingresado", "descripcion": "El vehículo ya está en el taller y espera que lo revise un mecánico.", "siguientes": ["en_diagnostico", "cancelado"] },
  { "codigo": "en_diagnostico", "nombre": "En diagnóstico", "descripcion": "El mecánico está revisando el vehículo para encontrar la falla y armar el presupuesto.", "siguientes": ["esperando_repuestos", "listo", "cancelado"] },
  { "codigo": "esperando_repuestos", "nombre": "Esperando repuestos", "descripcion": "El trabajo está frenado hasta que lleguen los repuestos pedidos.", "siguientes": ["listo", "cancelado"] },
  { "codigo": "listo", "nombre": "Listo", "descripcion": "El trabajo terminó y el vehículo está listo para que lo retiren.", "siguientes": ["entregado"] },
  { "codigo": "entregado", "nombre": "Entregado", "descripcion": "El cliente retiró el vehículo. La orden queda cerrada.", "siguientes": [] },
  { "codigo": "cancelado", "nombre": "Cancelado", "descripcion": "La orden se canceló y no se va a hacer el trabajo.", "siguientes": [] }
]
```

---

### 5.4 Imágenes de las órdenes — Gabriel

Tabla `ImagenOrden`: `id`, `orden_id`, `etapa`, `ruta`, `usuario_id`, `fecha`. El formato coincide con lo que ya implementó Julieta en `ordenesService.imagenes / subirImagen / quitarImagen`.

**`POST /ordenes/{id}/imagenes`** (A R, M propio) · `multipart/form-data`

| Campo | Tipo | Obligatorio | Nota |
|---|---|---|---|
| `archivo` | archivo | Sí | `image/jpeg`, `image/png` o `image/webp`, hasta 5 MB |
| `etapa` | texto | No | Código de estado. Si no viene, se usa el estado actual de la orden |

Respuesta `201`:

```json
{
  "id": 12,
  "orden_id": 2,
  "etapa": "en_diagnostico",
  "url": "/uploads/ordenes/2/5f3c9a1e8b2d4c7f.jpg",
  "usuario_id": 3,
  "usuario_nombre": "Chávez, Luis",
  "fecha": "2026-09-02T11:10:00"
}
```

Errores: `400` si el tipo de archivo no está permitido, `413` si pesa más de 5 MB y `404` si la orden no existe o no es del mecánico.

**`GET /ordenes/{id}/imagenes`** (A R, M propio): array del mismo objeto, ordenado por `fecha` ascendente.

**`DELETE /ordenes/{id}/imagenes/{imagen_id}`** (A, o el usuario que la subió): `{"detail": "Imagen eliminada"}`. Borra también el archivo.

**Servido:** `app.mount("/uploads", StaticFiles(directory="uploads"))` en `main.py`. La carpeta `backend/uploads/` va al `.gitignore`. Los nombres de archivo son UUID para que no se puedan adivinar.

---

### 5.5 Catálogo y búsquedas — Gabriel (PR #25)

**`GET /catalogo/marcas?q=vol`** (A R M C): solo las activas, ordenadas por nombre. `q` busca coincidencia parcial sin distinguir mayúsculas.

```json
[ { "id": 14, "nombre": "Volkswagen", "activo": true }, { "id": 15, "nombre": "Volvo", "activo": true } ]
```

**`GET /catalogo/modelos?marca_id=14&q=go`**: los dos parámetros son opcionales.

```json
[ { "id": 120, "marca_id": 14, "nombre": "Gol", "activo": true }, { "id": 121, "marca_id": 14, "nombre": "Gol Trend", "activo": true } ]
```

- El filtro es `marca_id`, no `marca` como decía el plan.
- `modelos` necesita una restricción única en (`marca_id`, `nombre`).
- Falta la migración Alembic y el seed con las marcas y modelos comunes en Argentina.

**Búsqueda `?q=` en listados existentes** (mismo formato de respuesta que hoy):

| Endpoint | Busca en | Estado |
|---|---|---|
| `GET /clientes?q=` | nombre, apellido, dni | Ya existe |
| `GET /vehiculos?q=` | patente, marca, modelo | Falta |
| `GET /repuestos?q=` | código, nombre | Falta |

Para el Autocomplete conviene que el frontend espere unos 300 ms entre teclas y busque recién desde 2 caracteres.

---

### 5.6 Inventario: movimientos de stock — Gabriel

**`POST /ordenes/{id}/detalles`** con `repuesto_id`: ahora descuenta `cantidad` del stock del repuesto. Sin stock suficiente:

```json
{ "detail": "Stock insuficiente: quedan 2 unidades de Pastillas de freno delanteras", "code": 400 }
```

**`DELETE /ordenes/{id}/detalles/{detalle_id}`**: si la línea tenía repuesto, devuelve la cantidad al stock.

**`POST /repuestos/{id}/ingresos`** (A R): suma stock.

```json
{ "cantidad": 10, "nota": "Compra a proveedor Lubricentro Norte" }
```

Responde `200` con el `RepuestoResponse` actualizado (con `stock_bajo` recalculado). `cantidad` tiene que ser mayor o igual a 1.

`GET /repuestos/stock-bajo` ya existe y no cambia.

---

### 5.7 Métricas de productividad por mecánico — Gabriel

**`GET /metricas/mecanicos?desde=2026-07-01&hasta=2026-09-30`** (A). Si no se mandan fechas, se toman los últimos 30 días. Devuelve todos los mecánicos activos, aunque tengan 0 órdenes.

```json
[
  { "mecanico_id": 3, "nombre": "Chávez, Luis", "ordenes_cerradas": 14, "ordenes_en_curso": 3, "tiempo_promedio_horas": 52.5, "facturado": "2350000.00" },
  { "mecanico_id": 4, "nombre": "Ibarra, Diego", "ordenes_cerradas": 9, "ordenes_en_curso": 2, "tiempo_promedio_horas": 71.0, "facturado": "1480000.00" }
]
```

| Campo | Cálculo |
|---|---|
| `ordenes_cerradas` | Órdenes `entregado` con `fecha_entrega` dentro del rango (D7) |
| `ordenes_en_curso` | Órdenes asignadas hoy que no están `entregado` ni `cancelado` |
| `tiempo_promedio_horas` | Promedio de `fecha_entrega - fecha_ingreso` de las cerradas, en horas con 1 decimal. `null` si no hay cerradas |
| `facturado` | Suma de `costo_final` de las cerradas |

---

### 5.8 Finanzas, balances y mejor mecánico — Gabriel

**`GET /metricas/finanzas?desde=2026-07-01&hasta=2026-09-30`** (A). Si no se mandan fechas, toma los últimos 6 meses: desde el día 1 de hace 5 meses hasta hoy. Si `desde` es posterior a `hasta`, responde `400`.

```json
{
  "desde": "2026-07-01",
  "hasta": "2026-09-30",
  "ingresos": "3830000.00",
  "cobrado_online": "1250000.00",
  "egresos_repuestos": "1415000.00",
  "balance": "2415000.00",
  "mensual": [
    { "mes": "2026-07", "ingresos": "1120000.00", "egresos": "410000.00", "balance": "710000.00" },
    { "mes": "2026-08", "ingresos": "1310000.00", "egresos": "505000.00", "balance": "805000.00" },
    { "mes": "2026-09", "ingresos": "1400000.00", "egresos": "500000.00", "balance": "900000.00" }
  ]
}
```

| Campo | Cálculo |
|---|---|
| `ingresos` | Suma de `costo_final` de las órdenes cerradas en el rango |
| `cobrado_online` | Suma de pagos `aprobado` en el rango. Es una parte de `ingresos`, no se suma aparte |
| `egresos_repuestos` | Suma de `cantidad × precio_unitario` de las líneas con repuesto de esas órdenes |
| `balance` | `ingresos - egresos_repuestos` |
| `mensual` | Lo mismo agrupado por mes de `fecha_entrega`. Incluye los meses sin movimiento, con `"0.00"` |

**`GET /metricas/mejor-mecanico?trimestre=2026-Q3`** (A). Si no se manda, toma el trimestre actual. Con un formato inválido responde `422`.

```json
{
  "trimestre": "2026-Q3",
  "desde": "2026-07-01",
  "hasta": "2026-09-30",
  "criterio": "Más órdenes cerradas; desempata mayor facturado y después menor tiempo promedio",
  "mecanico": { "mecanico_id": 3, "nombre": "Chávez, Luis", "ordenes_cerradas": 14, "tiempo_promedio_horas": 52.5, "facturado": "2350000.00" }
}
```

Si nadie cerró órdenes en el trimestre, `"mecanico": null`.

---

### 5.9 Horarios y calendario del mecánico — Gabriel

Tabla `HorarioMecanico`: `id`, `mecanico_id`, `dia_semana` (0 = lunes … 6 = domingo), `hora_desde`, `hora_hasta` (`"HH:MM"`). Un mismo día puede tener varias franjas, por ejemplo mañana y tarde.

| Método y ruta | Roles | Cuerpo y respuesta |
|---|---|---|
| `GET /mecanicos/{id}/horarios` | A R, M propio | Array de horarios |
| `POST /mecanicos/{id}/horarios` | A | `{ "dia_semana": 0, "hora_desde": "08:00", "hora_hasta": "12:00" }` → `201` horario |
| `PUT /mecanicos/{id}/horarios/{horario_id}` | A | Mismo cuerpo → horario |
| `DELETE /mecanicos/{id}/horarios/{horario_id}` | A | `{"detail": "Horario eliminado"}` |

Errores: `400` si `hora_desde >= hora_hasta` o el usuario no es mecánico, y `409` si la franja se superpone con otra del mismo día.

```json
{ "id": 4, "mecanico_id": 3, "dia_semana": 0, "hora_desde": "08:00", "hora_hasta": "12:00" }
```

**Turno con mecánico (D8):** `Turno` suma `mecanico_id` opcional. `POST /turnos` y `PUT /turnos/{id}` lo aceptan y `TurnoResponse` lo devuelve.

**`GET /mecanicos/{id}/calendario?desde=2026-10-26&hasta=2026-11-01`** (A R, M propio). Si no se mandan fechas, toma la semana actual (lunes a domingo).

```json
{
  "mecanico": { "id": 3, "nombre": "Luis", "apellido": "Chávez" },
  "desde": "2026-10-26",
  "hasta": "2026-11-01",
  "horarios": [
    { "id": 4, "mecanico_id": 3, "dia_semana": 0, "hora_desde": "08:00", "hora_hasta": "12:00" },
    { "id": 5, "mecanico_id": 3, "dia_semana": 0, "hora_desde": "14:00", "hora_hasta": "18:00" }
  ],
  "turnos": [
    { "id": 1, "cliente_id": 1, "vehiculo_id": 1, "mecanico_id": 3, "fecha_hora": "2026-10-27T09:00:00-03:00", "estado": "confirmado", "motivo": "Revisión de tren delantero", "notas": null, "registrado_por_id": 2 }
  ],
  "ordenes": [
    { "id": 2, "codigo": "OT-1002", "estado": "en_diagnostico", "vehiculo_patente": "AC482KL", "vehiculo_marca": "Volkswagen", "vehiculo_modelo": "Gol Trend", "fecha_ingreso": "2026-10-26T09:30:00", "fecha_estimada_entrega": "2026-10-29T18:00:00" }
  ]
}
```

`ordenes` trae las órdenes del mecánico abiertas en el rango, es decir, las que no están `entregado` ni `cancelado`, o que se entregaron dentro del rango.

---

### 5.10 Portal del cliente — Antonio

Todo filtrado por el `cliente_id` del usuario logueado. Si la orden o el vehículo es de otro cliente, responde `404`.

**`GET /mis-vehiculos`** (C)

```json
[
  {
    "id": 1, "cliente_id": 1, "patente": "AC482KL", "marca": "Volkswagen", "modelo": "Gol Trend", "anio": 2017, "color": "Gris", "vin": null, "observaciones": null,
    "orden_activa": { "id": 2, "codigo": "OT-1002", "estado": "en_diagnostico", "fecha_ingreso": "2026-09-02T09:30:00" },
    "ordenes_total": 2
  }
]
```

`orden_activa` es la última orden que no está `entregado` ni `cancelado`, o `null`.

**`GET /mis-ordenes?vehiculo_id=1`** (C): `vehiculo_id` es opcional. Lista ordenada por `fecha_ingreso` descendente.

```json
[
  { "id": 2, "codigo": "OT-1002", "estado": "en_diagnostico", "vehiculo_id": 1, "vehiculo_patente": "AC482KL", "vehiculo_marca": "Volkswagen", "vehiculo_modelo": "Gol Trend", "fecha_ingreso": "2026-09-02T09:30:00", "fecha_estimada_entrega": "2026-09-05T18:00:00", "costo_final": null, "pagada": false },
  { "id": 1, "codigo": "OT-1001", "estado": "entregado", "vehiculo_id": 1, "vehiculo_patente": "AC482KL", "vehiculo_marca": "Volkswagen", "vehiculo_modelo": "Gol Trend", "fecha_ingreso": "2026-06-18T08:45:00", "fecha_estimada_entrega": null, "costo_final": "185000.00", "pagada": true }
]
```

**`GET /mis-ordenes/{id}`** (C): detalle completo para el seguimiento. `historial` e `imagenes` tienen **el mismo formato** que `/ordenes/{id}/historial` y `/ordenes/{id}/imagenes`, así se reusa `LineaDeTiempo` de Julieta tal cual.

```json
{
  "id": 2,
  "codigo": "OT-1002",
  "estado": "listo",
  "descripcion_ingreso": "Revisión de tren delantero por ruido.",
  "diagnostico": "Extremo de dirección izquierdo con juego. Se reemplazó.",
  "mecanico_nombre": "Chávez, Luis",
  "costo_estimado": "95000.00",
  "costo_final": "112000.00",
  "fecha_ingreso": "2026-09-02T09:30:00",
  "fecha_estimada_entrega": "2026-09-05T18:00:00",
  "fecha_entrega": null,
  "vehiculo": { "id": 1, "patente": "AC482KL", "marca": "Volkswagen", "modelo": "Gol Trend", "anio": 2017 },
  "etapa_actual": { "codigo": "listo", "nombre": "Listo", "descripcion": "El trabajo terminó y el vehículo está listo para que lo retiren." },
  "pasos": [
    { "codigo": "pendiente", "nombre": "Pendiente", "estado": "completado" },
    { "codigo": "ingresado", "nombre": "Ingresado", "estado": "completado" },
    { "codigo": "en_diagnostico", "nombre": "En diagnóstico", "estado": "completado" },
    { "codigo": "esperando_repuestos", "nombre": "Esperando repuestos", "estado": "omitido" },
    { "codigo": "listo", "nombre": "Listo", "estado": "actual" },
    { "codigo": "entregado", "nombre": "Entregado", "estado": "pendiente" }
  ],
  "historial": [
    { "id": 7, "orden_id": 2, "usuario_id": 2, "usuario_nombre": "Rueda, Sofía", "estado_anterior": null, "estado_nuevo": "pendiente", "comentario": "Orden creada", "fecha": "2026-09-02T09:30:00" },
    { "id": 8, "orden_id": 2, "usuario_id": 3, "usuario_nombre": "Chávez, Luis", "estado_anterior": "en_diagnostico", "estado_nuevo": "listo", "comentario": "Se cambió el extremo de dirección y se alineó.", "fecha": "2026-09-04T16:20:00" }
  ],
  "imagenes": [
    { "id": 12, "orden_id": 2, "etapa": "en_diagnostico", "url": "/uploads/ordenes/2/5f3c9a1e8b2d4c7f.jpg", "usuario_id": 3, "usuario_nombre": "Chávez, Luis", "fecha": "2026-09-02T11:10:00" }
  ],
  "detalles": [
    { "id": 30, "orden_id": 2, "repuesto_id": 8, "repuesto_nombre": "Extremo de dirección", "descripcion": "Extremo de dirección izquierdo", "cantidad": 1, "precio_unitario": "42000.00", "subtotal": "42000.00" }
  ],
  "pagada": false,
  "puede_pagar": true,
  "pago": null
}
```

| Campo | Regla |
|---|---|
| `pasos[].estado` | `completado`, `actual`, `pendiente` u `omitido` (si se salteó, como `esperando_repuestos`). Si la orden se canceló, los pasos que no llegó a hacer son `omitido` y se agrega `{ "codigo": "cancelado", "estado": "actual" }` al final |
| `puede_pagar` | `true` si el estado es `listo` o `entregado`, `costo_final > 0` y no está pagada |
| `pago` | Último pago de la orden, con el formato de 5.11, o `null` |

---

### 5.11 Pagos online (Mercado Pago sandbox) — Antonio

Tabla `Pago`: `id`, `orden_id`, `monto`, `estado` (`pendiente` · `aprobado` · `rechazado`), `preference_id`, `payment_id`, `creado_en`, `fecha_pago`.

Variables de entorno nuevas (en `.env`, **nunca** en el repo): `MP_ACCESS_TOKEN` (token de prueba), `FRONTEND_URL` y `BACKEND_PUBLIC_URL` (URL pública para el webhook, por ejemplo con ngrok).

**`POST /pagos/ordenes/{orden_id}`** (C propio, A): crea el pago `pendiente` y la preferencia en Mercado Pago. El monto lo toma el backend de `costo_final`; nunca se manda desde el frontend.

Respuesta `201`:

```json
{
  "pago_id": 9,
  "orden_id": 2,
  "monto": "112000.00",
  "estado": "pendiente",
  "preference_id": "1234567890-abcd-4ef0-9a1b-112233445566",
  "url_pago": "https://sandbox.mercadopago.com.ar/checkout/v1/redirect?pref_id=1234567890-abcd-4ef0-9a1b-112233445566"
}
```

Errores: `400` si la orden no está `listo` ni `entregado` o no tiene `costo_final`, `409` si ya está pagada, `404` si no es del cliente, `502` si Mercado Pago no responde y `503` si no hay `MP_ACCESS_TOKEN` ni `DEBUG=true`.

Sin `MP_ACCESS_TOKEN` y con `DEBUG=true`, no se llama a Mercado Pago: `preference_id` es `null` y `url_pago` apunta a `{FRONTEND_URL}/portal/pago/pendiente?pago_id=9`. Desde ahí se usa `POST /pagos/{pago_id}/simular`.

Si un pago se rechaza, se puede volver a llamar a este endpoint: se crea un pago nuevo y el detalle de la orden muestra el último.

El frontend redirige a `url_pago`. Mercado Pago vuelve a:

| Resultado | URL del frontend |
|---|---|
| Aprobado | `{FRONTEND_URL}/portal/pago/aprobado?pago_id=9` |
| Rechazado | `{FRONTEND_URL}/portal/pago/rechazado?pago_id=9` |
| Pendiente | `{FRONTEND_URL}/portal/pago/pendiente?pago_id=9` |

Al volver, el frontend confirma el resultado con `GET /pagos/{pago_id}` y no confía en los parámetros de la URL.

**`GET /pagos/{pago_id}`** (C propio, A)

```json
{ "id": 9, "orden_id": 2, "monto": "112000.00", "estado": "aprobado", "preference_id": "1234567890-abcd-4ef0-9a1b-112233445566", "payment_id": "1319283712", "creado_en": "2026-09-04T17:00:00", "fecha_pago": "2026-09-04T17:02:41" }
```

**`POST /pagos/webhook`** (sin token, lo llama Mercado Pago): recibe `{"type": "payment", "data": {"id": "1319283712"}}`. El backend **consulta el pago a la API de Mercado Pago**, no confía en el cuerpo, y actualiza el `Pago` usando `external_reference = pago_id`. También acepta el formato por query (`?type=payment&data.id=...` o `?topic=payment&id=...`). Responde `200` aunque la notificación no sea de un pago o la referencia no exista. Si no puede consultar a Mercado Pago responde `502`, para que Mercado Pago reintente. Un pago `aprobado` no vuelve atrás, y si el monto cobrado es menor al de la orden queda `rechazado`.

| Estado en Mercado Pago | Estado en Boxly |
|---|---|
| `approved` | `aprobado` (la orden pasa a `pagada: true`) |
| `rejected`, `cancelled` | `rechazado` |
| Otros | `pendiente` |

**`POST /pagos/{pago_id}/simular`** (A o C propio, solo con `DEBUG=true`): para probar en local sin webhook. Es el plan B del recorte n.º 1.

```json
{ "estado": "aprobado" }
```

Devuelve el pago actualizado.

---

## 6. Datos para los mocks (`frontend/src/mocks/db.js`)

Los mocks guardan los datos **con la forma que usa el frontend**, como hoy: estados con nombre (`"En diagnóstico"`). Los services traducen desde y hacia la API. Colecciones a sumar en `SEMILLA`:

```js
usuarios: [
  // ...los actuales
  { id: 5, nombre: 'Marina', apellido: 'Villagra', email: 'marina.villagra@gmail.com', rol: 'cliente', cliente_id: 1, activo: true, creado_en: '2026-08-12T10:15:00' },
],
marcas: [
  { id: 1, nombre: 'Volkswagen', activo: true },
  { id: 2, nombre: 'Renault', activo: true },
  { id: 3, nombre: 'Toyota', activo: true },
  { id: 4, nombre: 'Iveco', activo: true },
  { id: 5, nombre: 'Fiat', activo: true },
  { id: 6, nombre: 'Ford', activo: true },
  { id: 7, nombre: 'Chevrolet', activo: true },
  { id: 8, nombre: 'Peugeot', activo: true },
],
modelos: [
  { id: 1, marca_id: 1, nombre: 'Gol Trend', activo: true },
  { id: 2, marca_id: 1, nombre: 'Amarok', activo: true },
  { id: 3, marca_id: 2, nombre: 'Kangoo', activo: true },
  { id: 4, marca_id: 3, nombre: 'Hilux SRV', activo: true },
  { id: 5, marca_id: 4, nombre: 'Daily 35', activo: true },
  { id: 6, marca_id: 5, nombre: 'Cronos', activo: true },
],
imagenes_orden: [], // ya existe en juli/ram; en mock la url es un data: URL
pagos: [
  { id: 1, orden_id: 1, monto: 185000, estado: 'aprobado', preference_id: 'mock-pref-1', payment_id: 'mock-pay-1', creado_en: '2026-06-20T10:00:00', fecha_pago: '2026-06-20T10:02:00' },
],
horarios_mecanicos: [
  { id: 1, mecanico_id: 3, dia_semana: 0, hora_desde: '08:00', hora_hasta: '12:00' },
  { id: 2, mecanico_id: 3, dia_semana: 0, hora_desde: '14:00', hora_hasta: '18:00' },
  { id: 3, mecanico_id: 3, dia_semana: 2, hora_desde: '08:00', hora_hasta: '16:00' },
],
```

En mock:
- **Pago:** `crear` devuelve una `url_pago` interna, por ejemplo `/portal/pago/aprobado?pago_id=N`, y marca el pago como `aprobado`, así se puede probar el flujo completo sin Mercado Pago.
- **Métricas y finanzas:** se pueden calcular a partir de `ordenes` y `pagos` del mock, o devolver directamente los JSON de ejemplo de 5.7 y 5.8.
- **Login de cliente:** `loginMock` en `services/auth.js` tiene que devolver el usuario con el `rol` y el `cliente_id` correspondientes al email, en vez de siempre el administrador.

---

## 7. Checklist del día 5 (integración)

- [ ] `alembic upgrade head` crea todas las tablas nuevas: `marcas`, `modelos`, `imagenes_orden`, `pagos`, `horarios_mecanico`, y `usuarios.cliente_id` y `turnos.mecanico_id`.
- [ ] `scripts/seed_demo.py` carga clientes con usuario, pagos, horarios, imágenes y órdenes repartidas en el trimestre.
- [ ] Frontend con `VITE_USAR_MOCK=false` y sin errores en consola.
- [ ] Un cliente no puede leer `/clientes`, `/ordenes` ni `/vehiculos` (403).
- [ ] Un mecánico no ve órdenes ni vehículos de otro mecánico (404).
- [ ] Cambio de estado sin comentario devuelve 422 y con comentario guarda solo el comentario.
- [ ] Flujos: admin crea la orden con sugerencias → mecánico avanza la etapa con descripción y foto → cliente ve la línea de tiempo y paga en sandbox (o simulado) → el dashboard muestra los datos.
