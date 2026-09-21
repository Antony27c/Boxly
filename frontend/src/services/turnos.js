import { api } from '@/lib/api'
import { MockError, operar, proximoId } from '@/mocks/db'
import { USAR_MOCK } from '@/services/config'

const RECURSO = '/api/v1/turnos'

export const ESTADOS_TURNO = ['pendiente', 'confirmado', 'en_taller', 'completado', 'cancelado']

export const HORARIOS = [
  '08:00',
  '08:30',
  '09:00',
  '09:30',
  '10:00',
  '10:30',
  '11:00',
  '11:30',
  '12:00',
  '14:00',
  '14:30',
  '15:00',
  '15:30',
  '16:00',
  '16:30',
  '17:00',
]

function buscarTurno(datos, id) {
  const turno = datos.turnos.find((item) => item.id === Number(id))
  if (!turno) throw new MockError('No encontramos ese turno.', 404)
  return turno
}

function validarDisponibilidad(datos, turno, idActual) {
  const ocupado = datos.turnos.some(
    (item) =>
      item.fecha === turno.fecha &&
      item.hora === turno.hora &&
      item.estado !== 'cancelado' &&
      item.id !== Number(idActual),
  )
  if (ocupado) throw new MockError('Ese horario ya está ocupado. Elegí otro.', 409)
}

function normalizar(turno) {
  return {
    ...turno,
    cliente_id: Number(turno.cliente_id),
    vehiculo_id: Number(turno.vehiculo_id),
  }
}

export const turnosService = {
  listar: (token) =>
    USAR_MOCK ? operar((datos) => datos.turnos) : api.get(RECURSO, token),

  crear: (turno, token) =>
    USAR_MOCK
      ? operar((datos) => {
          const limpio = normalizar(turno)
          validarDisponibilidad(datos, limpio)
          const nuevo = { ...limpio, id: proximoId(datos.turnos) }
          datos.turnos.push(nuevo)
          return nuevo
        })
      : api.post(RECURSO, normalizar(turno), token),

  actualizar: (id, turno, token) =>
    USAR_MOCK
      ? operar((datos) => {
          const actual = buscarTurno(datos, id)
          const limpio = normalizar(turno)
          validarDisponibilidad(datos, limpio, id)
          Object.assign(actual, limpio)
          return actual
        })
      : api.put(`${RECURSO}/${id}`, normalizar(turno), token),

  cambiarEstado: (id, estado, token) =>
    USAR_MOCK
      ? operar((datos) => {
          const turno = buscarTurno(datos, id)
          turno.estado = estado
          return turno
        })
      : api.put(`${RECURSO}/${id}/estado`, { estado }, token),

  eliminar: (id, token) =>
    USAR_MOCK
      ? operar((datos) => {
          const turno = buscarTurno(datos, id)
          datos.turnos = datos.turnos.filter((item) => item.id !== turno.id)
          return null
        })
      : api.del(`${RECURSO}/${id}`, token),
}
