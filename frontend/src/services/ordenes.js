import { api } from '@/lib/api'
import { MockError, operar, proximoId } from '@/mocks/db'
import { USAR_MOCK } from '@/services/config'

const RECURSO = '/api/v1/ordenes'

export const ESTADOS_ORDEN = [
  'Recibido',
  'En diagnóstico',
  'Esperando repuestos',
  'En reparación',
  'Entregado',
  'Cancelado',
]

function buscarOrden(datos, id) {
  const orden = datos.ordenes.find((item) => item.id === Number(id))
  if (!orden) throw new MockError('No encontramos esa orden de trabajo.', 404)
  return orden
}

function normalizar(orden) {
  return {
    ...orden,
    vehiculo_id: Number(orden.vehiculo_id),
    total: Number(orden.total) || 0,
  }
}

export const ordenesService = {
  listar: (token) => (USAR_MOCK ? operar((datos) => datos.ordenes) : api.get(RECURSO, token)),

  obtener: (id, token) =>
    USAR_MOCK ? operar((datos) => buscarOrden(datos, id)) : api.get(`${RECURSO}/${id}`, token),

  crear: (orden, token) =>
    USAR_MOCK
      ? operar((datos) => {
          const limpio = normalizar(orden)
          if (!datos.vehiculos.some((v) => v.id === limpio.vehiculo_id)) {
            throw new MockError('El vehículo elegido ya no existe.', 400)
          }
          const nueva = { ...limpio, id: proximoId(datos.ordenes) }
          datos.ordenes.push(nueva)
          return nueva
        })
      : api.post(RECURSO, normalizar(orden), token),

  actualizar: (id, orden, token) =>
    USAR_MOCK
      ? operar((datos) => {
          const actual = buscarOrden(datos, id)
          Object.assign(actual, normalizar(orden))
          return actual
        })
      : api.put(`${RECURSO}/${id}`, normalizar(orden), token),

  eliminar: (id, token) =>
    USAR_MOCK
      ? operar((datos) => {
          const orden = buscarOrden(datos, id)
          datos.ordenes = datos.ordenes.filter((item) => item.id !== orden.id)
          return null
        })
      : api.del(`${RECURSO}/${id}`, token),
}
