import { api } from '@/lib/api'

const RECURSO = '/api/v1/turnos'

export const ESTADOS_TURNO = ['pendiente', 'confirmado', 'en_taller', 'completado', 'cancelado']

// Un turno cada 2 horas (el taller para al mediodía). El backend valida la misma grilla.
export const HORARIOS = ['08:00', '10:00', '12:00', '14:00', '16:00']

function aPayloadApi(turno) {
  return {
    cliente_id: Number(turno.cliente_id),
    vehiculo_id: turno.vehiculo_id ? Number(turno.vehiculo_id) : null,
    fecha_hora: `${turno.fecha}T${turno.hora}:00`,
    motivo: turno.servicio,
    estado: turno.estado,
    notas: turno.notas,
  }
}

function desdeApi(item) {
  if (!item) return item
  const iso = String(item.fecha_hora ?? '')
  return {
    ...item,
    fecha: item.fecha ?? iso.slice(0, 10),
    hora: item.hora ?? iso.slice(11, 16),
    servicio: item.servicio ?? item.motivo ?? '',
    estado: item.estado === 'asistio' ? 'completado' : item.estado,
    notas: item.notas ?? '',
  }
}

export const turnosService = {
  // { desde, hasta } en YYYY-MM-DD acotan la semana visible; si el backend
  // todavía no filtra, la página igual descarta lo que cae fuera en el cliente.
  listar: ({ desde, hasta } = {}, token) => {
    const params = new URLSearchParams()
    if (desde) params.set('desde', desde)
    if (hasta) params.set('hasta', hasta)
    const query = params.toString()
    return api.get(query ? `${RECURSO}?${query}` : RECURSO, token).then((lista) => lista.map(desdeApi))
  },

  crear: (turno, token) => api.post(RECURSO, aPayloadApi(turno), token).then(desdeApi),

  actualizar: (id, turno, token) =>
    api.put(`${RECURSO}/${id}`, aPayloadApi(turno), token).then(desdeApi),

  cambiarEstado: (id, estado, token) =>
    api.put(`${RECURSO}/${id}/estado`, { estado }, token).then(desdeApi),

  eliminar: (id, token) => api.del(`${RECURSO}/${id}`, token),
}
