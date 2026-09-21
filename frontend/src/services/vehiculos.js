import { api } from '@/lib/api'
import { MockError, operar, proximoId } from '@/mocks/db'
import { USAR_MOCK } from '@/services/config'

const RECURSO = '/api/v1/vehiculos'

function buscarVehiculo(datos, id) {
  const vehiculo = datos.vehiculos.find((item) => item.id === Number(id))
  if (!vehiculo) throw new MockError('No encontramos ese vehículo.', 404)
  return vehiculo
}

function validarPatenteUnica(datos, patente, idActual) {
  const repetida = datos.vehiculos.some(
    (item) => item.patente === patente && item.id !== Number(idActual),
  )
  if (repetida) throw new MockError('Ya hay un vehículo cargado con esa patente.', 409)
}

function normalizar(vehiculo) {
  return {
    ...vehiculo,
    patente: vehiculo.patente.toUpperCase().replace(/\s/g, ''),
    cliente_id: Number(vehiculo.cliente_id),
    anio: Number(vehiculo.anio),
    kilometraje: Number(vehiculo.kilometraje),
  }
}

export const vehiculosService = {
  listar: (token) =>
    USAR_MOCK ? operar((datos) => datos.vehiculos) : api.get(RECURSO, token),

  obtener: (id, token) =>
    USAR_MOCK
      ? operar((datos) => buscarVehiculo(datos, id))
      : api.get(`${RECURSO}/${id}`, token),

  crear: (vehiculo, token) =>
    USAR_MOCK
      ? operar((datos) => {
          const limpio = normalizar(vehiculo)
          validarPatenteUnica(datos, limpio.patente)
          const nuevo = {
            ...limpio,
            id: proximoId(datos.vehiculos),
            creado_en: new Date().toISOString(),
          }
          datos.vehiculos.push(nuevo)
          return nuevo
        })
      : api.post(RECURSO, normalizar(vehiculo), token),

  actualizar: (id, vehiculo, token) =>
    USAR_MOCK
      ? operar((datos) => {
          const actual = buscarVehiculo(datos, id)
          const limpio = normalizar(vehiculo)
          validarPatenteUnica(datos, limpio.patente, id)
          Object.assign(actual, limpio)
          return actual
        })
      : api.put(`${RECURSO}/${id}`, normalizar(vehiculo), token),

  eliminar: (id, token) =>
    USAR_MOCK
      ? operar((datos) => {
          const vehiculo = buscarVehiculo(datos, id)
          datos.vehiculos = datos.vehiculos.filter((item) => item.id !== vehiculo.id)
          datos.turnos = datos.turnos.filter((t) => t.vehiculo_id !== vehiculo.id)
          return null
        })
      : api.del(`${RECURSO}/${id}`, token),

  // Historial de reparaciones de la ficha técnica (órdenes de trabajo del vehículo).
  historial: (id, token) =>
    USAR_MOCK
      ? operar((datos) =>
          datos.ordenes
            .filter((orden) => orden.vehiculo_id === Number(id))
            .sort((a, b) => b.fecha.localeCompare(a.fecha)),
        )
      : api.get(`${RECURSO}/${id}/ordenes`, token),
}
