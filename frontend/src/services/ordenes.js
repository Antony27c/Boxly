import { api } from '@/lib/api'
import { MockError, operar, proximoId } from '@/mocks/db'
import { usaMock } from '@/services/config'

const RECURSO = '/api/v1/ordenes'
const USAR_MOCK = usaMock('ordenes')

const CODIGOS = {
  Pendiente: 'pendiente',
  Ingresado: 'ingresado',
  'En diagnóstico': 'en_diagnostico',
  'Esperando repuestos': 'esperando_repuestos',
  Listo: 'listo',
  Entregado: 'entregado',
  Cancelado: 'cancelado',
}

export const ESTADOS_ORDEN = Object.keys(CODIGOS)

const TRANSICIONES = {
  Pendiente: ['Ingresado', 'Cancelado'],
  Ingresado: ['En diagnóstico', 'Cancelado'],
  'En diagnóstico': ['Esperando repuestos', 'Listo', 'Cancelado'],
  'Esperando repuestos': ['Listo', 'Cancelado'],
  Listo: ['Entregado'],
  Entregado: [],
  Cancelado: [],
}

export function estadosPermitidos(estado) {
  return [estado, ...(TRANSICIONES[estado] ?? [])]
}

function nombreEstado(codigo) {
  return ESTADOS_ORDEN.find((estado) => CODIGOS[estado] === codigo) ?? codigo
}

export function desdeApi(orden) {
  return {
    ...orden,
    estado: nombreEstado(orden.estado),
    fecha: orden.fecha_ingreso?.slice(0, 10) ?? '',
    descripcion: orden.descripcion_ingreso,
    total: Number(orden.costo_final ?? orden.costo_estimado ?? 0),
  }
}

function buscarOrden(datos, id) {
  const orden = datos.ordenes.find((item) => item.id === Number(id))
  if (!orden) throw new MockError('No encontramos esa orden de trabajo.', 404)
  return orden
}

function validarTransicion(actual, nuevo) {
  if (nuevo !== actual && !(TRANSICIONES[actual] ?? []).includes(nuevo)) {
    throw new MockError(`No se puede pasar de "${actual}" a "${nuevo}".`, 400)
  }
}

export const ordenesService = {
  listar: (token) =>
    USAR_MOCK
      ? operar((datos) => datos.ordenes)
      : api.get(RECURSO, token).then((ordenes) => ordenes.map(desdeApi)),

  obtener: (id, token) =>
    USAR_MOCK
      ? operar((datos) => buscarOrden(datos, id))
      : api.get(`${RECURSO}/${id}`, token).then(desdeApi),

  crear: (orden, token) =>
    USAR_MOCK
      ? operar((datos) => {
          const vehiculoId = Number(orden.vehiculo_id)
          if (!datos.vehiculos.some((v) => v.id === vehiculoId)) {
            throw new MockError('El vehículo elegido ya no existe.', 400)
          }
          const nueva = {
            id: proximoId(datos.ordenes),
            vehiculo_id: vehiculoId,
            fecha: new Date().toISOString().slice(0, 10),
            estado: 'Pendiente',
            descripcion: orden.descripcion,
            mecanico: '',
            total: Number(orden.total) || 0,
          }
          datos.ordenes.push(nueva)
          return nueva
        })
      : api
          .post(
            RECURSO,
            {
              vehiculo_id: Number(orden.vehiculo_id),
              descripcion_ingreso: orden.descripcion,
              costo_estimado: Number(orden.total) || null,
            },
            token,
          )
          .then(desdeApi),

  actualizar: (id, orden, token) =>
    USAR_MOCK
      ? operar((datos) => {
          const actual = buscarOrden(datos, id)
          validarTransicion(actual.estado, orden.estado)
          Object.assign(actual, {
            estado: orden.estado,
            descripcion: orden.descripcion,
            total: Number(orden.total) || 0,
          })
          return actual
        })
      : api
          .patch(
            `${RECURSO}/${id}`,
            {
              estado: CODIGOS[orden.estado],
              descripcion_ingreso: orden.descripcion,
              [orden.costo_final != null ? 'costo_final' : 'costo_estimado']:
                Number(orden.total) || 0,
            },
            token,
          )
          .then(desdeApi),
}
