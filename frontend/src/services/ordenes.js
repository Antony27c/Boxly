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
    mecanico: orden.mecanico_nombre ?? '',
    total: Number(orden.costo_final ?? orden.costo_estimado ?? 0),
  }
}

function historialDesdeApi(item) {
  return {
    ...item,
    estado_anterior: item.estado_anterior ? nombreEstado(item.estado_anterior) : null,
    estado_nuevo: nombreEstado(item.estado_nuevo),
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

function mecanicoMock(datos, mecanicoId) {
  if (!mecanicoId) return {}
  const mecanico = datos.usuarios.find((u) => u.id === Number(mecanicoId))
  if (!mecanico || mecanico.rol !== 'mecanico' || !mecanico.activo) {
    throw new MockError('El usuario asignado no es un mecánico activo.', 400)
  }
  return { mecanico_id: mecanico.id, mecanico: `${mecanico.apellido}, ${mecanico.nombre}` }
}

function registrarHistorialMock(datos, orden, estadoAnterior, comentario) {
  datos.historial_estados.push({
    id: proximoId(datos.historial_estados),
    orden_id: orden.id,
    usuario_nombre: null,
    estado_anterior: estadoAnterior,
    estado_nuevo: orden.estado,
    comentario,
    fecha: new Date().toISOString(),
  })
}

export function sePuedeEliminar(orden) {
  return orden?.estado === 'Pendiente'
}

export const ordenesService = {
  mecanicos: (token) =>
    USAR_MOCK
      ? operar((datos) =>
          datos.usuarios
            .filter((u) => u.rol === 'mecanico' && u.activo)
            .map(({ id, nombre, apellido }) => ({ id, nombre, apellido })),
        )
      : api.get('/api/v1/usuarios/mecanicos', token),

  historial: (id, token) =>
    USAR_MOCK
      ? operar((datos) => {
          buscarOrden(datos, id)
          return datos.historial_estados.filter((item) => item.orden_id === Number(id))
        })
      : api.get(`${RECURSO}/${id}/historial`, token).then((lista) => lista.map(historialDesdeApi)),

  eliminar: (id, token) =>
    USAR_MOCK
      ? operar((datos) => {
          const orden = buscarOrden(datos, id)
          if (!sePuedeEliminar(orden)) {
            throw new MockError('Solo se pueden eliminar órdenes pendientes. Para las demás, pasala a "Cancelado".', 400)
          }
          datos.ordenes = datos.ordenes.filter((item) => item.id !== orden.id)
          datos.historial_estados = datos.historial_estados.filter((item) => item.orden_id !== orden.id)
          return null
        })
      : api.del(`${RECURSO}/${id}`, token),

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
            ...mecanicoMock(datos, orden.mecanico_id),
            total: Number(orden.total) || 0,
          }
          datos.ordenes.push(nueva)
          registrarHistorialMock(datos, nueva, null, 'Orden creada')
          return nueva
        })
      : api
          .post(
            RECURSO,
            {
              vehiculo_id: Number(orden.vehiculo_id),
              mecanico_id: orden.mecanico_id ? Number(orden.mecanico_id) : null,
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
          const estadoAnterior = actual.estado
          validarTransicion(estadoAnterior, orden.estado)
          Object.assign(actual, {
            estado: orden.estado,
            descripcion: orden.descripcion,
            ...mecanicoMock(datos, orden.mecanico_id),
            total: Number(orden.total) || 0,
          })
          if (estadoAnterior !== actual.estado) registrarHistorialMock(datos, actual, estadoAnterior, null)
          return actual
        })
      : api
          .patch(
            `${RECURSO}/${id}`,
            {
              estado: CODIGOS[orden.estado],
              mecanico_id: orden.mecanico_id ? Number(orden.mecanico_id) : null,
              descripcion_ingreso: orden.descripcion,
              [orden.costo_final != null ? 'costo_final' : 'costo_estimado']:
                Number(orden.total) || 0,
            },
            token,
          )
          .then(desdeApi),
}
