import { api, urlArchivo } from '@/lib/api'
import { diaServidor } from '@/lib/fechas'

const RECURSO = '/api/v1/ordenes'

const CODIGOS = {
  Pendiente: 'pendiente',
  Ingresado: 'ingresado',
  'En diagnóstico': 'en_diagnostico',
  'Esperando repuestos': 'esperando_repuestos',
  Listo: 'listo',
  Entregado: 'entregado',
  Cancelado: 'cancelado',
}

export const ESTADOS_ORDEN = Object.keys(CODIGOS)

const TRANSICIONES = {
  Pendiente: ['Ingresado', 'Cancelado'],
  Ingresado: ['En diagnóstico', 'Cancelado'],
  'En diagnóstico': ['Esperando repuestos', 'Listo', 'Cancelado'],
  'Esperando repuestos': ['Listo', 'Cancelado'],
  Listo: ['Entregado'],
  Entregado: [],
  Cancelado: [],
}

export const DESCRIPCION_ESTADOS = {
  Pendiente: 'La orden está abierta pero el vehículo todavía no entró al taller.',
  Ingresado: 'El vehículo ya está en el taller y espera que lo revise un mecánico.',
  'En diagnóstico': 'El mecánico está revisando el vehículo para encontrar la falla y armar el presupuesto.',
  'Esperando repuestos': 'El trabajo está frenado hasta que lleguen los repuestos pedidos.',
  Listo: 'El trabajo terminó y el vehículo está listo para que lo retiren.',
  Entregado: 'El cliente retiró el vehículo. La orden queda cerrada.',
  Cancelado: 'La orden se canceló y no se va a hacer el trabajo.',
}

export const ESTADOS_COBRABLES = ['Listo', 'Entregado']

// 'pendiente' ya no se genera: el mecánico no propone cobros desde el commit
// 2542dd5 (S3). Se deja porque puede haber órdenes viejas con cobro_estado
// 'pendiente' y monto_propuesto, que recepción o el administrador todavía aprueban
// con POST /ordenes/{id}/cobro/aprobar. Borrar esta rama (y la de "Revisar/Aprobar
// cobro" en accionPrincipal, TarjetaOrden, CobroOrden y el filtro "Cobro pendiente")
// recién cuando una migración resuelva esas órdenes.
export function estadoCobro(orden) {
  if (orden.pagada) return 'pagada'
  if (orden.cobro_estado === 'aprobado' && Number(orden.costo_final) > 0) return 'aprobado'
  if (orden.cobro_estado === 'pendiente') return 'pendiente'
  return ESTADOS_COBRABLES.includes(orden.estado) ? 'sin_cobro' : null
}

export function proximosEstados(estado) {
  return TRANSICIONES[estado] ?? []
}

export const MOTIVO_A_COTIZAR = 'Cotizá los trabajos pendientes antes de cobrar.'

// Medios del pago registrado en el local (POST /ordenes/{id}/pago-local).
export const MEDIOS_PAGO_LOCAL = [
  { valor: 'efectivo', texto: 'Efectivo' },
  { valor: 'tarjeta', texto: 'Tarjeta' },
  { valor: 'transferencia', texto: 'Transferencia' },
  { valor: 'otro', texto: 'Otro' },
]

/* "Pagada en el taller (efectivo)" o "Pagada online (Mercado Pago)" según el
   medio del pago aprobado; sin medio conocido, solo "Pagada". */
export function textoPagada(medio) {
  if (medio === 'mercadopago') return 'Pagada online (Mercado Pago)'
  const local = MEDIOS_PAGO_LOCAL.find((opcion) => opcion.valor === medio)
  return local ? `Pagada en el taller (${local.texto.toLowerCase()})` : 'Pagada'
}

const ROL_ADMIN = ['admin', 'administrador']
const ROL_MOSTRADOR = [...ROL_ADMIN, 'recepcion', 'recepcionista']
const ROL_MECANICO = ['mecanico', 'mecánico']

/**
 * Acción destacada de una orden según su etapa y el rol del usuario: lo que "hay que hacer ahora".
 * Devuelve null cuando a ese rol no le toca hacer nada (la tarjeta solo se puede abrir).
 *
 * tipo:
 *  - 'etapa'   → abrir el cambio de etapa con `destino` preseleccionado
 *  - 'asignar' → elegir mecánico
 *  - 'cobro'   → abrir el cobro (emitir, proponer, revisar o aprobar)
 *  - 'abrir'   → ir a la página de la orden (/ordenes/:id) a cargar trabajo
 * `secundaria` (opcional) es una segunda acción del mismo formato.
 */
