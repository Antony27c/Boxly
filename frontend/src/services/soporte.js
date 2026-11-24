import { api } from '@/lib/api'

const RECURSO = '/api/v1/soporte'

/* Arma la query de la actividad paginada: limit/offset y nada más (los
   filtros de /soporte/actividad no están en el contrato). */
function aParams({ limit, offset }) {
  const params = new URLSearchParams()
  if (limit != null) params.set('limit', limit)
  if (offset != null) params.set('offset', offset)
  return params
}

export const soporteService = {
  // Accesos de soporte del taller de la sesión, más nuevo primero.
  listarAccesos: (token) => api.get(`${RECURSO}/accesos`, token),

  // Otorga un acceso temporal de solo lectura. { horas: 1|4|24|72, motivo? }
  crearAcceso: ({ horas, motivo }, token) =>
    api.post(`${RECURSO}/accesos`, motivo ? { horas, motivo } : { horas }, token),

  revocarAcceso: (id, token) => api.post(`${RECURSO}/accesos/${id}/revocar`, {}, token),

  // Auditoría del taller marcada como soporte (lo que Boxly miró), paginada.
  listarActividad: (params = {}, token) => {
    const consulta = aParams(params).toString()
    return api.getConTotal(`${RECURSO}/actividad${consulta ? `?${consulta}` : ''}`, token)
  },
}
