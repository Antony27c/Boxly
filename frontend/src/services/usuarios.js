import { api } from '@/lib/api'

const RECURSO = '/api/v1/users'

export const ROLES = [
  { valor: 'superadmin', texto: 'Superadmin' },
  { valor: 'administrador', texto: 'Administrador' },
  { valor: 'recepcion', texto: 'Recepcionista' },
  { valor: 'mecanico', texto: 'Mecánico' },
]

export function nombreRol(rol) {
  return ROLES.find((item) => item.valor === rol)?.texto ?? rol
}

/* Roles del personal de un taller (docs/Plataforma.md, P1). "superadmin" no es
   un rol del taller: no se ofrece para asignar ni para filtrar. */
export const ROLES_TALLER = ROLES.filter((item) => item.valor !== 'superadmin')

/* Roles que se pueden asignar desde la pantalla de Usuarios: el administrador
   gestiona todo el personal de su taller, incluidos otros administradores, y
   nunca puede crear ni asignar superadmin (el servidor responde 403). */
export function rolesAsignables() {
  return ROLES_TALLER
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

  /* Administradores activos del taller: solo interesa el total, así que se pide
     una página de un elemento y se lee X-Total-Count. Con uno solo, el servidor
     no deja desactivarlo, quitarle el rol ni eliminarlo (409, P1). */
  contarAdministradoresActivos: async (token) => {
    const consulta = aParamsPaginacion({ rol: 'administrador', solo_activos: true, limit: 1 })
    const { total } = await api.getConTotal(`${RECURSO}?${consulta.toString()}`, token)
    return total
  },

  crear: (usuario, token) => api.post(RECURSO, usuario, token),

  actualizar: (id, usuario, token) => api.put(`${RECURSO}/${id}`, usuario, token),

  cambiarEstado: (id, activo, token) => api.put(`${RECURSO}/${id}`, { activo }, token),

  eliminar: (id, token) => api.del(`${RECURSO}/${id}`, token),
}