export function accionPrincipal(orden, rol) {
  if (!orden) return null
  const esAdmin = ROL_ADMIN.includes(rol)
  const esMostrador = ROL_MOSTRADOR.includes(rol)
  const esMecanico = ROL_MECANICO.includes(rol)
  const tieneMecanico = Boolean(orden.mecanico_id || orden.mecanico)

  switch (orden.estado) {
    case 'Pendiente':
      return esMostrador ? { tipo: 'etapa', destino: 'Ingresado', texto: 'Recibir auto' } : null
    case 'Ingresado':
      if (!tieneMecanico) return esMostrador ? { tipo: 'asignar', texto: 'Asignar mecánico' } : null
      return esMecanico ? { tipo: 'etapa', destino: 'En diagnóstico', texto: 'Empezar diagnóstico' } : null
    case 'En diagnóstico':
      return esMecanico
        ? {
            tipo: 'etapa',
            destino: 'Listo',
            texto: 'Marcar listo',
            secundaria: { tipo: 'etapa', destino: 'Esperando repuestos', texto: 'Esperando repuestos' },
            trabajo: { tipo: 'abrir', texto: 'Cargar trabajo' },
          }
        : null
    case 'Esperando repuestos':
      return esMecanico ? { tipo: 'etapa', destino: 'Listo', texto: 'Marcar listo' } : null
    case 'Listo': {
      const cobro = estadoCobro(orden)
      if (cobro === 'sin_cobro') {
        // Con líneas a cotizar el backend rechaza el cobro (409, S3): el botón
        // queda deshabilitado con el motivo y se ofrece ir a cotizar.
        if (esMostrador && Number(orden.lineas_a_cotizar ?? 0) > 0) {
          return {
            tipo: 'cobro',
            texto: 'Emitir cobro',
            deshabilitada: true,
            motivo: MOTIVO_A_COTIZAR,
            trabajo: { tipo: 'abrir', texto: 'Cotizar trabajos' },
          }
        }
        if (esMostrador) return { tipo: 'cobro', texto: 'Emitir cobro' }
        // "Proponer cobro" no se muestra: accionVisible se lo filtra al mecánico.
        return esMecanico ? { tipo: 'cobro', texto: 'Proponer cobro' } : null
      }
      // Solo órdenes viejas con cobro propuesto (ver estadoCobro).
      if (cobro === 'pendiente') {
        if (esAdmin) return { tipo: 'cobro', texto: 'Aprobar cobro' }
        return esMostrador ? { tipo: 'cobro', texto: 'Revisar cobro' } : null
      }
      return esMostrador ? { tipo: 'etapa', destino: 'Entregado', texto: 'Entregar' } : null
    }
    default:
      return null
  }
}

export function nombreEstado(codigo) {
  return ESTADOS_ORDEN.find((estado) => CODIGOS[estado] === codigo) ?? codigo
}

export function desdeApi(orden) {
  return {
    ...orden,
    estado: nombreEstado(orden.estado),
    // El día del ingreso en hora del taller (el datetime del servidor viene
    // en UTC sin zona: recortar el string correría el día en los ingresos
    // de la noche).
    fecha: diaServidor(orden.fecha_ingreso) ?? '',
    descripcion: orden.descripcion_ingreso,
    mecanico: orden.mecanico_nombre ?? '',
    total: Number(orden.costo_final ?? orden.costo_estimado ?? 0),
  }
}

export function historialDesdeApi(item) {
  return {
    ...item,
    estado_anterior: item.estado_anterior ? nombreEstado(item.estado_anterior) : null,
    estado_nuevo: nombreEstado(item.estado_nuevo),
  }
}

export function sePuedeEliminar(orden) {
  return orden?.estado === 'Pendiente'
}

export function sePuedeEditarDetalle(orden) {
  return orden?.estado !== 'Entregado' && orden?.estado !== 'Cancelado'
}

// Línea "a cotizar" (S3): el backend la marca con a_cotizar o con
// precio_unitario null; en ambos casos no suma al total.
export function lineaACotizar(detalle) {
  return detalle?.a_cotizar === true || detalle?.precio_unitario == null
}

/* La acción principal que se puede mostrar: el mecánico no emite ni propone
   cobros (el backend le responde 403), así que la acción 'cobro' no se le
   ofrece aunque accionPrincipal la calcule. */
export function accionVisible(orden, rol) {
  const accion = accionPrincipal(orden, rol)
  if (accion?.tipo === 'cobro' && ROL_MECANICO.includes(rol)) return null
  return accion
}

/* Para las tarjetas y filas, donde no entra el motivo de un botón deshabilitado:
   si la acción no se puede hacer todavía, se ofrece la que la destraba (cotizar). */
