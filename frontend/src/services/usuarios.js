import { api } from '@/lib/api'

const RECURSO = '/api/v1/users'

export const ROLES = [
  { valor: 'administrador', texto: 'Administrador' },
  { valor: 'recepcion', texto: 'Recepcionista' },
  { valor: 'mecanico', texto: 'Mecánico' },
]

export function nombreRol(rol) {
  return ROLES.find((item) => item.valor === rol)?.texto ?? rol
}

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

export const usuariosService = {
  listar: (token) => api.get(RECURSO, token),

  listarPaginado: (params = {}, token) => {
    const consulta = aParamsPaginacion(params).toString()
    return api.getConTotal(`${RECURSO}${consulta ? `?${consulta}` : ''}`, token)
  },

  crear: (usuario, token) => api.post(RECURSO, usuario, token),

  actualizar: (id, usuario, token) => api.put(`${RECURSO}/${id}`, usuario, token),

  cambiarEstado: (id, activo, token) => api.put(`${RECURSO}/${id}`, { activo }, token),

  eliminar: (id, token) => api.del(`${RECURSO}/${id}`, token),
}
