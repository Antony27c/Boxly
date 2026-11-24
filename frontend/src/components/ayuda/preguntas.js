// Categorías de la ayuda, con el ícono que las representa en los filtros.
export const CATEGORIAS = [
  { id: 'primeros-pasos', texto: 'Primeros pasos', icono: 'info' },
  { id: 'recepcion', texto: 'Recepción y clientes', icono: 'clientes' },
  { id: 'ordenes', texto: 'Órdenes y etapas', icono: 'ordenes' },
  { id: 'mecanicos', texto: 'Mecánicos', icono: 'usuarios' },
  { id: 'cobros', texto: 'Cobros y pagos', icono: 'dinero' },
  { id: 'turnos', texto: 'Turnos y horarios', icono: 'turnos' },
  { id: 'inventario', texto: 'Inventario', icono: 'inventario' },
  { id: 'cuenta', texto: 'Cuenta y configuración', icono: 'ajustes' },
  { id: 'portal', texto: 'Portal del cliente', icono: 'portal' },
]

// Preguntas frecuentes. Cada una:
//   id        → identificador estable (se usa en ?p=<id> para compartir el enlace)
//   categoria → id de CATEGORIAS
//   roles     → opcional: ['mostrador' | 'mecanico' | 'admin' | 'cliente'];
//               sin roles es para todos. Un administrador también "es" mostrador
//               (puede hacer todo lo del mostrador), igual que en navegacion.js.
//   pregunta  → el texto de la pregunta
//   respuesta → lista de párrafos
//   enlace    → opcional { a, texto }: link "Ir a <texto>" dentro de la respuesta
export const PREGUNTAS = [
  // ---------- Primeros pasos ----------
  {
    id: 'taller-nuevo',
    categoria: 'primeros-pasos',
    pregunta: '¿Por dónde empiezo si el taller es nuevo?',
    respuesta: [
      'Si sos administrador, en la pantalla Hoy vas a ver la tarjeta "Primeros pasos del taller": es la lista de lo básico para configurar una sola vez — cargar los mecánicos, sus horarios, los repuestos que más se usan, un usuario de recepción, el primer cliente con su vehículo y la primera orden.',
      'Cada paso tiene su botón que te lleva directo a la pantalla correspondiente. Cuando la configuración está completa la tarjeta desaparece sola, y también la podés cerrar antes con "Ya lo configuré".',
      'No hay prueba abierta: el taller arranca con la demo de 14 días del plan Pro, que Boxly otorga después de aprobar la solicitud hecha desde la página de Boxly. El plan y los pagos se manejan en Suscripción (solo administrador).',
    ],
    enlace: { a: '/hoy', texto: 'Hoy' },
  },

  // ---------- Recepción y clientes ----------
  {
    id: 'recibir-sin-turno',
    categoria: 'recepcion',
    roles: ['mostrador'],
    pregunta: '¿Cómo recibo un auto que llega sin turno?',
    respuesta: [
      'Desde Órdenes tocá "Recibir un auto" (el mismo botón está en Hoy). Se abre el ingreso rápido: escribí la patente y el sistema busca el auto solo.',
      'Si la patente es nueva, Boxly te pide cargar el cliente —podés buscarlo por nombre o DNI, o tocar "Es un cliente nuevo"— y el vehículo (marca, modelo y año) en el mismo paso. No hace falta darlos de alta antes por separado.',
      'Después contás qué trabajo hay que hacerle (podés usar las sugerencias: Service, Frenos, etc.), elegís mecánico y entrega estimada si querés, y tocás "Recibir auto". La orden queda en "Ingresado".',
    ],
    enlace: { a: '/ordenes', texto: 'Órdenes' },
  },
  {
    id: 'recibir-con-turno',
    categoria: 'recepcion',
    roles: ['mostrador'],
    pregunta: '¿Cómo recibo un auto que tenía turno?',
    respuesta: [
      'En Turnos o en Hoy, la tarjeta del turno tiene el botón "Recibir auto" (aparece en los turnos de hoy o anteriores que todavía no se atendieron).',
      'Se abre el mismo formulario de ingreso con los datos ya cargados: el cliente, el vehículo y el servicio del turno. Al confirmar "Recibir auto", el auto queda ingresado en el taller y el turno pasa solo a "En el taller".',
    ],
    enlace: { a: '/turnos', texto: 'Turnos' },
  },
  {
    id: 'cliente-nuevo',
    categoria: 'recepcion',
    roles: ['mostrador'],
    pregunta: '¿Cómo cargo un cliente nuevo?',
    respuesta: [
      'En Clientes tocá "Nuevo cliente": se abre un asistente de tres pasos. Primero los datos del cliente (nombre, apellido, DNI y teléfono; el correo es opcional pero hace falta para invitarlo al portal).',
      'Segundo, su vehículo: patente, marca, modelo y año. Si el cliente todavía no trajo el auto, podés saltear este paso con "Lo cargo después".',
      'Si el DNI o el teléfono ya existen en el sistema, Boxly avisa "Ya existe…" y te deja usar ese cliente en vez de cargarlo dos veces.',
      'En el tercer paso elegís qué sigue: "Recibir el auto ahora", "Darle un turno" o "Invitarlo al portal".',
    ],
    enlace: { a: '/clientes', texto: 'Clientes' },
  },
  {
    id: 'buscar-contactos',
    categoria: 'recepcion',
    roles: ['mostrador'],
    pregunta: '¿Cómo busco un cliente o un vehículo?',
    respuesta: [
      'En Clientes hay un buscador por nombre, DNI, teléfono o correo. Con la búsqueda activa revisa todo el listado, no solo la página visible.',
      'En Vehículos buscás por patente o modelo y podés filtrar por cliente con el desplegable. Cada tarjeta tiene "Ver ficha" para ver toda la información y el historial de reparaciones.',
    ],
    enlace: { a: '/vehiculos', texto: 'Vehículos' },
  },
  {
    id: 'editar-borrar-cliente',
    categoria: 'recepcion',
    roles: ['mostrador'],
    pregunta: '¿Cómo edito o elimino un cliente?',
    respuesta: [
      'En la lista de Clientes cada fila tiene "Editar" —abre el formulario con los datos cargados— y "Eliminar", que pide confirmación. Ojo: eliminar un cliente también borra sus turnos.',
      'Los vehículos se editan y eliminan igual desde la pantalla Vehículos (eliminar un vehículo también borra sus turnos).',
    ],
    enlace: { a: '/clientes', texto: 'Clientes' },
  },
  {
    id: 'invitar-portal',
    categoria: 'recepcion',
    roles: ['mostrador'],
    pregunta: '¿Cómo le doy acceso al portal al cliente?',
    respuesta: [
      'El cliente necesita un correo cargado. En el último paso del alta aparece "Invitarlo al portal"; si quedó pendiente, en Clientes está el botón "Reenviar correo de verificación".',
      'Le llega un correo con un enlace: el cliente revisa sus datos, elige su contraseña y ya puede entrar. En la lista, el badge "Con acceso al portal" confirma que la cuenta está activa (mientras tanto dice "Verificación pendiente").',
    ],
    enlace: { a: '/clientes', texto: 'Clientes' },
  },
  {
    id: 'ficha-vehiculo',
    categoria: 'recepcion',
    roles: ['mostrador', 'mecanico'],
    pregunta: '¿Dónde veo la ficha y el historial de un vehículo?',
    respuesta: [
      'En Vehículos, el botón "Ver ficha" de cada tarjeta muestra patente, marca, modelo, año, color, VIN, observaciones y quién es el titular.',
      'Más abajo está el "Historial de reparaciones": las órdenes de ese auto con su fecha, etapa y total.',
    ],
    enlace: { a: '/vehiculos', texto: 'Vehículos' },
  },

  // ---------- Órdenes y etapas ----------
  {
    id: 'etapas',
    categoria: 'ordenes',
    roles: ['mostrador', 'mecanico'],
    pregunta: '¿Qué significa cada etapa de una orden y quién la mueve?',
    respuesta: [
      'Por ingresar: el trabajo está anotado pero el auto todavía no entró. Lo pasa a Ingresado recepción al recibir el vehículo.',
      'Ingresado: el auto ya está en el taller. Recepción le asigna mecánico y el mecánico arranca con "Empezar diagnóstico".',
      'En diagnóstico: el mecánico revisa la falla y carga los trabajos del vehículo (los precios los cotiza recepción); puede pasar a "Esperando repuestos" si falta algo.',
      'Esperando repuestos: el trabajo está frenado hasta que llegue el repuesto; el mecánico lo marca "Listo" cuando retoma.',
      'Listo: el trabajo terminó. Recepción emite el cobro, el administrador lo aprueba y recepción entrega el auto.',
      'Entregado: el cliente retiró el vehículo; la orden queda cerrada. Cancelado: la orden se anuló y no se hace el trabajo.',
    ],
    enlace: { a: '/ordenes', texto: 'Órdenes' },
  },
  {
    id: 'comentario-fotos',
    categoria: 'ordenes',
    roles: ['mostrador', 'mecanico'],
    pregunta: '¿Por qué tengo que escribir un comentario al cambiar de etapa? ¿Puedo subir fotos?',
    respuesta: [
      'El comentario (mínimo 5 caracteres) queda en el historial de la orden y el cliente lo ve en su portal como seguimiento: es la forma de contar qué se hizo en cada etapa. Hay "Comentarios rápidos" para tocar y usar sin escribir todo.',
      'Sí, en el mismo paso podés adjuntar fotos de la etapa (JPG, PNG o WEBP, hasta 5 MB cada una). También desde la pestaña "Fotos" de la orden, con "Subir fotos" y el selector de etapa.',
    ],
    enlace: { a: '/ordenes', texto: 'Órdenes' },
  },
  {
    id: 'asignar-mecanico',
    categoria: 'ordenes',
    roles: ['mostrador'],
    pregunta: '¿Cómo asigno un mecánico? ¿Cómo sé si una orden no tiene mecánico?',
    respuesta: [
      'Cuando una orden está Ingresada y nadie la tomó, la tarjeta muestra el botón "Asignar mecánico"; desde la página de la orden también está en el menú "Más acciones". Se abre un selector con los mecánicos activos: elegís y tocás "Asignar".',
      'Para encontrarlas rápido: en Hoy hay un bloque "Sin mecánico asignado", en el tablero el filtro "Sin asignar" y en cada tarjeta dice "Mecánico: Sin asignar".',
    ],
    enlace: { a: '/ordenes', texto: 'Órdenes' },
  },
  {
    id: 'trabajos-repuestos',
    categoria: 'ordenes',
    roles: ['mostrador', 'mecanico'],
    pregunta: '¿Cómo cargo los trabajos y repuestos de una orden? ¿Qué pasa con el stock?',
    respuesta: [
      'En la página de la orden, pestaña "Trabajo": elegís el "Tipo de línea" (Trabajo / mano de obra o Repuesto del inventario), completás la descripción o buscás el repuesto, la cantidad y tocás "Agregar línea". Recepción y administración también cargan el precio (en los repuestos se completa solo con el del inventario, pero se puede cambiar).',
      'El mecánico no carga precios: el repuesto toma el precio del inventario y la mano de obra queda "A cotizar" hasta que recepción la cotiza con el botón "Cotizar" de la misma línea.',
      'Cada repuesto que se usa descuenta stock del inventario solo. Las líneas se pueden quitar con "Quitar" mientras la orden no esté Entregada ni Cancelada, y el cliente las ve en su portal dentro de "Trabajos y repuestos".',
    ],
    enlace: { a: '/ordenes', texto: 'Órdenes' },
  },
  {
    id: 'lineas-a-cotizar',
    categoria: 'ordenes',
    roles: ['mostrador', 'mecanico'],
    pregunta: '¿Qué es una línea "a cotizar" y quién le pone precio?',
    respuesta: [
      'Es una línea de la orden sin precio: cuando el mecánico carga mano de obra queda "a cotizar" (el repuesto, en cambio, toma el precio del inventario solo).',
      'Recepción y administración le ponen precio con el botón "Cotizar" de la misma línea, en la pestaña "Trabajo" de la orden.',
      'Mientras queden líneas a cotizar el total es parcial ("Total parcial · N a cotizar") y el cobro no se puede emitir; en el portal del cliente esas líneas se ven como "A cotizar", nunca como $0.',
    ],
    enlace: { a: '/ordenes', texto: 'Órdenes' },
  },
  {
    id: 'editar-orden',
    categoria: 'ordenes',
    roles: ['mostrador'],
    pregunta: '¿Cómo corrijo los datos de una orden?',
    respuesta: [
      'Desde el menú "⋯" de la tarjeta en el tablero, "Editar" abre el formulario con el presupuesto estimado, la descripción del trabajo y el mecánico asignado. El vehículo de la orden no se cambia desde ahí.',
      'El estado no se edita a mano: se cambia con "Cambiar etapa" para que quede el comentario y el historial.',
    ],
    enlace: { a: '/ordenes', texto: 'Órdenes' },
  },
  {
    id: 'eliminar-orden',
    categoria: 'ordenes',
    roles: ['mostrador'],
    pregunta: '¿Cómo elimino o cancelo una orden?',
    respuesta: [
      'Solo se eliminan las órdenes que todavía están "Por ingresar": menú "⋯" de la tarjeta → "Eliminar" y confirmás. Sirve para borrar un alta hecha por error.',
      'Una orden que ya ingresó no se borra: se cancela con "Cambiar etapa" → "Cancelado", con su comentario. Cancelada y Entregada son etapas finales: no se reabren.',
    ],
    enlace: { a: '/ordenes', texto: 'Órdenes' },
  },
  {
    id: 'que-es-hoy',
    categoria: 'ordenes',
    roles: ['mostrador', 'mecanico'],
    pregunta: '¿Qué es la pantalla Hoy?',
    respuesta: [
      'Para recepción y administración es el resumen del día: los turnos de hoy, los autos listos para entregar, los que no tienen mecánico asignado, los cobros por aprobar (solo administrador) y los repuestos con stock bajo. Desde acá también están los botones "Recibir un auto" y "Cliente nuevo".',
      'Para el mecánico la misma pantalla es "Mi trabajo": solo ve sus órdenes abiertas, ordenadas por lo que hay que hacer primero, con el botón de la acción que le toca.',
    ],
    enlace: { a: '/hoy', texto: 'Hoy' },
  },
  {
    id: 'filtros-tablero',
    categoria: 'ordenes',
    roles: ['mostrador', 'mecanico'],
    pregunta: '¿Para qué sirven los filtros del tablero de órdenes?',
    respuesta: [
      'Los botones de arriba filtran las tarjetas: "Mías" (solo para el mecánico, sus órdenes), "Sin asignar", "Listas para entregar" (las que ya se pueden retirar) y "Cobro pendiente" (las que esperan aprobación de cobro).',
      '"Ver cerradas" muestra las órdenes Entregadas y Canceladas. El buscador filtra por patente, cliente, trabajo o mecánico, y en celular cada etapa es una pestaña.',
    ],
    enlace: { a: '/ordenes', texto: 'Órdenes' },
  },
  {
    id: 'boton-accion',
    categoria: 'ordenes',
    roles: ['mostrador', 'mecanico'],
    pregunta: '¿Qué es el botón que aparece en cada orden?',
    respuesta: [
      'Es la "acción principal": lo que te toca hacer ahora según la etapa de la orden y tu rol. Puede ser "Recibir auto", "Asignar mecánico", "Empezar diagnóstico", "Marcar listo", "Esperando repuestos", "Cargar trabajo", "Emitir cobro", "Revisar cobro", "Aprobar cobro" o "Entregar". El mecánico no ve acciones de cobro: eso lo maneja recepción.',
      'Tocar el botón abre la orden con ese paso ya iniciado; tocar el resto de la tarjeta abre la orden completa.',
    ],
    enlace: { a: '/ordenes', texto: 'Órdenes' },
  },

  // ---------- Mecánicos ----------
  {
    id: 'mi-trabajo',
    categoria: 'mecanicos',
    roles: ['mecanico', 'admin'],
    pregunta: '¿Qué es "Mi trabajo" para el mecánico?',
    respuesta: [
      'Es la pantalla Hoy vista por el mecánico: lista solo sus órdenes abiertas, ordenadas por prioridad (primero las que hay que cerrar: las listas sin cobro, después las que están en diagnóstico).',
      'Cada fila tiene el botón con la acción que le toca —"Empezar diagnóstico", "Marcar listo", "Esperando repuestos", "Cargar trabajo"— y tocarla abre la orden. No ve acciones de cobro: los precios y el cobro los maneja recepción. En el menú ve Hoy, Órdenes, Inventario y Horarios ("Mi horario").',
    ],
    enlace: { a: '/hoy', texto: 'Hoy' },
  },
  {
    id: 'dar-alta-mecanico',
    categoria: 'mecanicos',
    roles: ['admin'],
    pregunta: '¿Cómo doy de alta un mecánico?',
    respuesta: [
      'En Usuarios tocá "Nuevo usuario": nombre, apellido, correo, rol "Mecánico" y una contraseña (mínimo 8 caracteres, combinando letras y números). El mecánico entra con ese correo y ya ve sus órdenes en "Mi trabajo".',
      'Sin al menos un usuario con rol Mecánico no hay a quién asignar las órdenes ni cargar horarios: la pantalla Horarios lo avisa con "Sin mecánicos".',
    ],
    enlace: { a: '/usuarios', texto: 'Usuarios' },
  },

  // ---------- Cobros y pagos ----------
  {
    id: 'flujo-cobro',
    categoria: 'cobros',
    roles: ['mostrador', 'mecanico'],
    pregunta: '¿Cómo funciona el cobro de una orden?',
    respuesta: [
      'La pestaña "Cobro" de la orden muestra el estado y el monto. Recepción lo emite con "Emitir cobro" o "Enviar cobro al cliente"; si quedó pendiente, administración lo aprueba con "Aprobar cobro".',
      'El mecánico no propone ni emite cobros. Las líneas de trabajo que quedaron "A cotizar" las cotiza recepción con el botón "Cotizar" de la pestaña "Trabajo", y mientras haya alguna el cobro no se puede emitir.',
      'Cuando el cobro está aprobado, el cliente lo ve en su portal y paga online con Mercado Pago.',
    ],
    enlace: { a: '/ordenes', texto: 'Órdenes' },
  },
  {
    id: 'cliente-pago',
    categoria: 'cobros',
    roles: ['mostrador', 'mecanico'],
    pregunta: '¿Cómo sé si el cliente ya pagó?',
    respuesta: [
      'La orden muestra el badge "Pagada" y en la pestaña "Cobro" dice "El cliente ya pagó" con el monto.',
      'En el tablero, el filtro "Listas para entregar" junta las órdenes Listo con cobro aprobado o pagado —las que ya se pueden retirar— y en Hoy el bloque "Listos para entregar" muestra lo mismo.',
    ],
    enlace: { a: '/ordenes', texto: 'Órdenes' },
  },
  {
    id: 'entregar-auto',
    categoria: 'cobros',
    roles: ['mostrador'],
    pregunta: '¿Cómo entrego el auto?',
    respuesta: [
      'Cuando la orden está "Listo" y el cobro está aprobado o pagado, el botón de la tarjeta dice "Entregar" (también está en la página de la orden).',
      'Se abre el cambio de etapa: escribís el comentario —por ejemplo "Auto entregado al cliente."— y confirmás "Pasar a Entregado". La orden queda cerrada y ya no se puede editar.',
    ],
    enlace: { a: '/ordenes', texto: 'Órdenes' },
  },
  {
    id: 'avisar-cliente',
    categoria: 'cobros',
    roles: ['admin'],
    pregunta: '¿Cómo le aviso al cliente que su auto está listo?',
    respuesta: [
      'En la pestaña "Historial" de la orden, el administrador tiene el botón "Enviar aviso al cliente": le manda un email con el estado actual del trabajo. Ahí mismo se ve el registro de los avisos enviados y si alguno falló.',
      'Además, el cliente sigue el estado solo desde su portal: cada cambio de etapa con su comentario queda en el "Seguimiento" que él ve.',
    ],
    enlace: { a: '/ordenes', texto: 'Órdenes' },
  },
  {
    id: 'cambiar-monto',
    categoria: 'cobros',
    roles: ['mostrador', 'mecanico'],
    pregunta: '¿Y si hay que cambiar el monto del cobro?',
    respuesta: [
      'Lo corrige recepción desde la pestaña "Cobro" o el botón de la orden, guardando el "nuevo monto"; el mecánico no emite ni corrige cobros.',
      'Una vez que el cliente pagó, el monto queda cerrado y la orden solo falta entregarla.',
    ],
    enlace: { a: '/ordenes', texto: 'Órdenes' },
  },

  // ---------- Turnos y horarios ----------
  {
    id: 'agendar-turno',
    categoria: 'turnos',
    roles: ['mostrador'],
    pregunta: '¿Cómo agendo un turno?',
    respuesta: [
      'En Turnos tocá "Nuevo turno" —o "+ Agendar en este día" dentro de la semana— y completás: cliente, su vehículo, fecha, horario y servicio (hay sugerencias como "Service de 60.000 km" o escribís el tuyo).',
      'La agenda es de lunes a sábado: cada horario (cada 2 horas: 08, 10, 12, 14 y 16) admite un solo vehículo, así que los ocupados no se pueden elegir. El contador de arriba muestra cuántos horarios quedan libres en la semana.',
    ],
    enlace: { a: '/turnos', texto: 'Turnos' },
  },
  {
    id: 'estados-turno',
    categoria: 'turnos',
    roles: ['mostrador'],
    pregunta: '¿Qué estados tiene un turno?',
    respuesta: [
      'Pendiente y Confirmado: el turno está agendado esperando al cliente. "En el taller": el auto ya llegó y se recibió (pasa solo al hacer "Recibir auto"). Completado: el trabajo terminó. Cancelado: se anuló y el horario quedó libre.',
      'Desde la tarjeta del turno podés "Editar" (cambiar fecha, horario, servicio o estado) y "Cancelar".',
    ],
    enlace: { a: '/turnos', texto: 'Turnos' },
  },
  {
    id: 'cancelar-turno',
    categoria: 'turnos',
    roles: ['mostrador'],
    pregunta: '¿Cómo cancelo un turno?',
    respuesta: [
      'En la tarjeta del turno tocá "Cancelar" y confirmás en el cartel "Cancelar turno". El horario vuelve a quedar disponible para otro cliente.',
      'Si el cliente no vino pero querés registrar el trabajo igual, no hace falta turno: usá "Recibir un auto" desde Órdenes o Hoy.',
    ],
    enlace: { a: '/turnos', texto: 'Turnos' },
  },
  {
    id: 'no-puedo-agendar',
    categoria: 'turnos',
    roles: ['mostrador'],
    pregunta: '¿Por qué no puedo agendar un turno?',
    respuesta: [
      'Lo más común: todavía no hay clientes con vehículos cargados —la pantalla lo avisa y te ofrece "Cargar cliente y vehículo"—, la fecha es anterior a hoy o un domingo (el taller no atiende), o ese horario ya está ocupado ese día.',
      'También revisá que el cliente elegido tenga el vehículo cargado: el formulario solo muestra los vehículos de ese cliente.',
    ],
    enlace: { a: '/turnos', texto: 'Turnos' },
  },
  {
    id: 'horarios-mecanicos',
    categoria: 'turnos',
    roles: ['admin', 'mostrador'],
    pregunta: '¿Para qué sirven los horarios de los mecánicos y cómo los cargo?',
    respuesta: [
      'En Horarios elegís el mecánico y cargás sus franjas: qué días trabaja y de qué hora a qué hora, con "Agregar franja" o "+ Franja" en cada día.',
      'Sirven para organizar la semana: el calendario muestra por día las franjas, los turnos y las órdenes asignadas a ese mecánico. Ojo: sin franjas cargadas no se pueden dar turnos. El mecánico ve lo suyo en "Mi horario" y no puede editarlo.',
    ],
    enlace: { a: '/horarios', texto: 'Horarios' },
  },

  // ---------- Inventario ----------
  {
    id: 'repuesto-nuevo',
    categoria: 'inventario',
    roles: ['mostrador'],
    pregunta: '¿Cómo cargo un repuesto nuevo?',
    respuesta: [
      'En Inventario, "Nuevo repuesto": código (único, no se puede repetir), nombre, descripción, precio, stock actual y stock mínimo —el mínimo es el número que dispara el aviso de stock bajo—.',
      'Una vez cargado aparece al armar órdenes: al elegirlo como línea se descuenta stock solo y se usa su precio del inventario.',
    ],
    enlace: { a: '/inventario', texto: 'Inventario' },
  },
  {
    id: 'stock-bajo',
    categoria: 'inventario',
    roles: ['mostrador'],
    pregunta: '¿Qué es el "stock bajo" y cómo ingreso mercadería?',
    respuesta: [
      'Cuando un repuesto queda en su stock mínimo o por debajo, aparece el aviso en Inventario ("N repuestos están en el stock mínimo o por debajo", con "Ver cuáles") y en Hoy el bloque "Stock bajo". El tilde "Sólo stock bajo" filtra la lista.',
      'Para ingresar mercadería, cada repuesto tiene el botón "Ingresar stock": ponés la cantidad que entra (entera, mayor a 0) y se suma al stock actual.',
    ],
    enlace: { a: '/inventario', texto: 'Inventario' },
  },
  {
    id: 'desactivar-repuesto',
    categoria: 'inventario',
    roles: ['mostrador'],
    pregunta: '¿Cómo desactivo un repuesto que ya no se usa?',
    respuesta: [
      'En Inventario, el menú "⋯" de cada repuesto tiene "Desactivar" (pide confirmación). El repuesto queda inactivo: ya no aparece al armar órdenes ni descuenta stock.',
      'Para verlo tildá "Mostrar inactivos"; desde ahí lo podés "Activar" de nuevo o seguir editándolo con "Editar".',
    ],
    enlace: { a: '/inventario', texto: 'Inventario' },
  },

  // ---------- Cuenta y configuración ----------
  {
    id: 'dar-alta-usuarios',
    categoria: 'cuenta',
    roles: ['admin'],
    pregunta: '¿Cómo doy de alta usuarios del taller?',
    respuesta: [
      'En Usuarios, "Nuevo usuario": nombre, apellido, correo, rol (Administrador, Recepcionista o Mecánico) y contraseña. El usuario entra con su correo y esa contraseña.',
      'Desde la tarjeta de cada usuario podés "Editar" (cambiar datos, rol o poner "Nueva contraseña" —vacía la dejás como está), "Desactivar"/"Activar" y "Eliminar".',
    ],
    enlace: { a: '/usuarios', texto: 'Usuarios' },
  },
  {
    id: 'limite-personal',
    categoria: 'cuenta',
    roles: ['admin'],
    pregunta: '¿Cuántos usuarios puedo tener en el taller?',
    respuesta: [
      'Depende del plan de suscripción: cada plan define cuántos usuarios del personal entran (los clientes del portal no cuentan). Lo ves en Suscripción y también como contador en Usuarios ("N de M del personal en uso").',
      'Al llegar al límite el alta de personal queda bloqueada con el aviso "Llegaste al límite de tu plan" y el enlace "Ver planes"; para sumar más hay que pasar a un plan mayor. Ojo: reactivar un usuario también suma personal, así que con el plan lleno no se puede.',
    ],
    enlace: { a: '/suscripcion', texto: 'Suscripción' },
  },
  {
    id: 'que-puede-rol',
    categoria: 'cuenta',
    pregunta: '¿Qué puede hacer cada rol?',
    respuesta: [
      'Administrador: todo lo de recepción más la pantalla Usuarios, el Panel del taller (datos, auditoría y respaldo), la Suscripción y el acceso de soporte; además aprueba los cobros pendientes.',
      'Recepción: el mostrador —clientes, vehículos, turnos, órdenes, inventario, horarios, el Dashboard y la emisión de cobros—.',
      'Mecánico: "Mi trabajo" con sus órdenes asignadas, cambios de etapa con comentario y fotos, carga de trabajos y repuestos sin precio (la mano de obra queda a cotizar), e inventario y su horario en solo lectura.',
      'Cliente: solo su portal, para ver el estado de sus vehículos y pagar online.',
    ],
  },
  {
    id: 'acceso-soporte',
    categoria: 'cuenta',
    roles: ['admin'],
    pregunta: '¿Qué es el acceso de soporte de Boxly?',
    respuesta: [
      'Boxly, la empresa, no ve los datos de tus clientes. Si alguna vez necesita entrar a tu taller para ayudarte, vos se lo permitís desde Configuración → "Acceso de soporte": elegís la duración (1, 4, 24 o 72 horas) y un motivo.',
      'Mientras dura, Boxly entra en "modo soporte": una franja de aviso arriba de todo, solo lectura (no puede cambiar nada) y los datos personales enmascarados (por ejemplo el DNI se ve ****5678).',
      'Todo lo que consulta queda registrado: en la misma sección ves el historial de accesos y la actividad de soporte. Podés revocar el acceso cuando quieras y, si vence, se corta solo.',
    ],
    enlace: { a: '/configuracion', texto: 'Configuración' },
  },
  {
    id: 'suscripcion',
    categoria: 'cuenta',
    roles: ['admin'],
    pregunta: '¿Qué es la Suscripción y cómo cambio de plan?',
    respuesta: [
      'En Suscripción ves el estado del taller (al día, en gracia, solo lectura o suspendida), el plan actual con su precio por mes, cuántos del personal están en uso y el próximo cobro.',
      'Abajo comparás los planes y "Pasar a este plan" pide confirmación: el precio nuevo rige desde el próximo período. Si tu personal activo supera el límite del plan elegido, Boxly avisa y no deja hacer el cambio.',
      'El abono se paga con el débito automático de Mercado Pago: con un botón lo activás para que Mercado Pago debite el plan cada mes, o lo cancelás cuando quieras. Debajo está el historial de pagos. Si el débito automático todavía no está habilitado, escribinos.',
      'La cuenta de Mercado Pago con la que pagás el abono es aparte de la que usa tu taller para cobrarles a sus clientes: nunca se mezclan cuentas ni fondos.',
    ],
    enlace: { a: '/suscripcion', texto: 'Suscripción' },
  },
  {
    id: 'que-trae-cada-plan',
    categoria: 'cuenta',
    roles: ['admin'],
    pregunta: '¿Qué trae cada plan?',
    respuesta: [
      'Los planes no tienen las mismas funciones: Esencial cubre la gestión diaria y los superiores suman automatización. Además, cada plan define cuánto personal entra.',
      'Esencial: clientes, vehículos, turnos, órdenes con fotos e historial, inventario con alerta de stock mínimo, registro de cobros, métricas básicas, portal del cliente, avisos por email y WhatsApp manual (Boxly arma el mensaje y el taller lo manda desde su teléfono).',
      'Pro: todo Esencial, más avisos automáticos por WhatsApp de turnos y estados (próximamente) y facturas electrónicas ARCA emitidas desde Boxly (próximamente), las dos con cupo mensual.',
      'Profesional: todo Pro, con cupos mayores, más recordatorios automáticos de service (próximamente) y personalización de marca (próximamente).',
      'Los precios de cada plan los ves en Suscripción.',
    ],
    enlace: { a: '/suscripcion', texto: 'Suscripción' },
  },
  {
    id: 'adicional-arca',
    categoria: 'cuenta',
    roles: ['admin'],
    pregunta: '¿Qué es el adicional ARCA?',
    respuesta: [
      'Próximamente: la facturación electrónica ARCA todavía no está disponible.',
      'Va a servir para emitir la factura de una reparación desde Boxly, con una acción y tu confirmación. No es para cargar facturas de proveedores ni para emitir facturas sin que nadie intervenga.',
      'Pro y Profesional la incluyen con un cupo mensual. En Esencial se va a poder sumar como adicional mensual, también con cupo; el precio todavía no está definido.',
    ],
  },
  {
    id: 'demo',
    categoria: 'cuenta',
    roles: ['admin'],
    pregunta: '¿Qué pasa cuando termina la demo?',
    respuesta: [
      'La demo es el plan Pro durante 14 días y, al vencer, no tiene días de gracia.',
      'Al entrar después del vencimiento, el administrador ve la pantalla "Gracias por probar Boxly" con una encuesta corta: qué te gustó, qué mejorarías, sugerencias y si pensás contratar. Es opcional, se puede saltear y se responde una sola vez por taller. Después pasás a Suscripción para elegir un plan.',
      'Durante los 3 días siguientes al vencimiento el taller queda en solo lectura: se puede mirar todo, pero no registrar nada nuevo. Pasados esos 3 días sin pago queda suspendido: nadie ve nada, y el administrador solo puede entrar a Suscripción para pagar.',
      'Si pagás un plan en cualquier momento, el taller vuelve a funcionar al instante.',
    ],
    enlace: { a: '/suscripcion', texto: 'Suscripción' },
  },
  {
    id: 'piloto',
    categoria: 'cuenta',
    roles: ['admin'],
    pregunta: '¿Qué es un piloto?',
    respuesta: [
      'Es un acceso sin cargo que Boxly le da a talleres elegidos, con el plan y la fecha de fin que fija en cada caso. No es gratis para siempre: tiene un vencimiento.',
      'Para seguir usando Boxly después del piloto, elegís un plan y lo pagás desde Suscripción.',
    ],
    enlace: { a: '/suscripcion', texto: 'Suscripción' },
  },
  {
    id: 'suscripcion-vencida',
    categoria: 'cuenta',
    roles: ['mostrador', 'mecanico'],
    pregunta: '¿Qué pasa si se vence el pago de la suscripción?',
    respuesta: [
      'Los primeros 7 días el taller sigue funcionando con un aviso ámbar para regularizar antes del corte.',
      'Del día 8 al 30 el taller queda en "solo lectura": el personal y los clientes solo pueden mirar, no registrar nada nuevo; el administrador igual puede entrar a Suscripción para pagar.',
      'A partir del día 31 queda "suspendida": solo el administrador entra, y solo a Suscripción para regularizar; el resto del personal ve un aviso para hablar con el administrador. Al pagar, todo vuelve a la normalidad.',
    ],
  },
  {
    id: 'terminos',
    categoria: 'cuenta',
    roles: ['admin'],
    pregunta: '¿Por qué me pide aceptar los términos y privacidad?',
    respuesta: [
      'Boxly es una plataforma con varios talleres: los términos y la política de privacidad regulan el servicio. La primera vez que entrás como administrador, Boxly te lleva a leerlos y aceptarlos con un botón.',
      'Se acepta una vez por versión: si Boxly actualiza el texto, te lo vuelve a pedir. El resto del personal y los clientes no ven esa pantalla.',
    ],
  },
  {
    id: 'tema-oscuro',
    categoria: 'cuenta',
    pregunta: '¿Cómo cambio a tema oscuro?',
    respuesta: [
      'Abrí el menú de usuario (la hamburguesa arriba a la derecha) y en "Tema" elegí Oscuro, Claro o Auto (sigue la configuración del dispositivo).',
      'El cambio es solo visual y queda guardado en tu navegador; podés alternar cuando quieras.',
    ],
  },
  {
    id: 'cerrar-sesion',
    categoria: 'cuenta',
    pregunta: '¿Cómo cierro sesión?',
    respuesta: [
      'En el menú de usuario (la hamburguesa arriba a la derecha) tocá "Cerrar sesión". Vuelve a la pantalla de ingreso y tu sesión queda cerrada en ese dispositivo.',
    ],
  },
  {
    id: 'contrasena',
    categoria: 'cuenta',
    pregunta: '¿Olvidé mi contraseña, qué hago?',
    respuesta: [
      'No hay recuperación automática: pedile al administrador del taller que la restablezca. Él puede editar tu usuario en Usuarios y poner una "Nueva contraseña", o desactivar y reactivar tu acceso.',
      'Si sos cliente y nunca activaste tu cuenta, revisá el correo que te mandó el taller con el enlace de activación (también podés pedir que te lo reenvíen).',
    ],
  },
  {
    id: 'usar-celular',
    categoria: 'cuenta',
    pregunta: '¿Cómo uso Boxly desde el celular?',
    respuesta: [
      'La pantalla se adapta sola: abajo aparece una barra con las secciones principales y un botón "Más" para el resto (según tu rol: Inventario, Horarios, Dashboard, Usuarios, Panel del taller o Suscripción).',
      'En la página de una orden, el botón con la acción que te toca queda fijo abajo para no tener que buscarlo. Todo se usa con el navegador del teléfono, sin instalar nada.',
    ],
  },
  {
    id: 'dashboard',
    categoria: 'cuenta',
    roles: ['mostrador'],
    pregunta: '¿Qué muestra el Dashboard?',
    respuesta: [
      'Es la pantalla de números del taller, para recepción y administración: órdenes cerradas, facturado, tiempo promedio y órdenes en curso por mecánico, con una comparativa que podés cambiar de métrica y ajustar el período (últimos 30 días, este trimestre, últimos 6 meses o fechas a mano).',
      'Abajo están las finanzas y el "mejor mecánico" del trimestre.',
    ],
    enlace: { a: '/dashboard', texto: 'Dashboard' },
  },

  // ---------- Portal del cliente ----------
  {
    id: 'cliente-entrar',
    categoria: 'portal',
    roles: ['cliente'],
    pregunta: '¿Cómo entro al portal por primera vez?',
    respuesta: [
      'El taller te carga como cliente con tu correo y te manda un correo con un enlace de activación. Abrilo, revisá que tus datos sean correctos, elegí tu contraseña (mínimo 8 caracteres, letras y números) y confirmá.',
      'Después entrás desde la pantalla de ingreso con tu correo y esa contraseña. Si perdiste la contraseña o el enlace no llega, hablale al taller.',
    ],
  },
  {
    id: 'cliente-estado',
    categoria: 'portal',
    roles: ['cliente'],
    pregunta: '¿Cómo veo el estado de mi auto?',
    respuesta: [
      'En "Mis órdenes" cada tarjeta muestra la etapa actual, la entrega estimada y el total (si hay trabajos a cotizar, el total es parcial). Tocá "Ver seguimiento" para ver el recorrido completo: cada etapa por la que pasó, con la descripción y las fotos que subió el taller, más el diagnóstico y los trabajos y repuestos.',
      'En "Mis vehículos" también ves el estado de cada auto: si tiene un trabajo en curso te lleva directo a su seguimiento.',
    ],
    enlace: { a: '/portal', texto: 'Mis órdenes' },
  },
  {
    id: 'cliente-pagar',
    categoria: 'portal',
    roles: ['cliente'],
    pregunta: '¿Cómo pago mi orden?',
    respuesta: [
      'Cuando el taller termina el trabajo y emite el cobro, la orden aparece en "Listas para pagar" con el botón "Pagar" y el monto. Tocándolo te lleva al pago seguro con Mercado Pago.',
      'Si alguna línea del trabajo dice "A cotizar", el total que ves es parcial y puede cambiar hasta que el taller la cotice. Y si tu taller no cobra online, la orden te avisa "Pagás en el taller" en vez del botón de pago.',
      'Si el pago fue rechazado, la orden avisa "El último intento de pago fue rechazado. Podés intentarlo de nuevo." Cuando el pago se acredita, la orden queda "Pagada" y el taller te entrega el auto.',
    ],
    enlace: { a: '/portal', texto: 'Mis órdenes' },
  },
  {
    id: 'cliente-etapas',
    categoria: 'portal',
    roles: ['cliente'],
    pregunta: '¿Qué significan las etapas que veo en el seguimiento?',
    respuesta: [
      'El recorrido muestra cada etapa del trabajo: Completado (ya pasó), Ahora (en la que está tu auto) y Pendiente (las que faltan); "No hizo falta" marca las etapas que se saltearon.',
      'Debajo, la "etapa actual" tiene una descripción de qué se está haciendo. El pago se habilita cuando el taller emite el cobro: por eso a veces dice "Se habilita el pago cuando esté lista".',
    ],
    enlace: { a: '/portal', texto: 'Mis órdenes' },
  },
]