export function accionEjecutable(orden, rol) {
  const accion = accionVisible(orden, rol)
  return accion?.deshabilitada ? (accion.trabajo ?? null) : accion
}

export function imagenDesdeApi(imagen) {
  return {
    ...imagen,
    etapa: imagen.etapa ? nombreEstado(imagen.etapa) : null,
    url: urlArchivo(imagen.url),
  }
}

export const ordenesService = {
  imagenes: (ordenId, token) =>
    api.get(`${RECURSO}/${ordenId}/imagenes`, token).then((lista) => lista.map(imagenDesdeApi)),

  subirImagen: (ordenId, archivo, etapa, token) => {
    const formulario = new FormData()
    formulario.append('archivo', archivo)
    if (etapa) formulario.append('etapa', CODIGOS[etapa] ?? etapa)
    return api.subir(`${RECURSO}/${ordenId}/imagenes`, formulario, token).then(imagenDesdeApi)
  },

  quitarImagen: (ordenId, imagenId, token) =>
    api.del(`${RECURSO}/${ordenId}/imagenes/${imagenId}`, token),

  mecanicos: (token) => api.get('/api/v1/users/mecanicos', token),

  historial: (id, token) =>
    api.get(`${RECURSO}/${id}/historial`, token).then((lista) => lista.map(historialDesdeApi)),

  eliminar: (id, token) => api.del(`${RECURSO}/${id}`, token),

  listar: (token) =>
    api.get(RECURSO, token).then((ordenes) => ordenes.map(desdeApi)),

  obtener: (id, token) => api.get(`${RECURSO}/${id}`, token).then(desdeApi),

  crear: (orden, token) =>
    api
      .post(
        RECURSO,
        {
          vehiculo_id: Number(orden.vehiculo_id),
          mecanico_id: orden.mecanico_id ? Number(orden.mecanico_id) : null,
          descripcion_ingreso: orden.descripcion,
          costo_estimado: Number(orden.total) || null,
        },
        token,
      )
      .then(desdeApi),

  detalles: (ordenId, token) => api.get(`${RECURSO}/${ordenId}/detalles`, token),

  agregarDetalle: (ordenId, linea, token) => {
    const cuerpo = {
      repuesto_id: linea.repuesto_id ? Number(linea.repuesto_id) : null,
      descripcion: linea.descripcion?.trim() || null,
      cantidad: Number(linea.cantidad) || 1,
    }
    // El mecánico no manda precio (S3): si viene undefined la clave no viaja.
    if (linea.precio_unitario !== undefined) {
      cuerpo.precio_unitario =
        linea.precio_unitario !== '' && linea.precio_unitario != null
          ? Number(linea.precio_unitario)
          : null
    }
    return api.post(`${RECURSO}/${ordenId}/detalles`, cuerpo, token)
  },

  // Cotizar o corregir el precio de una línea (administrador o recepción, S3).
  cotizarDetalle: (ordenId, detalleId, precio, token) =>
    api.patch(`${RECURSO}/${ordenId}/detalles/${detalleId}`, { precio_unitario: Number(precio) }, token),

  quitarDetalle: (ordenId, detalleId, token) =>
    api.del(`${RECURSO}/${ordenId}/detalles/${detalleId}`, token),

  cambiarEstado: (id, estado, comentario, token) =>
    api
      .patch(`${RECURSO}/${id}`, { estado: CODIGOS[estado], comentario_cambio: comentario }, token)
      .then(desdeApi),

  avisos: (id, token) => api.get(`${RECURSO}/${id}/notificaciones`, token),

  enviarAviso: (id, token) => api.post(`${RECURSO}/${id}/notificaciones`, {}, token),

  emitirCobro: (id, monto, token) =>
    api.post(`${RECURSO}/${id}/cobro`, { monto: Number(monto) }, token).then(desdeApi),

  registrarPagoLocal: (id, { medio, monto, referencia }, token) =>
    api
      .post(
        `${RECURSO}/${id}/pago-local`,
        { medio, monto: Number(monto), referencia: referencia?.trim() || null },
        token,
      )
      .then(desdeApi),

  aprobarCobro: (id, monto, token) =>
    api
      .post(`${RECURSO}/${id}/cobro/aprobar`, monto ? { monto: Number(monto) } : {}, token)
      .then(desdeApi),

  actualizar: (id, orden, token) =>
    api
      .patch(
        `${RECURSO}/${id}`,
        {
          estado: CODIGOS[orden.estado],
          mecanico_id: orden.mecanico_id ? Number(orden.mecanico_id) : null,
          descripcion_ingreso: orden.descripcion,
          costo_estimado: Number(orden.total) || 0,
        },
        token,
      )
      .then(desdeApi),
}
