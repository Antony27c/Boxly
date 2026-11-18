import { api, urlArchivo } from '@/lib/api'

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

export function estadoCobro(orden) {
  if (orden.pagada) return 'pagada'
  if (orden.cobro_estado === 'aprobado' && Number(orden.costo_final) > 0) return 'aprobado'
  if (orden.cobro_estado === 'pendiente') return 'pendiente'
  return ESTADOS_COBRABLES.includes(orden.estado) ? 'sin_cobro' : null
}

export function proximosEstados(estado) {
  return TRANSICIONES[estado] ?? []
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
        if (esMostrador) return { tipo: 'cobro', texto: 'Emitir cobro' }
        return esMecanico ? { tipo: 'cobro', texto: 'Proponer cobro' } : null
      }
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
    fecha: orden.fecha_ingreso?.slice(0, 10) ?? '',
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

  agregarDetalle: (ordenId, linea, token) =>
    api.post(
      `${RECURSO}/${ordenId}/detalles`,
      {
        repuesto_id: linea.repuesto_id ? Number(linea.repuesto_id) : null,
        descripcion: linea.descripcion?.trim() || null,
        cantidad: Number(linea.cantidad) || 1,
        precio_unitario:
          linea.precio_unitario !== '' && linea.precio_unitario != null
            ? Number(linea.precio_unitario)
            : null,
      },
      token,
    ),

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
