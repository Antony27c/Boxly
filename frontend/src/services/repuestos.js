import { api } from '@/lib/api'

const RECURSO = '/api/v1/repuestos'

export function tieneStockBajo(repuesto) {
  return Number(repuesto.stock) <= Number(repuesto.stock_minimo)
}

/* Convierte lo que escribe el usuario (texto) en lo que espera la API (números). */
function aPayloadApi(repuesto) {
  return {
    codigo: String(repuesto.codigo).trim(),
    nombre: String(repuesto.nombre).trim(),
    descripcion: String(repuesto.descripcion ?? '').trim(),
    stock: Number(repuesto.stock),
    stock_minimo: Number(repuesto.stock_minimo),
    precio: Number(String(repuesto.precio).replace(',', '.')),
  }
}

/* Al editar no se manda el stock: solo cambia con "Ingresar stock" o al usarlo en órdenes,
   así no se pisan ingresos hechos mientras el formulario estaba abierto. */
function aPayloadEdicion(repuesto) {
  const payload = aPayloadApi(repuesto)
  delete payload.stock
  return payload
}

/* Arma la query de un listado paginado: limit/offset más filtros extra
   (ej. solo_activos). Devuelve { items, total } gracias a api.getConTotal. */
function aParamsPaginacion({ limit, offset, ...filtros }) {
  const params = new URLSearchParams()
  if (limit != null) params.set('limit', limit)
  if (offset != null) params.set('offset', offset)
  for (const [clave, valor] of Object.entries(filtros)) {
    if (valor !== undefined && valor !== null && valor !== '') params.set(clave, valor)
  }
  return params
}

export const repuestosService = {
  /* Solo repuestos activos (los que se pueden usar en órdenes). */
  listar: (token) => api.get(`${RECURSO}?solo_activos=true`, token),

  /* Activos e inactivos (para la pantalla de Inventario). */
  listarTodos: (token) => api.get(RECURSO, token),

  listarPaginado: (params = {}, token) => {
    const consulta = aParamsPaginacion(params).toString()
    return api.getConTotal(`${RECURSO}${consulta ? `?${consulta}` : ''}`, token)
  },

  stockBajo: (token) => api.get(`${RECURSO}/stock-bajo`, token),

  crear: (repuesto, token) => api.post(RECURSO, aPayloadApi(repuesto), token),

  actualizar: (id, repuesto, token) =>
    api.put(`${RECURSO}/${id}`, aPayloadEdicion(repuesto), token),

  /* "Eliminar" = desactivar: si el repuesto ya se usó en órdenes, la API no deja borrarlo. */
  cambiarEstado: (id, activo, token) => api.put(`${RECURSO}/${id}`, { activo }, token),

  ingresarStock: (repuesto, cantidad, token) =>
    api.post(`${RECURSO}/${repuesto.id}/ingresos`, { cantidad: Number(cantidad) }, token),
}
