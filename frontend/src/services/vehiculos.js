import { api } from '@/lib/api'
import { desdeApi } from '@/services/ordenes'

const RECURSO = '/api/v1/vehiculos'

function normalizar(vehiculo) {
  return {
    ...vehiculo,
    patente: vehiculo.patente.toUpperCase().replace(/\s/g, ''),
    cliente_id: Number(vehiculo.cliente_id),
    anio: vehiculo.anio ? Number(vehiculo.anio) : null,
  }
}

export const vehiculosService = {
  listar: (token) => api.get(RECURSO, token),

  obtener: (id, token) => api.get(`${RECURSO}/${id}`, token),

  crear: (vehiculo, token) => api.post(RECURSO, normalizar(vehiculo), token),

  actualizar: (id, vehiculo, token) =>
    api.put(`${RECURSO}/${id}`, normalizar(vehiculo), token),

  eliminar: (id, token) => api.del(`${RECURSO}/${id}`, token),

  historial: (id, token) =>
    api
      .get(`${RECURSO}/${id}/ordenes`, token)
      .then((ordenes) =>
        ordenes.map(desdeApi).sort((a, b) => b.fecha.localeCompare(a.fecha)),
      ),
}
