# Landing pública de Boxly: contrato

La landing es la cara de Boxly para los talleres que todavía no son clientes. Se ve en
`/` cuando nadie inició sesión (con sesión, `/` sigue mandando a cada uno a su inicio).
También en `/boxly` siempre, para poder mostrarla estando logueado.

## Reglas de contenido (obligatorias)

- **No inventar.** Solo funciones que Boxly tiene de verdad (mirá las páginas y los
  contratos `docs/Plataforma.md`, `docs/Suscripciones.md` y la oferta vigente en
  `docs/Oferta.md`). Nada de "integración con
  AFIP", "app móvil nativa", "WhatsApp" ni nada que no exista.
- **Sin testimonios, logos de clientes, cifras de uso ni reseñas falsas.** Si una sección
  así haría falta, no va.
- Precios: salen de `GET /api/v1/publico/planes` (los edita el superadmin). Si la API no
  responde, la sección muestra los planes sin precio y "Consultanos".
- Castellano rioplatense, directo, para dueños de taller. Frases cortas.
- Lo legal (privacidad) dice lo que el sistema hace: el taller es dueño de sus datos,
  Boxly no los ve salvo acceso de soporte que el taller otorga, temporal, de solo
  lectura y con datos enmascarados; el taller descarga su respaldo cuando quiere.

## Diseño

- Usa los tokens existentes (`src/index.css`: `--c-amber`, `--c-ink`, `--c-g*`, tema
  claro y oscuro) y el `Logo` de `components/ui/Logo.jsx`. Identidad: taller mecánico
  prolijo, dorado sobre grafito; ilustraciones SVG propias (hay en
  `components/ilustraciones/`). Sin imágenes externas ni fuentes nuevas.
- Mobile first: se ve perfecta a 360 px, sin scroll horizontal. Accesible: contraste AA,
  foco visible, un solo `h1`, landmarks (`header`, `main`, `footer`), `prefers-reduced-motion`.
- Estilos de la landing en `src/styles/landing.css` (lo crea L1) y clases Tailwind.

## Estructura (`src/pages/Landing.jsx`, ya armada; cada sección es un componente)

| Orden | id | Componente | Tarea |
| --- | --- | --- | --- |
| 1 | — | `components/landing/Encabezado.jsx` (nav fija con anclas, "Ingresar" → `/login`, "Pedí una demo" → `#contacto`, menú móvil) | L1 |
| 2 | `inicio` | `components/landing/Hero.jsx` | L1 |
| 3 | `funciones` | `components/landing/Funciones.jsx` (por rol: recepción, mecánico, administrador, cliente) | L2 |
| 4 | `como-funciona` | `components/landing/ComoFunciona.jsx` (del turno a la entrega, pasos reales) | L2 |
| 5 | `producto` | `components/landing/VistaPrevia.jsx` (maqueta en HTML/CSS de pantallas reales, no capturas) | L2 |
| 6 | `seguridad` | `components/landing/Confianza.jsx` (privacidad, soporte con permiso, respaldo, aislamiento entre talleres) | L3 |
| 7 | `planes` | `components/landing/Planes.jsx` | L3 |
| 8 | `preguntas` | `components/landing/Preguntas.jsx` (acordeón accesible) | L3 |
| 9 | `contacto` | `components/landing/Contacto.jsx` (formulario de demo) | L4 |
| 10 | — | `components/landing/Pie.jsx` (links a secciones, `/privacidad`, `/login`) | L1 |

Página pública `/privacidad` (`src/pages/Privacidad.jsx`, L3): política de privacidad
resumida y marcada como **borrador a revisar por un abogado**.

## Backend público (L5)

| Método | Ruta | Detalle |
| --- | --- | --- |
| GET | `/api/v1/publico/planes` | sin auth; planes activos `{codigo, nombre, precio_mensual, max_personal}` ordenados por precio |
| POST | `/api/v1/publico/contacto` | sin auth; `{nombre (2-100), taller (2-120), email, telefono? (6-30), ciudad? (≤80), mensaje? (≤1000), sitio_web (honeypot: si viene con algo → 201 sin guardar)}` → `201 {ok: true}`; límite 5 por IP por hora → 429 `"Recibimos varias solicitudes, probá más tarde"` |
| GET | `/api/v1/plataforma/solicitudes` | superadmin; `?estado=` ; lista paginada con `X-Total-Count` |
| PATCH | `/api/v1/plataforma/solicitudes/{id}` | superadmin; `{estado: nueva|contactada|convertida|descartada, nota?}` |

Tabla `solicitudes_contacto`: id, nombre, taller, email, telefono, ciudad, mensaje,
estado (default `nueva`), nota, ip (para el límite; se puede borrar a los 90 días),
creado_en. Es dato de la plataforma (prospectos de Boxly), no de ningún taller.

Frontend del superadmin (L4): `/plataforma/solicitudes` (ya en el menú) lista las
solicitudes con filtro por estado y cambio de estado con nota; desde una solicitud,
botón "Crear taller" que abre el alta de taller existente con el nombre precargado
(si el alta acepta `?nombre=`; si no, solo link a `/plataforma`).
