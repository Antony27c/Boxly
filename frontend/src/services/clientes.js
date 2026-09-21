import { api } from '@/lib/api'
import { MockError, operar, proximoId } from '@/mocks/db'
import { USAR_MOCK } from '@/services/config'

const RECURSO = '/api/v1/clientes'

function buscarCliente(datos, id) {
  const cliente = datos.clientes.find((item) => item.id === Number(id))
  if (!cliente) throw new MockError('No encontramos ese cliente.', 404)
  return cliente
}

function validarDniUnico(datos, dni, idActual) {
  const repetido = datos.clientes.some(
    (item) => item.dni === dni && item.id !== Number(idActual),
  )
  if (repetido) throw new MockError('Ya existe un cliente con ese DNI/CUIT.', 409)
}

export const clientesService = {
  listar: (token) =>
    USAR_MOCK ? operar((datos) => datos.clientes) : api.get(RECURSO, token),

  obtener: (id, token) =>
    USAR_MOCK
      ? operar((datos) => buscarCliente(datos, id))
      : api.get(`${RECURSO}/${id}`, token),

  crear: (cliente, token) =>
    USAR_MOCK
      ? operar((datos) => {
          validarDniUnico(datos, cliente.dni)
          const nuevo = {
            ...cliente,
            id: proximoId(datos.clientes),
            creado_en: new Date().toISOString(),
          }
          datos.clientes.push(nuevo)
          return nuevo
        })
      : api.post(RECURSO, cliente, token),

  actualizar: (id, cliente, token) =>
    USAR_MOCK
      ? operar((datos) => {
          const actual = buscarCliente(datos, id)
          validarDniUnico(datos, cliente.dni, id)
          Object.assign(actual, cliente)
          return actual
        })
      : api.put(`${RECURSO}/${id}`, cliente, token),

  eliminar: (id, token) =>
    USAR_MOCK
      ? operar((datos) => {
          const cliente = buscarCliente(datos, id)
          const conVehiculos = datos.vehiculos.some((v) => v.cliente_id === cliente.id)
          if (conVehiculos) {
            throw new MockError(
              'No se puede eliminar: el cliente tiene vehículos asociados.',
              409,
            )
          }
          datos.clientes = datos.clientes.filter((item) => item.id !== cliente.id)
          datos.turnos = datos.turnos.filter((t) => t.cliente_id !== cliente.id)
          return null
        })
      : api.del(`${RECURSO}/${id}`, token),
}
