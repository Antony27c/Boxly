import { api } from '@/lib/api'

const RECURSO = '/api/v1/clientes'

/* Arma la query de un listado paginado: limit/offset más filtros extra.
   Devuelve { items, total } gracias a api.getConTotal. */
function aParamsPaginacion({ limit, offset, ...filtros }) {
  const params = new URLSearchParams()
  if (limit != null) params.set('limit', limit)
  if (offset != null) params.set('offset', offset)
  for (const [clave, valor] of Object.entries(filtros)) {
    if (valor !== undefined && valor !== null && valor !== '') params.set(clave, valor)
  }
  return params
}

export const clientesService = {
  listar: (token) => api.get(RECURSO, token),

  listarPaginado: (params = {}, token) => {
    const consulta = aParamsPaginacion(params).toString()
    return api.getConTotal(`${RECURSO}${consulta ? `?${consulta}` : ''}`, token)
  },

  obtener: (id, token) => api.get(`${RECURSO}/${id}`, token),

  crear: (cliente, token) => api.post(RECURSO, cliente, token),

  actualizar: (id, cliente, token) => api.put(`${RECURSO}/${id}`, cliente, token),

  invitar: (id, token) => api.post(`${RECURSO}/${id}/invitacion`, {}, token),

  eliminar: (id, token) => api.del(`${RECURSO}/${id}`, token),
}
