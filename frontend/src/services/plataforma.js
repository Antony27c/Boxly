import { api } from '@/lib/api'

const RECURSO = '/api/v1/plataforma'

/* Misma idea que en services/usuarios.js: limit/offset más filtros sueltos
   (estado, q); api.getConTotal devuelve { items, total } con X-Total-Count.
   Contrato en docs/Plataforma.md (P1). */
function aParams({ limit, offset, ...filtros }) {
  const params = new URLSearchParams()
  if (limit != null) params.set('limit', limit)
  if (offset != null) params.set('offset', offset)
  for (const [clave, valor] of Object.entries(filtros)) {
    if (valor !== undefined && valor !== null && valor !== '') params.set(clave, valor)
  }
  return params
}

export const plataformaService = {
  listarTalleres: (params = {}, token) => {
    const consulta = aParams(params).toString()
    return api.getConTotal(`${RECURSO}/talleres${consulta ? `?${consulta}` : ''}`, token)
  },

  // Alta de taller con su primer administrador: la respuesta trae
  // { taller, admin_email, password_temporal } — la temporal se muestra una vez.
  crearTaller: (datos, token) => api.post(`${RECURSO}/talleres`, datos, token),

  obtenerTaller: (id, token) => api.get(`${RECURSO}/talleres/${id}`, token),

  actualizarTaller: (id, datos, token) => api.put(`${RECURSO}/talleres/${id}`, datos, token),

  suspenderTaller: (id, token) => api.post(`${RECURSO}/talleres/${id}/suspender`, {}, token),

  reactivarTaller: (id, token) => api.post(`${RECURSO}/talleres/${id}/reactivar`, {}, token),

  /* Acciones sobre el personal del taller (no sobre clientes): devuelven una
     contraseña temporal que se muestra una sola vez, o confirman el cierre
     de sesiones. */
  restablecerPassword: (id, token) =>
    api.post(`${RECURSO}/usuarios/${id}/restablecer-password`, {}, token),

  cerrarSesiones: (id, token) => api.post(`${RECURSO}/usuarios/${id}/cerrar-sesiones`, {}, token),
}
